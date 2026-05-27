package com.potholeiq.service;

import ai.onnxruntime.*;
import com.potholeiq.dto.DetectionDto;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.bytedeco.opencv.opencv_core.Mat;
import org.bytedeco.opencv.opencv_core.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.bytedeco.opencv.global.opencv_imgcodecs.imread;
import static org.bytedeco.opencv.global.opencv_imgproc.resize;
import static org.bytedeco.opencv.global.opencv_imgproc.COLOR_BGR2RGB;
import static org.bytedeco.opencv.global.opencv_imgproc.cvtColor;

/**
 * AiOnnxInferenceService — loads a YOLOv8 ONNX model and runs pothole
 * detection.
 *
 * Model loading order (first found wins):
 * 1. Classpath: /models/pothole_detector.onnx (jar-bundled during build)
 * 2. Filesystem: ./models/pothole_detector.onnx (runtime placement)
 *
 * If neither is found, the service runs in STUB mode and returns an empty
 * detection list.
 *
 * Input tensor shape: [1, 3, 640, 640] — NCHW, normalised [0.0 – 1.0], RGB
 * Output tensor shape: [1, 84, 8400] — YOLOv8 with 80 COCO classes
 * rows 0-3: cx, cy, w, h (centre-format, relative to 640×640)
 * rows 4-83: class scores
 */
@Service
public class AiOnnxInferenceService {

    private static final Logger log = LoggerFactory.getLogger(AiOnnxInferenceService.class);

    private static final int INPUT_SIZE = 640;
    private static final float CONF_THRESHOLD = 0.5f;
    private static final float IOU_THRESHOLD = 0.45f;
    private static final String MODEL_FILENAME = "best.onnx";

    @Value("${app.models.dir:./models/}")
    private String modelsDir;

    private OrtEnvironment ortEnv;
    private OrtSession ortSession;
    private boolean modelLoaded = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @PostConstruct
    public void loadModel() {
        try {
            ortEnv = OrtEnvironment.getEnvironment();

            byte[] modelBytes = loadModelBytes();
            if (modelBytes == null) {
                log.warn("╔══════════════════════════════════════════════════════════╗");
                log.warn("║  ONNX model NOT found — running in STUB (no-AI) mode.   ║");
                log.warn("║  Place pothole_detector.onnx in:                        ║");
                log.warn("║    src/main/resources/models/  (classpath)              ║");
                log.warn("║    ./models/                   (runtime)                ║");
                log.warn("╚══════════════════════════════════════════════════════════╝");
                return;
            }

            OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
            opts.setIntraOpNumThreads(Runtime.getRuntime().availableProcessors());
            ortSession = ortEnv.createSession(modelBytes, opts);
            modelLoaded = true;

            log.info("ONNX model loaded. Input names: {}", ortSession.getInputNames());
            log.info("ONNX model loaded. Output names: {}", ortSession.getOutputNames());
        } catch (OrtException e) {
            log.error("Failed to load ONNX model: {}", e.getMessage(), e);
        }
    }

