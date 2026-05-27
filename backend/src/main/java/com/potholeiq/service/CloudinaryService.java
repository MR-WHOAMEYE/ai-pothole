package com.potholeiq.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.Map;

@Service
public class CloudinaryService {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryService.class);

    @Value("${cloudinary.cloud-name:}")
    private String cloudName;

    @Value("${cloudinary.api-key:}")
    private String apiKey;

    @Value("${cloudinary.api-secret:}")
    private String apiSecret;

    private Cloudinary cloudinary;

    @PostConstruct
    public void init() {
        if (cloudName.isEmpty() || apiKey.isEmpty() || apiSecret.isEmpty()) {
            log.warn("Cloudinary configuration values are missing! Uploads may fail.");
        }
        cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true
        ));
        log.info("CloudinaryService initialized successfully for cloud: {}", cloudName);
    }

    /**
     * Uploads an image file to Cloudinary under the specified folder.
     *
     * @param file   the local image file
     * @param folder target folder name, e.g., "potholeiq/images"
     * @return the secure URL of the uploaded image
     * @throws IOException if upload fails
     */
    public String uploadImage(File file, String folder) throws IOException {
        log.info("Cloudinary: Uploading image file of size {} bytes to folder {}", file.length(), folder);
        Map params = ObjectUtils.asMap(
                "folder", folder,
                "resource_type", "image"
        );
        Map uploadResult = cloudinary.uploader().upload(file, params);
        String url = (String) uploadResult.get("secure_url");
        log.info("Cloudinary: Image uploaded successfully. URL: {}", url);
        return url;
    }

    /**
     * Uploads image bytes directly from memory to Cloudinary.
     *
     * @param imageBytes image file byte content
     * @param folder     target folder name, e.g., "potholeiq/images"
     * @return the secure URL of the uploaded image
     * @throws IOException if upload fails
     */
    public String uploadImage(byte[] imageBytes, String folder) throws IOException {
        log.info("Cloudinary: Uploading image bytes of length {} to folder {}", imageBytes.length, folder);
        Map params = ObjectUtils.asMap(
                "folder", folder,
                "resource_type", "image"
        );
        Map uploadResult = cloudinary.uploader().upload(imageBytes, params);
        String url = (String) uploadResult.get("secure_url");
        log.info("Cloudinary: Image uploaded successfully. URL: {}", url);
        return url;
    }

    /**
     * Uploads a PDF document to Cloudinary with resource_type "raw" in complaints folder.
     *
     * @param pdfFile  the local PDF file
     * @param reportId UUID string of the associated DamageReport
     * @return the secure URL of the uploaded PDF
     * @throws IOException if upload fails
     */
    public String uploadPdf(File pdfFile, String reportId) throws IOException {
        String publicId = "complaint_" + reportId;
        log.info("Cloudinary: Uploading raw PDF file to folder potholeiq/complaints with public_id {}", publicId);
        
        Map params = ObjectUtils.asMap(
                "folder", "potholeiq/complaints",
                "public_id", publicId,
                "resource_type", "image"
        );
        
        Map uploadResult = cloudinary.uploader().upload(pdfFile, params);
        String url = (String) uploadResult.get("secure_url");
        log.info("Cloudinary: PDF uploaded successfully. URL: {}", url);
        return url;
    }
}
