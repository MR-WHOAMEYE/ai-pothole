package com.potholeiq.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * PriorityScoreDto — lightweight summary of a report's scoring for sorting / dispatch.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PriorityScoreDto {

    private String reportId;

    private String severity;

    /** Hex colour code corresponding to the severity level */
    private String color;

    /** Composite priority score [0.0 – 100.0] */
    private double priorityScore;

    /** Estimated pothole depth in centimetres */
    private double estimatedDepthCm;

    /** Human-readable street address */
    private String address;
}
