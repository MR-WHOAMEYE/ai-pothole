package com.potholeiq.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * LocationService — reverse geocodes GPS coordinates to street addresses
 * using the Nominatim OpenStreetMap API.
 *
 * Results are cached in-memory (ConcurrentHashMap) to avoid redundant API calls
 * for identical or very close coordinates.
 */
@Service
public class LocationService {

    private static final Logger log = LoggerFactory.getLogger(LocationService.class);

    private static final String NOMINATIM_URL =
            "https://nominatim.openstreetmap.org/reverse?format=json&lat=%s&lon=%s&zoom=18&addressdetails=1";

    /** Simple in-process cache keyed by "lat:lng" rounded to 4 decimal places (~11m precision) */
    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Reverse geocodes a coordinate pair to a human-readable address.
     *
     * @param lat latitude
     * @param lng longitude
     * @return street address string, or a fallback "Lat: x, Lng: y" string on failure
     */
    public String reverseGeocode(double lat, double lng) {
        String cacheKey = String.format("%.4f:%.4f", lat, lng);
        return cache.computeIfAbsent(cacheKey, k -> fetchAddress(lat, lng));
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private String fetchAddress(double lat, double lng) {
        try {
            String url = String.format(NOMINATIM_URL, lat, lng);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    // Nominatim requires a User-Agent identifying the application
                    .header("User-Agent", "PotholeIQ/1.0 (capstone-project)")
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());

                // Prefer display_name (full address); fall back to composing from parts
                String displayName = root.path("display_name").asText(null);
                if (displayName != null && !displayName.isBlank()) {
                    // Shorten: take the first 3 comma-separated parts
                    String[] parts = displayName.split(",");
                    StringBuilder shortened = new StringBuilder();
                    int limit = Math.min(parts.length, 4);
                    for (int i = 0; i < limit; i++) {
                        if (i > 0) shortened.append(",");
                        shortened.append(parts[i].trim());
                    }
                    log.info("Geocoded ({}, {}) → {}", lat, lng, shortened);
                    return shortened.toString();
                }

                // Fallback: compose from address sub-fields
                JsonNode addr = root.path("address");
                return composeFromFields(addr, lat, lng);
            } else {
                log.warn("Nominatim returned HTTP {}", response.statusCode());
            }
        } catch (Exception e) {
            log.warn("Reverse geocode failed for ({}, {}): {}", lat, lng, e.getMessage());
        }
        return fallback(lat, lng);
    }

    private String composeFromFields(JsonNode addr, double lat, double lng) {
        if (addr.isMissingNode()) return fallback(lat, lng);

        StringBuilder sb = new StringBuilder();
        appendIfPresent(sb, addr, "road");
        appendIfPresent(sb, addr, "suburb");
        appendIfPresent(sb, addr, "city");
        appendIfPresent(sb, addr, "state");
        appendIfPresent(sb, addr, "country");

        return sb.length() > 0 ? sb.toString() : fallback(lat, lng);
    }

    private void appendIfPresent(StringBuilder sb, JsonNode node, String field) {
        String val = node.path(field).asText(null);
        if (val != null && !val.isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(val.trim());
        }
    }

    private String fallback(double lat, double lng) {
        return String.format("Lat: %.5f, Lng: %.5f", lat, lng);
    }
}
