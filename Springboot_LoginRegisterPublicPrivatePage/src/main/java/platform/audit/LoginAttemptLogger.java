package platform.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class LoginAttemptLogger {
    private final JdbcTemplate jdbc;

    public LoginAttemptLogger(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void logAttempt(String email, UUID userId, boolean success, String ip, String userAgent, String error) {
        jdbc.update(
            // ip is inet; cast from text
            "INSERT INTO login_attempt(user_id, email, success, ip, user_agent, error) " +
            "VALUES (?, ?, ?, ?::inet, ?, ?)",
            userId, email, success, ip, userAgent, error
        );
    }
}
