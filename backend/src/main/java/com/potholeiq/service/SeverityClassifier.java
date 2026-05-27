package com.potholeiq.service;

import org.bytedeco.opencv.opencv_core.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import static org.bytedeco.opencv.global.opencv_core.*;
import static org.bytedeco.opencv.global.opencv_imgproc.*;

/**
 * SeverityClassifier — classifies a detected pothole ROI using three OpenCV metrics
 * combined into a composite 0-100 score, then maps to MINOR / MODERATE / CRITICAL.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Metric                         │ Weight │ What it captures      │
 * ├─────────────────────────────────┼────────┼───────────────────────┤
 * │  Laplacian StdDev (roughness)   │  35%   │ Surface texture/cracks│
 * │  OTSU dark pixel ratio          │  35%   │ Shadow depth / cavity │
 * │  Pixel area ratio               │  30%   │ Physical pothole size  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Score ranges:
 *   < 35  → MINOR    (#4CAF50 green)   estimated depth 1–3 cm
 *   35–60 → MODERATE (#FFC107 amber)   estimated depth 3–8 cm
 *   > 60  → CRITICAL (#F44336 red)     estimated depth 8–20 cm
 */
@Service
public class SeverityClassifier {

    private static final Logger log = LoggerFactory.getLogger(SeverityClassifier.class);

    // ── Severity enum ─────────────────────────────────────────────────────────

    public enum SeverityLevel {
        MINOR    ("#4CAF50"),
        MODERATE ("#FFC107"),
        CRITICAL ("#F44336");

        private final String hexColor;

        SeverityLevel(String hexColor) {
            this.hexColor = hexColor;
        }

        public String getHexColor() {
            return hexColor;
        }
    }

    // ── Result record ─────────────────────────────────────────────────────────

    public record SeverityResult(
            SeverityLevel level,
            double compositeScore,
            double estimatedDepthCm,
            String hexColor
    ) {}

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Classifies a pothole detection using the given bounding box on the full image.
     *
     * @param fullImage the full-size BGR OpenCV Mat (original resolution)
     * @param x         bbox top-left X in the full image
     * @param y         bbox top-left Y in the full image
     * @param width     bbox width
     * @param height    bbox height
     * @return SeverityResult containing level, score, depth estimate, and hex colour
     */
    public SeverityResult classify(Mat fullImage, int x, int y, int width, int height) {
        try {
            // Clamp bbox to image bounds
            int imgW = fullImage.cols();
            int imgH = fullImage.rows();
            x      = Math.max(0, Math.min(x, imgW - 1));
            y      = Math.max(0, Math.min(y, imgH - 1));
            width  = Math.min(width,  imgW - x);
            height = Math.min(height, imgH - y);

            if (width <= 0 || height <= 0) {
                log.warn("Invalid bbox after clamping — using default severity");
                return defaultResult();
            }

            // Extract ROI
            Rect  bboxRect = new Rect(x, y, width, height);
            Mat   roi      = new Mat(fullImage, bboxRect);

            // ── Metric 1: Laplacian StdDev (surface roughness) [35%] ───────────
            Mat gray = new Mat();
            cvtColor(roi, gray, COLOR_BGR2GRAY);

            Mat laplacian = new Mat();
            Laplacian(gray, laplacian, CV_32F);

            MatVector meanVec   = new MatVector(1);
            MatVector stdDevVec = new MatVector(1);
            meanStdDev(laplacian, meanVec.get(0) != null ? meanVec.get(0) : new Mat(),
                       stdDevVec.get(0) != null ? stdDevVec.get(0) : new Mat());

            // Use alternative scalar-based approach for stddev
            Mat   lapMean   = new Mat();
            Mat   lapStdDev = new Mat();
            meanStdDev(laplacian, lapMean, lapStdDev);

            double lapStdDevVal = lapStdDev.createIndexer() != null
                    ? readScalar(lapStdDev)
                    : 0.0;

            // Normalise: typical pothole roughness stddev ranges from 5 to 80+
            double roughnessScore = Math.min(lapStdDevVal / 60.0, 1.0) * 100.0;

            // ── Metric 2: OTSU dark pixel ratio (shadow depth) [35%] ──────────
            Mat grayForOtsu   = gray.clone();
            Mat thresholded   = new Mat();
            threshold(grayForOtsu, thresholded, 0, 255, THRESH_BINARY_INV + THRESH_OTSU);

            // Count dark (pothole shadow) pixels
            Scalar darkSum   = sumElems(thresholded);
            long totalPixels = (long) width * height;
            double darkPixelRatio = darkSum.get(0) / (255.0 * totalPixels);
            double darknessScore  = darkPixelRatio * 100.0;

            // ── Metric 3: Pixel area ratio (physical size) [30%] ──────────────
            double imageArea      = (double) imgW * imgH;
            double bboxArea       = (double) width * height;
            double pixelAreaRatio = bboxArea / imageArea;
            // Scale: a bbox covering 10% of image = full score
            double areaScore = Math.min(pixelAreaRatio / 0.10, 1.0) * 100.0;

            // ── Composite score ────────────────────────────────────────────────
            double composite = (roughnessScore * 0.35)
                             + (darknessScore  * 0.35)
                             + (areaScore      * 0.30);

            // Clamp to [0, 100]
            composite = Math.max(0, Math.min(100, composite));

            // ── Map to severity level ──────────────────────────────────────────
            SeverityLevel level = toSeverityLevel(composite);
            double depthCm      = estimateDepth(level);

            log.debug("Severity: score={}, roughness={}, darkness={}, area={} → {}",
                      String.format("%.1f", composite),
                      String.format("%.1f", roughnessScore),
                      String.format("%.1f", darknessScore),
                      String.format("%.1f", areaScore),
                      level);

            // Release native resources
            roi.close();
            gray.close();
            laplacian.close();
            lapMean.close();
            lapStdDev.close();
            grayForOtsu.close();
            thresholded.close();

            return new SeverityResult(level, composite, depthCm, level.getHexColor());

        } catch (Exception e) {
            log.error("SeverityClassifier error: {}", e.getMessage(), e);
            return defaultResult();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private double readScalar(Mat mat) {
        try {
            return mat.createIndexer(false)
                      .getDouble(new long[]{0, 0});
        } catch (Exception e) {
            return 0.0;
        }
    }

    private SeverityLevel toSeverityLevel(double score) {
        if (score < 35.0) return SeverityLevel.MINOR;
        if (score < 60.0) return SeverityLevel.MODERATE;
        return SeverityLevel.CRITICAL;
    }

    /**
     * Estimates depth in cm using the midpoint of each severity range.
     * MINOR: 1–3 cm  → 2 cm
     * MODERATE: 3–8 cm → 5.5 cm
     * CRITICAL: 8–20 cm → 14 cm
     */
    private double estimateDepth(SeverityLevel level) {
        return switch (level) {
            case MINOR    -> 2.0;
            case MODERATE -> 5.5;
            case CRITICAL -> 14.0;
        };
    }

    private SeverityResult defaultResult() {
        return new SeverityResult(
                SeverityLevel.MINOR, 20.0, 2.0, SeverityLevel.MINOR.getHexColor()
        );
    }
}
