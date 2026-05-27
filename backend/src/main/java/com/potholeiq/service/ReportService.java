package com.potholeiq.service;

import com.potholeiq.dto.DetectionDto;
import com.potholeiq.dto.LocationRequest;
import com.potholeiq.dto.ScanResult;
import com.potholeiq.model.entity.DamageReport;
import com.potholeiq.model.entity.DamageReport.ReportStatus;
import com.potholeiq.model.entity.User;
import com.potholeiq.repository.DamageReportRepository;
import com.potholeiq.repository.UserRepository;
import com.potholeiq.service.ExifExtractorService.GpsData;
import com.potholeiq.service.SeverityClassifier.SeverityLevel;
import com.potholeiq.service.SeverityClassifier.SeverityResult;
import org.bytedeco.opencv.opencv_core.Mat;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.bytedeco.opencv.global.opencv_imgcodecs.imread;

/**
 * ReportService — the central orchestration service that ties together
 * Cloudinary storage, EXIF extraction, AI inference, severity classification,
 * reverse geocoding, persistence, and complaint generation.
 */
@Service
public class ReportService {

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    // JTS geometry factory with SRID 4326 (WGS-84)
    private static final GeometryFactory GEO_FACTORY =
            new GeometryFactory(new PrecisionModel(), 4326);

    private final CloudinaryService      cloudinaryService;
    private final ExifExtractorService   exifExtractorService;
    private final AiOnnxInferenceService aiService;
    private final SeverityClassifier     severityClassifier;
    private final LocationService        locationService;
    private final ComplaintService       complaintService;
    private final DamageReportRepository reportRepository;
    private final UserRepository         userRepository;

    @Value("${complaint.ward-email:wardoffice@municipality.gov}")
    private String defaultWardEmail;

    public ReportService(
            CloudinaryService      cloudinaryService,
            ExifExtractorService   exifExtractorService,
            AiOnnxInferenceService aiService,
            SeverityClassifier     severityClassifier,
            LocationService        locationService,
            ComplaintService       complaintService,
            DamageReportRepository reportRepository,
            UserRepository         userRepository
    ) {
        this.cloudinaryService    = cloudinaryService;
        this.exifExtractorService = exifExtractorService;
        this.aiService            = aiService;
        this.severityClassifier   = severityClassifier;
        this.locationService      = locationService;
        this.complaintService     = complaintService;
        this.reportRepository     = reportRepository;
        this.userRepository       = userRepository;
    }

    // ── Main scan pipeline ────────────────────────────────────────────────────

