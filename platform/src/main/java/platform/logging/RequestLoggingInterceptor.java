package platform.logging;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Component
public class RequestLoggingInterceptor implements HandlerInterceptor {

    private final JdbcTemplate jdbc;

    public RequestLoggingInterceptor(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute("reqStart", Instant.now());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse res, Object handler, Exception ex) {
        try {
            Instant start = (Instant) req.getAttribute("reqStart");
            int latency = start == null ? 0 : (int) Duration.between(start, Instant.now()).toMillis();
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();

            UUID userId = null;
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
                // we need to look up user id by email
                // do a tiny select to avoid loading JPA in interceptor:
                try {
                    userId = jdbc.query("select id from app_user where lower(email)=lower(?)",
                            ps -> ps.setString(1, auth.getName()),
                            rs -> rs.next() ? (UUID) rs.getObject(1) : null);
                } catch (Exception ignored) {}
            }

            UUID sessionId = null;
            Object sid = req.getSession(false) == null ? null : req.getSession(false).getAttribute("AUTH_SESSION_ID");
            if (sid instanceof UUID uuid) sessionId = uuid;

            jdbc.update(
                    "select public.log_interaction(?, ?, ?, ?, ?, ?::inet, ?, ?, ?, '{}'::jsonb, ?)",
                    userId,
                    sessionId,
                    req.getRequestURI(),
                    req.getMethod(),
                    res.getStatus(),
                    getClientIp(req),
                    req.getHeader("User-Agent"),
                    latency,
                    res.getHeader("Content-Length") == null ? 0 : Integer.parseInt(res.getHeader("Content-Length")),
                    ex != null
            );
        } catch (Exception ignore) {
            // swallow on purpose; logging must not break requests
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String h = request.getHeader("X-Forwarded-For");
        if (h != null && !h.isBlank()) return h.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
