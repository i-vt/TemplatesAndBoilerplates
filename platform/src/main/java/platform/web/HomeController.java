package platform.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping("/")
    public String publicHome(Model model, @AuthenticationPrincipal UserDetails user) {
        model.addAttribute("user", user);
        return "public";
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model, @AuthenticationPrincipal UserDetails user) {
        model.addAttribute("user", user);
        return "dashboard";
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }
}
