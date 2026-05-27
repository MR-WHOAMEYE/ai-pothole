package com.potholeiq.service;

import com.drew.imaging.ImageMetadataReader;
import com.drew.metadata.Metadata;
import com.drew.metadata.exif.GpsDirectory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * ExifExtractorService — extracts GPS coordinates from image EXIF metadata
 * using the metadata-extractor library.
 */
@Service
public class ExifExtractorService {

    private static final Logger log = LoggerFactory.getLogger(ExifExtractorService.class);

    /**
     * Immutable value object returned by extract().
     */
    public record GpsData(Double latitude, Double longitude, boolean found) {
        public static GpsData notFound() {
            return new GpsData(null, null, false);
        }
    }

    /**
     * Attempts to read GPS coordinates from the image EXIF data.
     *
     * @param file the uploaded multipart image file
     * @return GpsData with found=true and lat/lng when GPS tags are present;
     *         GpsData.notFound() otherwise
     */
    public GpsData extract(MultipartFile file) {
        try {
            Metadata metadata = ImageMetadataReader.readMetadata(file.getInputStream());
            GpsDirectory gpsDirectory = metadata.getFirstDirectoryOfType(GpsDirectory.class);

            if (gpsDirectory != null) {
                com.drew.lang.GeoLocation geoLocation = gpsDirectory.getGeoLocation();
                if (geoLocation != null && !geoLocation.isZero()) {
                    double lat = geoLocation.getLatitude();
                    double lng = geoLocation.getLongitude();
                    log.info("EXIF GPS extracted: lat={}, lng={}", lat, lng);
                    return new GpsData(lat, lng, true);
                }
            }

            log.debug("No GPS data found in EXIF for file: {}", file.getOriginalFilename());
        } catch (Exception e) {
            log.warn("Failed to extract EXIF GPS from {}: {}", file.getOriginalFilename(), e.getMessage());
        }
        return GpsData.notFound();
    }
}
