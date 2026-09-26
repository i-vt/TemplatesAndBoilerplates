package com.platform.example.controller;

import com.platform.example.model.UploadToken;
import com.platform.example.repository.UploadTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/upload")
public class FileUploadController {

    private static final String UPLOAD_DIRECTORY = "uploads/";

    @Autowired
    private UploadTokenRepository uploadTokenRepository;

    @PostMapping
    public ResponseEntity<String> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("uuid") String uuid) {

        // Check if the UUID exists and is valid (not used)
        Optional<UploadToken> tokenOptional = uploadTokenRepository.findByUuid(uuid);

        if (tokenOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Invalid or non-existent UUID.");
        }

        UploadToken token = tokenOptional.get();

        if (token.isUsed()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("UUID has already been used.");
        }

        if (file.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("No file selected for uploading.");
        }

        try {
            // Create directories if they don't exist
            Path directory = Paths.get(UPLOAD_DIRECTORY);
            if (!Files.exists(directory)) {
                Files.createDirectories(directory);
            }

            // Get the file name and copy it to the target location
            Path filePath = directory.resolve(file.getOriginalFilename());
            Files.copy(file.getInputStream(), filePath);

            // Mark the UUID as used
            token.setUsed(true);
            uploadTokenRepository.save(token);

            return ResponseEntity.status(HttpStatus.OK)
                    .body("File uploaded successfully: " + file.getOriginalFilename());

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to upload file: " + e.getMessage());
        }
    }
}
