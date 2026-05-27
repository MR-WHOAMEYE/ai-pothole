package com.potholeiq.controller;

import com.potholeiq.dto.LocationRequest;
import com.potholeiq.dto.ScanResult;
import com.potholeiq.model.entity.DamageReport;
import com.potholeiq.service.ReportService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * ScannerController — handles real-time pothole scanning from a mobile/scanner client.
 *
 * Two-step GPS flow:
 *   Step 1: POST /api/scanner/frame   → may return 202 with locationRequired=true
 *   Step 2: POST /api/scanner/location → client provides GPS, analysis completes
 */
@RestController
@RequestMapping("/api/scanner")
public class ScannerController {

    private static final Logger log = LoggerFactory.getLogger(ScannerController.class);

    private final ReportService reportService;

    public ScannerController(ReportService reportService) {
        this.reportService = reportService;
    }

    /**
     * POST /api/scanner/frame
     *
     * Accepts a raw video frame or photo from the scanner app.
     * Runs AI detection, severity classification, and optionally triggers a complaint.
     *
     * @param image     the image file (JPEG/PNG)
     * @param sessionId client-provided session identifier
     * @param lat       optional GPS latitude (from device)
     * @param lng       optional GPS longitude (from device)
     * @return 200 with ScanResult, or 202 if no GPS found (locationRequired=true)
     */
    @PostMapping(value = "/frame", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ScanResult> processFrame(
            @RequestPart("image")              MultipartFile image,
            @RequestParam("sessionId")         String sessionId,
            @RequestParam(value = "lat", required = false) Double lat,
            @RequestParam(value = "lng", required = false) Double lng,
            @RequestParam(value = "reporterId", required = false) String reporterId
    ) {
        log.info("POST /api/scanner/frame — session={}, gps={}/{}, reporterId={}", sessionId, lat, lng, reporterId);

        try {
            ScanResult result = reportService.processScan(image, sessionId, lat, lng, reporterId);

            if (result.isLocationRequired()) {
                // 202 Accepted — client must supply location via /location endpoint
                return ResponseEntity.status(HttpStatus.ACCEPTED).body(result);
            }
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Frame processing error: {}", e.getMessage(), e);
            ScanResult error = ScanResult.builder()
                    .sessionId(sessionId)
                    .potholeFound(false)
                    .criticalFound(false)
                    .message("Processing failed: " + e.getMessage())
                    .build();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    /**
     * POST /api/scanner/location
     *
     * Completes a previously started scan by supplying GPS coordinates when
     * none were available in the original frame request.
     *
     * @param reportId UUID string of the pending (skeleton) DamageReport
     * @param body     LocationRequest containing latitude and longitude
     * @return updated DamageReport with full AI analysis applied
     */
    @PostMapping("/location")
    public ResponseEntity<DamageReport> updateLocation(
            @RequestParam("reportId")  String reportId,
            @Valid @RequestBody         LocationRequest body
    ) {
        log.info("POST /api/scanner/location — reportId={}, lat={}, lng={}",
                 reportId, body.getLatitude(), body.getLongitude());
        try {
            DamageReport updated = reportService.updateLocation(reportId, body);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            log.warn("Location update failed: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Location update error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * POST /api/scanner/check
     *
     * Runs AI inference and severity classification on an uploaded image 
     * without persisting a DamageReport record.
     * Used for pre-submit verification of manually uploaded images.
     */
    @PostMapping(value = "/check", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ScanResult> check(
            @RequestPart("image") MultipartFile image
    ) {
        log.info("POST /api/scanner/check — analyzing uploaded image");
        try {
            ScanResult result = reportService.analyzeImage(image);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Check image error: {}", e.getMessage(), e);
            ScanResult error = ScanResult.builder()
                    .potholeFound(false)
                    .criticalFound(false)
                    .message("Verification analysis failed: " + e.getMessage())
                    .build();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
