package com.potholeiq.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * ScanResult — the top-level response returned by POST /api/scanner/frame.
 * Summarises whether potholes were found and includes the list of individual detections.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScanResult {

    /** Scanner session identifier provided by the client */
    private String sessionId;

    /** True if at least one pothole was detected above the confidence threshold */
    private boolean potholeFound;

    /** True if any detection was classified as CRITICAL */
    private boolean criticalFound;

    /** Detailed list of individual detections (one per pothole bbox) */
    private List<DetectionDto> detections;

    /**
     * True when no GPS coordinates were found (neither in request params nor EXIF).
     * When true, the client must call POST /api/scanner/location with the reportId.
     */
    @Builder.Default
    private boolean locationRequired = false;

    /**
     * The UUID of the saved DamageReport — populated even when locationRequired=true
     * so the client knows which report to update later.
     */
    private String reportId;

    /** Human-readable message for the client UI */
    private String message;
}
