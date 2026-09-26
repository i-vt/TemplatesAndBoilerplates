package com.platform.example.repository;

import com.platform.example.model.UploadToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UploadTokenRepository extends JpaRepository<UploadToken, Long> {
    Optional<UploadToken> findByUuid(String uuid);
}
