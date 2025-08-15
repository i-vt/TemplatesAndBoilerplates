package platform.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import org.springframework.stereotype.Component;
import platform.domain.AppUser;
import platform.domain.AuthSession;
import platform.repo.AppUserRepository;
import platform.repo.AuthSessionRepository;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@Component
public class SessionHandlers {

    private final AppUserRepository users;
    private final AuthSessionRepository sessions;

    public SessionHandlers(AppUserRepository users, AuthSessionRepository sessions) {
        this.users = users;
        this.sessions = sessions;
    }

    public AuthenticationSuccessHandler authenticationSuccessHandler() {
        return (request, response, authentication) -> {
            String email = authentication.getName();
            Optional<AppUser> opt = users.findByEmailIgnoreCase(email);
            if (opt.isPresent()) {
                AppUser u = opt.get();
                u.setLastLoginAt(OffsetDateTime.now());
                users.save(u);

                AuthSession s = new AuthSession();
                s.setUserId(u.getId());
                s.setIp(getClientIp(request));
                s.setUserAgent(Optional.ofNullable(request.getHeader("User-Agent")).orElse("N/A"));
                s.setCreatedAt(OffsetDateTime.now());
                s.setLastSeenAt(OffsetDateTime.now());
                s.setExpiresAt(OffsetDateTime.now().plus(30, ChronoUnit.MINUTES));
                sessions.save(s);

                request.getSession(true).setAttribute("AUTH_SESSION_ID", s.getId());
            }

            response.sendRedirect("/dashboard");
        };
    }

    public AuthenticationFailureHandler authenticationFailureHandler() {
        return (request, response, exception) -> response.sendRedirect("/login?error");
    }

    public LogoutSuccessHandler logoutSuccessHandler() {
        return (request, response, authentication) -> {
            Object sid = request.getSession(false) == null ? null : request.getSession(false).getAttribute("AUTH_SESSION_ID");
            if (sid instanceof UUID uuid) {
                sessions.findById(uuid).ifPresent(s -> {
                    s.setRevokedAt(OffsetDateTime.now());
                    sessions.save(s);
                });
            }
            if (request.getSession(false) != null) {
                request.getSession(false).invalidate();
            }
            response.sendRedirect("/");
        };
    }

    private String getClientIp(HttpServletRequest request) {
        String h = request.getHeader("X-Forwarded-For");
        if (h != null && !h.isBlank()) return h.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
