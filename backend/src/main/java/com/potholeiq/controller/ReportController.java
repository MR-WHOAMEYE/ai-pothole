package com.potholeiq.controller;

import com.potholeiq.dto.ReportUploadResponse;
import com.potholeiq.dto.ScanResult;
import com.potholeiq.model.entity.DamageReport;
import com.potholeiq.repository.DamageReportRepository;
import com.potholeiq.service.ReportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * ReportController — handles single-shot report uploads and report retrieval.
 *
 * Unlike ScannerController (designed for real-time streaming frames),
 * this controller is for one-shot community reporting (e.g. web/app upload).
 */
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private static final Logger log = LoggerFactory.getLogger(ReportController.class);

    private final ReportService            reportService;
    private final DamageReportRepository   reportRepository;

    public ReportController(ReportService reportService,
                            DamageReportRepository reportRepository) {
        this.reportService    = reportService;
        this.reportRepository = reportRepository;
    }

    /**
     * POST /api/reports/upload
     *
     * Single-shot image upload — same pipeline as /scanner/frame but returns
     * a simpler ReportUploadResponse instead of a full ScanResult.
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ReportUploadResponse> upload(
            @RequestPart("image")                                MultipartFile image,
            @RequestParam(value = "lat",       required = false) Double lat,
            @RequestParam(value = "lng",       required = false) Double lng,
            @RequestParam(value = "sessionId", required = false) String sessionId,
            @RequestParam(value = "reporterId", required = false) String reporterId
    ) {
        log.info("POST /api/reports/upload — lat={}, lng={}, reporterId={}", lat, lng, reporterId);
        try {
            String sid    = sessionId != null ? sessionId : "upload-" + System.currentTimeMillis();
            ScanResult sr = reportService.processScan(image, sid, lat, lng, reporterId);

            boolean gpsFound = !sr.isLocationRequired();
            String status    = sr.isLocationRequired() ? "ACCEPTED" : "CREATED";

            return ResponseEntity
                    .status(sr.isLocationRequired() ? HttpStatus.ACCEPTED : HttpStatus.CREATED)
                    .body(ReportUploadResponse.builder()
                            .reportId(sr.getReportId())
                            .gpsFound(gpsFound)
                            .locationRequired(sr.isLocationRequired())
                            .status(status)
                            .message(sr.getMessage())
                            .build());
        } catch (Exception e) {
            log.error("Upload error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ReportUploadResponse.builder()
                            .status("ERROR")
                            .message("Upload failed: " + e.getMessage())
                            .build());
        }
    }

    /**
     * GET /api/reports/{id}
     *
     * Retrieve a single DamageReport by UUID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<DamageReport> getById(@PathVariable UUID id) {
        return reportRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/reports/nearby?lat=&lng=&radiusMeters=
     *
     * Returns reports within the given radius (default 1000 m) of a coordinate.
     * Uses PostGIS ST_DWithin for accurate metre-based distance calculation.
     */
    @GetMapping("/nearby")
    public ResponseEntity<List<DamageReport>> getNearby(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "1000") double radiusMeters
    ) {
        log.debug("GET /api/reports/nearby lat={}, lng={}, radius={}", lat, lng, radiusMeters);
        List<DamageReport> results = reportRepository.findNearbyWithinRadius(lat, lng, radiusMeters);
        return ResponseEntity.ok(results);
    }

    /**
     * GET /api/reports/my-reports?userId=
     *
     * Placeholder for user-specific report filtering.
     * Currently returns all reports (user ownership not yet implemented on entity level).
     */
    @GetMapping("/my-reports")
    public ResponseEntity<List<DamageReport>> getMyReports(
            @RequestParam(required = false) UUID userId
    ) {
        // TODO: filter by userId when user ownership is added to DamageReport
        List<DamageReport> all = reportRepository.findAll();
        return ResponseEntity.ok(all);
    }
}
