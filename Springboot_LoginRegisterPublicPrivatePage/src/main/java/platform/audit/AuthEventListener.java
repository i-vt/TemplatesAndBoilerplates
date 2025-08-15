package platform.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.ApplicationListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import platform.domain.AppUser;
import platform.repo.AppUserRepository;

import java.util.Optional;
import java.util.UUID;

@Component
public class AuthEventListener implements
        ApplicationListener<AuthenticationSuccessEvent> {

    private final AppUserRepository users;
    private final LoginAttemptLogger attempts;

    public AuthEventListener(AppUserRepository users, LoginAttemptLogger attempts) {
        this.users = users;
        this.attempts = attempts;
    }

    // --- Success ---
    @Override
    public void onApplicationEvent(AuthenticationSuccessEvent event) {
        Authentication auth = event.getAuthentication();
        String email = auth.getName();
        HttpServletRequest req = currentRequest();
        String ip = clientIp(req);
        String ua = req != null ? req.getHeader("User-Agent") : "N/A";

        Optional<AppUser> u = users.findByEmailIgnoreCase(email);
        UUID userId = u.map(AppUser::getId).orElse(null);

        attempts.logAttempt(email, userId, true, ip, ua, null);
    }

    // --- Failure ---
    @Component
    public static class FailureListener implements ApplicationListener<AbstractAuthenticationFailureEvent> {
        private final AppUserRepository users;
        private final LoginAttemptLogger attempts;

        public FailureListener(AppUserRepository users, LoginAttemptLogger attempts) {
            this.users = users;
            this.attempts = attempts;
        }

        @Override
        public void onApplicationEvent(AbstractAuthenticationFailureEvent event) {
            Authentication auth = event.getAuthentication();
            String email = auth != null ? auth.getName() : null;

            HttpServletRequest req = currentRequest();
            String ip = clientIp(req);
            String ua = req != null ? req.getHeader("User-Agent") : "N/A";

            UUID userId = null;
            if (email != null) {
                users.findByEmailIgnoreCase(email).ifPresent(u -> {
                    // capture userId if it exists (failed due to bad password, etc.)
                });
                Optional<AppUser> u = users.findByEmailIgnoreCase(email);
                if (u.isPresent()) userId = u.get().getId();
            }

            String errorMsg = event.getException() != null ? event.getException().getMessage() : null;
            attempts.logAttempt(email, userId, false, ip, ua, errorMsg);
        }
    }

    // --- Helpers shared by both listeners ---
    private static HttpServletRequest currentRequest() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes sra) return sra.getRequest();
        return null;
    }

    private static String clientIp(HttpServletRequest req) {
        if (req == null) return null;
        String h = req.getHeader("X-Forwarded-For");
        if (h != null && !h.isBlank()) return h.split(",")[0].trim();
        return req.getRemoteAddr();
    }
}