    /**
     * Full scan pipeline: save image to temp → extract GPS → run AI → classify → geocode → upload Cloudinary → persist → notify.
     *
     * @param imageFile the uploaded image
     * @param sessionId scanner session ID from client
     * @param lat       optional latitude from request params
     * @param lng       optional longitude from request params
     * @return ScanResult (with locationRequired=true when no GPS is available)
     */
    public ScanResult processScan(MultipartFile imageFile, String sessionId,
                                  Double lat, Double lng, String reporterId) throws Exception {

        // 1. Save image to system temp directory
        Path tempFile = Files.createTempFile("pothole-scan-", ".jpg");
        try {
            imageFile.transferTo(tempFile.toFile());
            String absPath = tempFile.toAbsolutePath().toString();

            // 2. Try to resolve GPS coordinates
            Double resolvedLat = lat;
            Double resolvedLng = lng;
            boolean gpsFromExif = false;

            if (resolvedLat == null || resolvedLng == null) {
                GpsData exif = exifExtractorService.extract(imageFile);
                if (exif.found()) {
                    resolvedLat  = exif.latitude();
                    resolvedLng  = exif.longitude();
                    gpsFromExif  = true;
                }
            }

            // Upload image to Cloudinary and get URL
            String imageUrl = cloudinaryService.uploadImage(tempFile.toFile(), "potholeiq/images");

            // 3. If still no GPS — save skeleton report and return 202 signal
            if (resolvedLat == null || resolvedLng == null) {
                DamageReport skeleton = new DamageReport();
                skeleton.setImageUrl(imageUrl);
                skeleton.setScannerSessionId(sessionId);
                skeleton.setStatus(ReportStatus.REPORTED);
                skeleton.setHasPothole(false);
                skeleton.setReporter(resolveReporter(reporterId));
                DamageReport saved = reportRepository.save(skeleton);

                log.info("No GPS for session {} — returning locationRequired=true (reportId={})",
                         sessionId, saved.getId());

                return ScanResult.builder()
                        .sessionId(sessionId)
                        .potholeFound(false)
                        .criticalFound(false)
                        .detections(List.of())
                        .locationRequired(true)
                        .reportId(saved.getId().toString())
                        .message("Image saved. Please provide GPS location to complete analysis.")
                        .build();
            }

            // 4. Resolve street address via Nominatim
            String streetAddress = locationService.reverseGeocode(resolvedLat, resolvedLng);

            // 5. Run AI inference
            List<DetectionDto> rawDetections = aiService.detect(absPath);
            log.info("processScan: AI returned {} raw detections", rawDetections.size());

            // 6. Load image Mat for severity classification (reuse for all detections)
            Mat fullImage = imread(absPath);

            // 7. Enrich each detection with severity + depth + address
            List<DetectionDto> enriched = new ArrayList<>();
            boolean criticalFound = false;

            for (DetectionDto det : rawDetections) {
                SeverityResult sev = fullImage.empty()
                        ? new SeverityResult(SeverityLevel.MINOR, 20.0, 2.0,
                                             SeverityLevel.MINOR.getHexColor())
                        : severityClassifier.classify(
                                fullImage,
                                det.getBboxX(), det.getBboxY(),
                                det.getBboxWidth(), det.getBboxHeight());

                double priorityScore = calculatePriorityScore(
                        sev.compositeScore(), det.getConfidenceScore());

                DetectionDto enrichedDet = DetectionDto.builder()
                        .bboxX(det.getBboxX())
                        .bboxY(det.getBboxY())
                        .bboxWidth(det.getBboxWidth())
                        .bboxHeight(det.getBboxHeight())
                        .confidenceScore(det.getConfidenceScore())
                        .severity(sev.level().name())
                        .severityColor(sev.hexColor())
                        .priorityScore(priorityScore)
                        .estimatedDepthCm(sev.estimatedDepthCm())
                        .streetAddress(streetAddress)
                        .latitude(resolvedLat)
                        .longitude(resolvedLng)
                        .build();

                enriched.add(enrichedDet);

                if (sev.level() == SeverityLevel.CRITICAL) {
                    criticalFound = true;
                }
            }

            if (!fullImage.empty()) fullImage.close();
            log.info("processScan: enriched {} detections, criticalFound={}", enriched.size(), criticalFound);

            DamageReport saved = null;
            if (!enriched.isEmpty()) {
                DetectionDto best = enriched.get(0); // already sorted by confidence
                log.info("processScan: persisting primary detection (confidence={}, severity={})",
                        String.format("%.3f", best.getConfidenceScore()), best.getSeverity());
                saved = persistReport(best, imageUrl, sessionId, resolvedLat, resolvedLng, streetAddress, reporterId);
                log.info("processScan: report saved with id={}", saved.getId());

                // Save additional detections (cap at 9 extras to avoid JSONB bloat)
                if (enriched.size() > 1) {
                    try {
                        List<DetectionDto> extras = enriched.subList(1, Math.min(enriched.size(), 10));
                        saved.setAdditionalDetections(new ArrayList<>(extras));
                        saved = reportRepository.save(saved);
                        log.info("processScan: saved {} additional detections", extras.size());
                    } catch (Exception ex) {
                        log.warn("processScan: could not save additionalDetections — {}", ex.getMessage());
                        // Report is already saved; additional detections are non-critical
                    }
                }

                // Update detection DTO with the report ID
                enriched.get(0).setReportId(saved.getId().toString());
            } else {
                // No detections — still persist a "no pothole" record for audit
                log.info("processScan: no detections — persisting no-detection record");
                saved = persistNoDetectionReport(imageUrl, sessionId, resolvedLat, resolvedLng, streetAddress, reporterId);
            }

            // 9. Send complaint email in background thread for ANY detected pothole
            final DamageReport finalReport = saved;
            if (!enriched.isEmpty() && finalReport != null) {
                log.info("processScan: triggering async complaint for report {}", finalReport.getId());
                complaintService.sendCriticalComplaintAsync(finalReport, imageUrl);
            }

            return ScanResult.builder()
                    .sessionId(sessionId)
                    .potholeFound(!enriched.isEmpty())
                    .criticalFound(criticalFound)
                    .detections(enriched)
                    .locationRequired(false)
                    .reportId(saved != null ? saved.getId().toString() : null)
                    .message(buildResultMessage(enriched))
                    .build();
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    /**
     * Runs AI detection and severity classification on an uploaded image 
     * without persisting a DamageReport record to the database.
     * Used for pre-submit verification of manually uploaded images.
     */
    public ScanResult analyzeImage(MultipartFile imageFile) throws Exception {
        // 1. Save image to system temp directory temporarily for inference
        Path tempFile = Files.createTempFile("pothole-check-", ".jpg");
        try {
            imageFile.transferTo(tempFile.toFile());
            String absPath = tempFile.toAbsolutePath().toString();

            // 2. Run AI inference
            List<DetectionDto> rawDetections = aiService.detect(absPath);

            // 3. Load image Mat for severity classification
            Mat fullImage = imread(absPath);

            // 4. Enrich detections with severity classification
            List<DetectionDto> enriched = new ArrayList<>();
            boolean criticalFound = false;

            for (DetectionDto det : rawDetections) {
                SeverityResult sev = fullImage.empty()
                        ? new SeverityResult(SeverityLevel.MINOR, 20.0, 2.0,
                                             SeverityLevel.MINOR.getHexColor())
                        : severityClassifier.classify(
                                fullImage,
                                det.getBboxX(), det.getBboxY(),
                                det.getBboxWidth(), det.getBboxHeight());

                double priorityScore = calculatePriorityScore(
                        sev.compositeScore(), det.getConfidenceScore());

                DetectionDto enrichedDet = DetectionDto.builder()
                        .bboxX(det.getBboxX())
                        .bboxY(det.getBboxY())
                        .bboxWidth(det.getBboxWidth())
                        .bboxHeight(det.getBboxHeight())
                        .confidenceScore(det.getConfidenceScore())
                        .severity(sev.level().name())
                        .severityColor(sev.hexColor())
                        .priorityScore(priorityScore)
                        .estimatedDepthCm(sev.estimatedDepthCm())
                        .build();

                enriched.add(enrichedDet);

                if (sev.level() == SeverityLevel.CRITICAL) {
                    criticalFound = true;
                }
            }

            if (!fullImage.empty()) {
                fullImage.close();
            }

            return ScanResult.builder()
                    .potholeFound(!enriched.isEmpty())
                    .criticalFound(criticalFound)
                    .detections(enriched)
                    .locationRequired(false)
                    .message(buildResultMessage(enriched))
                    .build();
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }


    // ── Location update (two-step flow) ───────────────────────────────────────

    /**
     * Updates an existing DamageReport with manually provided GPS coordinates,
     * then re-runs AI inference and severity classification if not already done.
     *
     * @param reportId UUID string of the skeleton report
     * @param req      the LocationRequest containing lat/lng
     * @return the updated DamageReport
     */
    public DamageReport updateLocation(String reportId, LocationRequest req) throws Exception {
        DamageReport report = reportRepository.findById(UUID.fromString(reportId))
                .orElseThrow(() -> new RuntimeException("Report not found: " + reportId));

        report.setLatitude(req.getLatitude());
        report.setLongitude(req.getLongitude());
        report.setGeom(GEO_FACTORY.createPoint(
                new Coordinate(req.getLongitude(), req.getLatitude())));

        String address = locationService.reverseGeocode(req.getLatitude(), req.getLongitude());
        report.setStreetAddress(address);

        // Run AI if not yet processed
        if (!Boolean.TRUE.equals(report.getHasPothole()) && report.getImageUrl() != null) {
            Path tempFile = Files.createTempFile("pothole-update-", ".jpg");
            try {
                // Download image from Cloudinary URL
                try (InputStream in = URI.create(report.getImageUrl()).toURL().openStream()) {
                    Files.copy(in, tempFile, StandardCopyOption.REPLACE_EXISTING);
                }
                String absPath = tempFile.toAbsolutePath().toString();

                List<DetectionDto> detections = aiService.detect(absPath);

                if (!detections.isEmpty()) {
                    DetectionDto best = detections.get(0);
                    Mat img = imread(absPath);
                    SeverityResult sev = img.empty()
                            ? new SeverityResult(SeverityLevel.MINOR, 20.0, 2.0,
                                                 SeverityLevel.MINOR.getHexColor())
                            : severityClassifier.classify(img,
                                  best.getBboxX(), best.getBboxY(),
                                  best.getBboxWidth(), best.getBboxHeight());
                    if (!img.empty()) img.close();

                    double priority = calculatePriorityScore(sev.compositeScore(), best.getConfidenceScore());

                    report.setHasPothole(true);
                    report.setConfidenceScore(best.getConfidenceScore());
                    report.setBboxX((double) best.getBboxX());
                    report.setBboxY((double) best.getBboxY());
                    report.setBboxWidth((double) best.getBboxWidth());
                    report.setBboxHeight((double) best.getBboxHeight());
                    report.setSeverity(sev.level().name());
                    report.setEstimatedDepthCm(sev.estimatedDepthCm());
                    report.setPriorityScore(priority);
                    report.setStatus(ReportStatus.VERIFIED);

                    // Send complaint email for all detected potholes
                    report = reportRepository.save(report);
                    complaintService.sendCriticalComplaintAsync(report, report.getImageUrl());
                }
            } finally {
                Files.deleteIfExists(tempFile);
            }
        }

        return reportRepository.save(report);
    }

    // ── Persistence helpers ───────────────────────────────────────────────────

    private DamageReport persistReport(DetectionDto det, String imageUrl, String sessionId,
                                       double lat, double lng, String address, String reporterId) {
        DamageReport r = new DamageReport();
        r.setImageUrl(imageUrl);
        r.setScannerSessionId(sessionId);
        r.setLatitude(lat);
        r.setLongitude(lng);
        r.setGeom(GEO_FACTORY.createPoint(new Coordinate(lng, lat)));
        r.setStreetAddress(address);
        r.setHasPothole(true);
        r.setConfidenceScore(det.getConfidenceScore());
        r.setBboxX((double) det.getBboxX());
        r.setBboxY((double) det.getBboxY());
        r.setBboxWidth((double) det.getBboxWidth());
        r.setBboxHeight((double) det.getBboxHeight());
        r.setSeverity(det.getSeverity());
        r.setEstimatedDepthCm(det.getEstimatedDepthCm());
        r.setPriorityScore(det.getPriorityScore());
        r.setStatus(ReportStatus.VERIFIED);
        r.setDetectedAt(LocalDateTime.now());
        r.setReporter(resolveReporter(reporterId));
        return reportRepository.save(r);
    }

    private DamageReport persistNoDetectionReport(String imageUrl, String sessionId,
                                                   double lat, double lng, String address, String reporterId) {
        DamageReport r = new DamageReport();
        r.setImageUrl(imageUrl);
        r.setScannerSessionId(sessionId);
        r.setLatitude(lat);
        r.setLongitude(lng);
        r.setGeom(GEO_FACTORY.createPoint(new Coordinate(lng, lat)));
        r.setStreetAddress(address);
        r.setHasPothole(false);
        r.setStatus(ReportStatus.REPORTED);
        r.setDetectedAt(LocalDateTime.now());
        r.setReporter(resolveReporter(reporterId));
        return reportRepository.save(r);
    }

    /**
     * Resolves a reporterId string to a User entity reference.
     * Uses getReferenceById() — no DB hit needed, just a JPA proxy for the FK write.
     * Returns null safely if reporterId is null or not a valid UUID.
     */
    private User resolveReporter(String reporterId) {
        if (reporterId == null || reporterId.isBlank()) return null;
        try {
            return userRepository.getReferenceById(UUID.fromString(reporterId));
        } catch (IllegalArgumentException e) {
            log.warn("Invalid reporterId UUID '{}' — reporter_id will be null", reporterId);
            return null;
        }
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    /**
     * Priority score = severity composite (0-100) × confidence (0-1).
     * Higher is more urgent.
     */
    private double calculatePriorityScore(double severityScore, double confidence) {
        return Math.round(severityScore * confidence * 10.0) / 10.0;
    }

    private String buildResultMessage(List<DetectionDto> detections) {
        if (detections.isEmpty()) return "No potholes detected in this image.";
        long critical = detections.stream()
                .filter(d -> "CRITICAL".equals(d.getSeverity())).count();
        if (critical > 0) {
            return String.format("%d pothole(s) detected. %d CRITICAL — complaint sent to ward office.",
                    detections.size(), critical);
        }
        return String.format("%d pothole(s) detected.", detections.size());
    }
}
