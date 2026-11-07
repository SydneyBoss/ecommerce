package com.ecommerce.controller;

import com.ecommerce.dto.AuthRequest;
import com.ecommerce.dto.AuthResponse;
import com.ecommerce.dto.RegisterRequest;
import com.ecommerce.model.User;
import com.ecommerce.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    @Autowired
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            AuthResponse response = authService.register(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Registration failed: " + ex.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (BadCredentialsException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Collections.singletonMap("error", "Invalid email or password."));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", ex.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        return authService.getCurrentAuthenticatedUser()
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Collections.singletonMap("error", "Not authenticated")));
    }

    @GetMapping("/demo-accounts")
    public ResponseEntity<List<Map<String, String>>> getDemoAccounts() {
        List<Map<String, String>> accounts = Arrays.asList(
                createDemoEntry("Master Admin", "admin@nova.in", "admin123", "ROLE_ADMIN", "Full platform control & DB console"),
                createDemoEntry("Apex Tech India (Seller)", "seller1@nova.in", "seller123", "ROLE_SELLER", "Electronics & Gadgets merchant"),
                createDemoEntry("Nova Sound Hub (Seller)", "seller2@nova.in", "seller123", "ROLE_SELLER", "Audio & Lifestyle merchant"),
                createDemoEntry("Aarav Patel (Buyer)", "user1@nova.in", "user123", "ROLE_USER", "Regular shopper with orders"),
                createDemoEntry("Priya Sharma (Buyer)", "user2@nova.in", "user123", "ROLE_USER", "Shopper account")
        );
        return ResponseEntity.ok(accounts);
    }

    private Map<String, String> createDemoEntry(String label, String email, String password, String role, String description) {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("label", label);
        map.put("email", email);
        map.put("password", password);
        map.put("role", role);
        map.put("description", description);
        return map;
    }
}
