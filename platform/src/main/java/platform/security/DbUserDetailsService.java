package platform.security;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import platform.domain.AppUser;
import platform.domain.AppRole;
import platform.domain.UserRole;
import platform.repo.AppRoleRepository;
import platform.repo.AppUserRepository;
import platform.repo.UserRoleRepository;

import java.util.List;
import java.util.UUID;

@Service
public class DbUserDetailsService implements UserDetailsService {
    private final AppUserRepository users;
    private final UserRoleRepository userRoles;
    private final AppRoleRepository roles;

    public DbUserDetailsService(AppUserRepository users, UserRoleRepository userRoles, AppRoleRepository roles) {
        this.users = users;
        this.userRoles = userRoles;
        this.roles = roles;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        AppUser u = users.findByEmailIgnoreCase(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        if (!u.isActive()) {
            throw new UsernameNotFoundException("User inactive");
        }
        List<UserRole> urs = userRoles.findByUserId(u.getId());
        List<SimpleGrantedAuthority> auths = urs.stream()
                .map(ur -> roles.findById(ur.getRoleId()).map(AppRole::getName).orElse("USER"))
                .map(rn -> new SimpleGrantedAuthority("ROLE_" + rn))
                .toList();

        return User.withUsername(u.getEmail())
                .password(u.getPasswordHash())
                .authorities(auths)
                .accountLocked(false)
                .disabled(!u.isActive())
                .build();
    }
}
