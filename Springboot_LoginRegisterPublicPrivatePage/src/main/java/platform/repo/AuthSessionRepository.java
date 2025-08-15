package platform.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import platform.domain.AuthSession;

import java.util.Optional;
import java.util.UUID;

public interface AuthSessionRepository extends JpaRepository<AuthSession, UUID> {
    Optional<AuthSession> findById(UUID id);
}
