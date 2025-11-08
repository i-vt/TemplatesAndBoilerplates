package platform.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "app_role")
public class AppRole {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id") // smallint
    private Short id;

    @Column(name = "name", nullable = false, unique = true)
    private String name; // e.g., "USER", "ADMIN"

    @Column(name = "description")
    private String description;

    public Short getId() { return id; }
    public void setId(Short id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
