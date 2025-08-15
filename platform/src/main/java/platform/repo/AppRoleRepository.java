package platform.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import platform.domain.AppRole;

import java.util.Optional;

public interface AppRoleRepository extends JpaRepository<AppRole, Short> {
    Optional<AppRole> findByName(String name);
}
