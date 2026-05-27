package com.potholeiq.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

/**
 * ImageStorageService — handles saving uploaded MultipartFiles to the local filesystem.
 * Files are stored at ./uploads/images/ and served via the /uploads/** static handler.
 */
@Service
public class ImageStorageService {

    private static final Logger log = LoggerFactory.getLogger(ImageStorageService.class);

    @Value("${app.upload.dir:./uploads/images/}")
    private String uploadDir;

    /**
     * Saves a MultipartFile to disk with a UUID-based filename.
     *
     * @param file the uploaded multipart file
     * @return relative URL path, e.g. "/uploads/images/uuid.jpg"
     * @throws IOException if writing fails
     */
    public String save(MultipartFile file) throws IOException {
        ensureDirectoryExists(uploadDir);

        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename);
        String filename = UUID.randomUUID() + extension;

        Path destination = Paths.get(uploadDir).toAbsolutePath().normalize().resolve(filename);
        file.transferTo(destination.toFile());

        log.info("Image saved: {}", destination);
        return "/uploads/images/" + filename;
    }

    /**
     * Saves a MultipartFile to a specific subdirectory (e.g. for before/after crew images).
     *
     * @param file   the uploaded multipart file
     * @param subDir sub-directory relative to the base upload dir (e.g. "crew/")
     * @return relative URL path
     * @throws IOException if writing fails
     */
    public String saveToSubDir(MultipartFile file, String subDir) throws IOException {
        String targetDir = "./uploads/" + subDir + "/";
        ensureDirectoryExists(targetDir);

        String extension = getExtension(file.getOriginalFilename());
        String filename  = UUID.randomUUID() + extension;
        Path destination = Paths.get(targetDir).toAbsolutePath().normalize().resolve(filename);
        file.transferTo(destination.toFile());

        log.info("Image saved to {}: {}", subDir, destination);
        return "/uploads/" + subDir + "/" + filename;
    }

    /** Returns the absolute filesystem path corresponding to a relative URL. */
    public String toAbsolutePath(String relativeUrl) {
        // relativeUrl: /uploads/images/uuid.jpg → ./uploads/images/uuid.jpg
        String filePath = "." + relativeUrl;
        return Paths.get(filePath).toAbsolutePath().normalize().toString();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void ensureDirectoryExists(String dirPath) throws IOException {
        Path dir = Paths.get(dirPath).toAbsolutePath().normalize();
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
            log.info("Created directory: {}", dir);
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return ".jpg"; // default to jpg
        }
        return filename.substring(filename.lastIndexOf('.'));
    }
}