    @PreDestroy
    public void closeSession() {
        try {
            if (ortSession != null)
                ortSession.close();
            if (ortEnv != null)
                ortEnv.close();
        } catch (OrtException e) {
            log.error("Error closing ONNX session: {}", e.getMessage());
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Runs pothole detection on the given image file.
     *
     * @param imagePath absolute filesystem path to the image
     * @return list of detections (empty if model not loaded or no potholes found)
     */
    public List<DetectionDto> detect(String imagePath) {
        if (!modelLoaded) {
            log.debug("detect() called but model not loaded — returning empty list.");
            return Collections.emptyList();
        }

        try {
            // 1. Load image with OpenCV
            Mat original = imread(imagePath);
            if (original.empty()) {
                log.warn("Could not read image at: {}", imagePath);
                return Collections.emptyList();
            }

            int origWidth = original.cols();
            int origHeight = original.rows();

            // 2. Resize to 640×640 and convert BGR→RGB (YOLOv8 expects RGB)
            Mat resized = new Mat();
            resize(original, resized, new Size(INPUT_SIZE, INPUT_SIZE));
            Mat rgb = new Mat();
            cvtColor(resized, rgb, COLOR_BGR2RGB);

            // 3. Build NCHW float tensor [1][3][640][640], normalised by 1/255
            float[][][][] inputData = buildNchwTensor(rgb);

            // 4. Run ONNX inference
            String inputName = ortSession.getInputNames().iterator().next();
            OnnxTensor inputTensor = OnnxTensor.createTensor(ortEnv, inputData);
            OrtSession.Result result = ortSession.run(
                    Collections.singletonMap(inputName, inputTensor));

            // 5. Parse output [1][84][8400]
            float[][][] output = (float[][][]) result.get(0).getValue();
            List<DetectionDto> detections = parseDetections(
                    output, origWidth, origHeight, CONF_THRESHOLD);

            inputTensor.close();
            result.close();
            original.close();
            resized.close();
            rgb.close();

            log.info("detect(): found {} detections above threshold {}", detections.size(), CONF_THRESHOLD);
            return detections;

        } catch (Exception e) {
            log.error("Inference error for {}: {}", imagePath, e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    // ── Tensor building ───────────────────────────────────────────────────────

    /**
     * Converts an OpenCV Mat (RGB, 8-bit, 640×640) into a float[1][3][640][640]
     * NCHW tensor.
     * Each pixel value is divided by 255.0 to normalise to [0, 1].
     */
    private float[][][][] buildNchwTensor(Mat rgb) {
        float[][][][] tensor = new float[1][3][INPUT_SIZE][INPUT_SIZE];

        // Access raw bytes — Mat is contiguous: height × width × channels
        byte[] data = new byte[INPUT_SIZE * INPUT_SIZE * 3];
        rgb.data().get(data);

        for (int y = 0; y < INPUT_SIZE; y++) {
            for (int x = 0; x < INPUT_SIZE; x++) {
                int base = (y * INPUT_SIZE + x) * 3;
                // RGB order (already converted above)
                tensor[0][0][y][x] = (data[base] & 0xFF) / 255.0f; // R
                tensor[0][1][y][x] = (data[base + 1] & 0xFF) / 255.0f; // G
                tensor[0][2][y][x] = (data[base + 2] & 0xFF) / 255.0f; // B
            }
        }
        return tensor;
    }

    // ── Output parsing ────────────────────────────────────────────────────────

    /**
     * Parses the YOLOv8 output tensor [1][84][8400].
     * Rows 0-3: cx, cy, w, h (relative to INPUT_SIZE=640).
     * Rows 4-83: class confidence scores.
     */
    private List<DetectionDto> parseDetections(
            float[][][] output,
            int origWidth,
            int origHeight,
            float confThreshold) {
        List<DetectionDto> detections = new ArrayList<>();
        int numAnchors = output[0][0].length; // 8400
        int numClasses = output[0].length - 4; // 80 for COCO

        for (int i = 0; i < numAnchors; i++) {
            // Find max class score
            float maxScore = 0f;
            for (int c = 4; c < 4 + numClasses; c++) {
                if (output[0][c][i] > maxScore) {
                    maxScore = output[0][c][i];
                }
            }

            if (maxScore < confThreshold)
                continue;

            // Decode bbox from centre-format (relative to 640×640) → corner pixel coords
            float cx = output[0][0][i];
            float cy = output[0][1][i];
            float w = output[0][2][i];
            float h = output[0][3][i];

            float scaleX = (float) origWidth / INPUT_SIZE;
            float scaleY = (float) origHeight / INPUT_SIZE;

            int x1 = Math.max(0, Math.round((cx - w / 2f) * scaleX));
            int y1 = Math.max(0, Math.round((cy - h / 2f) * scaleY));
            int bw = Math.round(w * scaleX);
            int bh = Math.round(h * scaleY);

            // Clamp to image bounds
            x1 = Math.min(x1, origWidth - 1);
            y1 = Math.min(y1, origHeight - 1);
            bw = Math.min(bw, origWidth - x1);
            bh = Math.min(bh, origHeight - y1);

            if (bw <= 0 || bh <= 0)
                continue;

            DetectionDto dto = DetectionDto.builder()
                    .bboxX(x1)
                    .bboxY(y1)
                    .bboxWidth(bw)
                    .bboxHeight(bh)
                    .confidenceScore(maxScore)
                    .build();

            detections.add(dto);
        }

        // Sort by confidence descending before NMS
        detections.sort((a, b) -> Double.compare(b.getConfidenceScore(), a.getConfidenceScore()));
        
        return applyNms(detections, IOU_THRESHOLD);
    }

    /**
     * Applies Non-Maximum Suppression (NMS) to filter overlapping bounding boxes.
     */
    private List<DetectionDto> applyNms(List<DetectionDto> boxes, float iouThreshold) {
        List<DetectionDto> result = new ArrayList<>();
        boolean[] suppressed = new boolean[boxes.size()];
        
        for (int i = 0; i < boxes.size(); i++) {
            if (suppressed[i]) continue;
            
            result.add(boxes.get(i));
            
            for (int j = i + 1; j < boxes.size(); j++) {
                if (suppressed[j]) continue;
                
                if (calculateIou(boxes.get(i), boxes.get(j)) > iouThreshold) {
                    suppressed[j] = true;
                }
            }
        }
        return result;
    }

    /**
     * Calculates the Intersection over Union (IoU) of two bounding boxes.
     */
    private float calculateIou(DetectionDto box1, DetectionDto box2) {
        float x1 = Math.max((float)box1.getBboxX(), (float)box2.getBboxX());
        float y1 = Math.max((float)box1.getBboxY(), (float)box2.getBboxY());
        float x2 = Math.min((float)(box1.getBboxX() + box1.getBboxWidth()), (float)(box2.getBboxX() + box2.getBboxWidth()));
        float y2 = Math.min((float)(box1.getBboxY() + box1.getBboxHeight()), (float)(box2.getBboxY() + box2.getBboxHeight()));

        float intersectionWidth = Math.max(0, x2 - x1);
        float intersectionHeight = Math.max(0, y2 - y1);
        float intersectionArea = intersectionWidth * intersectionHeight;
        
        float box1Area = (float)(box1.getBboxWidth() * box1.getBboxHeight());
        float box2Area = (float)(box2.getBboxWidth() * box2.getBboxHeight());

        return intersectionArea / (box1Area + box2Area - intersectionArea);
    }

    // ── Model loading ─────────────────────────────────────────────────────────

    private byte[] loadModelBytes() {
        // 1. Try classpath first (bundled JAR)
        byte[] bytes = tryLoadFromClasspath(MODEL_FILENAME);
        if (bytes != null)
            return bytes;

        bytes = tryLoadFromClasspath("best.onnx");
        if (bytes != null)
            return bytes;

        // 2. Fall back to filesystem
        bytes = tryLoadFromFileSystem(MODEL_FILENAME);
        if (bytes != null)
            return bytes;

        bytes = tryLoadFromFileSystem("best.onnx");
        if (bytes != null)
            return bytes;

        return null; // not found
    }

    private byte[] tryLoadFromClasspath(String filename) {
        try (InputStream is = getClass().getResourceAsStream("/models/" + filename)) {
            if (is != null) {
                byte[] bytes = is.readAllBytes();
                log.info("Loaded ONNX model from classpath: /models/{} ({} bytes)", filename, bytes.length);
                return bytes;
            }
        } catch (Exception e) {
            log.debug("Classpath model {} not found: {}", filename, e.getMessage());
        }
        return null;
    }

    private byte[] tryLoadFromFileSystem(String filename) {
        Path fsPath = Paths.get(modelsDir, filename).toAbsolutePath().normalize();
        if (Files.exists(fsPath)) {
            try {
                byte[] bytes = Files.readAllBytes(fsPath);
                log.info("Loaded ONNX model from filesystem: {} ({} bytes)", fsPath, bytes.length);
                return bytes;
            } catch (Exception e) {
                log.error("Failed to read model file {}: {}", fsPath, e.getMessage());
            }
        }
        return null;
    }
}
