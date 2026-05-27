package com.potholeiq.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DetectionDto — represents a single pothole detection result from the AI model.
 * Returned as part of ScanResult for each detected pothole in the image.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DetectionDto {

    /** Bounding box — top-left X in original image pixels */
    private int bboxX;

    /** Bounding box — top-left Y in original image pixels */
    private int bboxY;

    /** Bounding box width in original image pixels */
    private int bboxWidth;

    /** Bounding box height in original image pixels */
    private int bboxHeight;

    /** ONNX model confidence score [0.0 – 1.0] */
    private double confidenceScore;

    /** Severity classification: MINOR | MODERATE | CRITICAL */
    private String severity;

    /** Hex colour for the severity level, e.g. #F44336 for CRITICAL */
    private String severityColor;

    /** Composite priority score [0.0 – 100.0] */
    private double priorityScore;

    /** Estimated pothole depth in centimetres */
    private double estimatedDepthCm;

    /** Human-readable street address (from reverse geocoding) */
    private String streetAddress;

    /** GPS latitude */
    private Double latitude;

    /** GPS longitude */
    private Double longitude;

    /** UUID of the saved DamageReport entity (if persisted) */
    private String reportId;
}
