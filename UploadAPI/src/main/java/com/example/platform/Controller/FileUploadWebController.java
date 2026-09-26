package com.platform.example.controller;

import com.platform.example.model.UploadToken;
import com.platform.example.repository.UploadTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;

import java.util.Optional;

@Controller
@RequestMapping("/web")
public class FileUploadWebController {

    private static final String UPLOAD_DIRECTORY = "uploads/";

    @Autowired
    private UploadTokenRepository uploadTokenRepository;

    @GetMapping("/upload")
    public String showUploadForm() {
        return "upload";
    }

    @PostMapping("/upload")
    public String handleFileUpload(@RequestParam("file") MultipartFile file,
                                   @RequestParam("uuid") String uuid,
                                   Model model) {

        Optional<UploadToken> tokenOptional = uploadTokenRepository.findByUuid(uuid);

        if (tokenOptional.isEmpty()) {
            model.addAttribute("message", "Invalid or non-existent UUID.");
            return "upload";
        }

        UploadToken token = tokenOptional.get();

        if (token.isUsed()) {
            model.addAttribute("message", "UUID has already been used.");
            return "upload";
        }

        if (file.isEmpty()) {
            model.addAttribute("message", "Please select a file to upload.");
            return "upload";
        }

        try {
            Path uploadPath = Paths.get(UPLOAD_DIRECTORY);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            Path filePath = uploadPath.resolve(file.getOriginalFilename());
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            token.setUsed(true);
            uploadTokenRepository.save(token);

            model.addAttribute("message", "File uploaded successfully: " + file.getOriginalFilename());
        } catch (IOException e) {
            model.addAttribute("message", "Failed to upload file: " + e.getMessage());
        }

        return "upload";
    }
}
