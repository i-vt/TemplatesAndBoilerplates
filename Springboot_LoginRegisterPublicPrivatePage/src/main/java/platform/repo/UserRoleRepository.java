package platform.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import platform.domain.UserRole;

import java.util.List;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRole, UserRole.Pk> {
    List<UserRole> findByUserId(UUID userId);
}
