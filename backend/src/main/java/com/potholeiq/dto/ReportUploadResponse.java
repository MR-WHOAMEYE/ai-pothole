package com.potholeiq.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ReportUploadResponse — returned by POST /api/reports/upload.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportUploadResponse {

    /** UUID string of the created/updated DamageReport */
    private String reportId;

    /** Whether GPS coordinates were found (from request params or EXIF) */
    private boolean gpsFound;

    /**
     * Whether the client needs to submit location separately.
     * True when gpsFound=false.
     */
    @Builder.Default
    private boolean locationRequired = false;

    /** HTTP-level status label (e.g. "CREATED", "ACCEPTED") */
    private String status;

    /** Human-readable message */
    private String message;
}
