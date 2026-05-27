package com.potholeiq.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * GeoJsonFeature — represents a single GeoJSON Feature object for admin map endpoints.
 * The AdminController wraps a list of these in a GeoJSON FeatureCollection.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GeoJsonFeature {

    @Builder.Default
    private String type = "Feature";

    /** GeoJSON geometry: { "type": "Point", "coordinates": [lng, lat] } */
    private Map<String, Object> geometry;

    /** Feature properties: id, severity, status, address, score, color */
    private Map<String, Object> properties;

    /**
     * Factory method — builds a GeoJsonFeature from raw field values.
     */
    public static GeoJsonFeature of(
            String id,
            double lat,
            double lng,
            String severity,
            String status,
            String address,
            double score,
            String color
    ) {
        Map<String, Object> geom = new HashMap<>();
        geom.put("type", "Point");
        geom.put("coordinates", List.of(lng, lat)); // GeoJSON uses [longitude, latitude]

        Map<String, Object> props = new HashMap<>();
        props.put("id",       id);
        props.put("severity", severity);
        props.put("status",   status);
        props.put("address",  address);
        props.put("score",    score);
        props.put("color",    color);

        return GeoJsonFeature.builder()
                .geometry(geom)
                .properties(props)
                .build();
    }
}
