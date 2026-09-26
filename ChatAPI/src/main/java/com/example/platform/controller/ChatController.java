package com.example.platform.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.example.platform.model.Message;

import java.util.ArrayList;
import java.util.List;

@RestController
public class ChatController {
    private final List<Message> messages = new ArrayList<>();

    @GetMapping("/messages")
    public List<Message> getMessages() {
        return messages;
    }

    @PostMapping("/messages")
    public Message postMessage(@RequestBody Message message) {
        messages.add(message);
        return message;
    }
}
