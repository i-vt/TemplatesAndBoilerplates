package com.example.platform.controller;

import com.example.platform.model.User;
import com.example.platform.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
public class PageController {

    @Autowired
    private UserService userService;


    @GetMapping("/")
    public String redirectToIndex() {
        return "redirect:/index";  // Redirect root to /index
    }

    @GetMapping("/index")
    public String indexPage() {
        return "index";  // Renders the index.html template
    }

    @GetMapping("/home")
    public String home() {
        return "home";
    }


    @GetMapping("/public-page")
    public String publicPage() {
        return "public-page";  // Render the public-page.html template
    }

    @GetMapping("/private-page")
    public String privatePage() {
        return "private-page";
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @GetMapping("/register")
    public String showRegistrationForm(Model model) {
        model.addAttribute("user", new User());
        return "register";
    }

    @PostMapping("/register")
    public String registerUser(@Valid @ModelAttribute("user") User user, BindingResult result) {
        if (result.hasErrors()) {
            return "register";
        }
        userService.save(user);
        return "redirect:/login";
    }
}
