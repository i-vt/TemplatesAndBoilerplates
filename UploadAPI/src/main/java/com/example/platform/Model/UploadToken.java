package com.platform.example.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.util.UUID;

@Entity
public class UploadToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String uuid;

    private boolean isUsed;

    public UploadToken() {
        this.uuid = UUID.randomUUID().toString();
        this.isUsed = false;
    }

    public Long getId() {
        return id;
    }

    public String getUuid() {
        return uuid;
    }

    public boolean isUsed() {
        return isUsed;
    }

    public void setUsed(boolean used) {
        isUsed = used;
    }
}
