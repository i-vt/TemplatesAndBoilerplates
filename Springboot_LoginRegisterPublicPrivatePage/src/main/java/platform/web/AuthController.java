package platform.web;

import jakarta.validation.Valid;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import platform.domain.AppRole;
import platform.domain.AppUser;
import platform.domain.UserRole;
import platform.repo.AppRoleRepository;
import platform.repo.AppUserRepository;
import platform.repo.UserRoleRepository;
import platform.web.dto.RegisterForm;

import java.util.UUID;

@Controller
public class AuthController {

    private final AppUserRepository users;
    private final AppRoleRepository roles;
    private final UserRoleRepository userRoles;
    private final PasswordEncoder encoder;

    public AuthController(AppUserRepository users, AppRoleRepository roles, UserRoleRepository userRoles, PasswordEncoder encoder) {
        this.users = users;
        this.roles = roles;
        this.userRoles = userRoles;
        this.encoder = encoder;
    }

    @GetMapping("/register")
    public String showRegister(Model model) {
        model.addAttribute("form", new RegisterForm());
        return "register";
    }

    @PostMapping("/register")
    @Transactional
    public String doRegister(@Valid @ModelAttribute("form") RegisterForm form, BindingResult binding, Model model) {
        if (users.existsByEmailIgnoreCase(form.getEmail())) {
            binding.rejectValue("email", "exists", "Email already registered");
        }
        if (binding.hasErrors()) {
            return "register";
        }

        AppUser u = new AppUser();
        u.setId(UUID.randomUUID());
        u.setEmail(form.getEmail());
        u.setDisplayName(form.getDisplayName());
        u.setPasswordHash(encoder.encode(form.getPassword()));
        u.setActive(true);
        users.save(u);

        // ensure a role "USER" exists, then assign
        AppRole role = roles.findByName("USER").orElseGet(() -> {
            AppRole r = new AppRole();
            r.setName("USER");
            r.setDescription("Default user");
            return roles.save(r);
        });
        userRoles.save(new UserRole(u.getId(), role.getId()));

        model.addAttribute("registeredEmail", u.getEmail());
        return "redirect:/login?registered";
    }
}
