package com.platform.example.config;

import com.platform.example.model.UploadToken;
import com.platform.example.repository.UploadTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Configuration
public class DataInitializer {

    @Autowired
    private UploadTokenRepository uploadTokenRepository;

    @EventListener(ApplicationReadyEvent.class)  // Trigger when the app is fully initialized
    public void initializeData() {
        List<UploadToken> tokens = IntStream.range(0, 15) //Generate 15 tokens
                .mapToObj(i -> new UploadToken())
                .peek(token -> uploadTokenRepository.save(token))
                .collect(Collectors.toList());

        System.out.println("Initialized tokens: ");
        tokens.forEach(token -> System.out.println("UUID: " + token.getUuid()));
    }
}
