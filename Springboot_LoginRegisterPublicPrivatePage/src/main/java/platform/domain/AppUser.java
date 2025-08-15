package platform.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "email", nullable = false, unique = true, columnDefinition = "citext")
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID(); // OK: DB also has default; setting here avoids extra round-trip
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // getters/setters

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public OffsetDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(OffsetDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
