package platform.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "user_role")
@IdClass(UserRole.Pk.class)
public class UserRole {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Id
    @Column(name = "role_id", nullable = false)
    private Short roleId;

    public static class Pk implements Serializable {
        private UUID userId;
        private Short roleId;

        public Pk() {}
        public Pk(UUID userId, Short roleId) { this.userId = userId; this.roleId = roleId; }

        @Override public int hashCode() { return (userId==null?0:userId.hashCode()) ^ (roleId==null?0:roleId.hashCode()); }
        @Override public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Pk pk)) return false;
            return java.util.Objects.equals(userId, pk.userId) && java.util.Objects.equals(roleId, pk.roleId);
        }
    }

    public UserRole() {}
    public UserRole(UUID userId, Short roleId) { this.userId = userId; this.roleId = roleId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public Short getRoleId() { return roleId; }
    public void setRoleId(Short roleId) { this.roleId = roleId; }
}
