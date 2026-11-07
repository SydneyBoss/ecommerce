package com.ecommerce.controller;

import com.ecommerce.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminDirectoryController {

    private final AdminService adminService;

    @Autowired
    public AdminDirectoryController(AdminService adminService) {
        this.adminService = adminService;
    }

    /**
     * List all sellers with product metrics and earnings
     */
    @GetMapping("/sellers")
    public ResponseEntity<List<Map<String, Object>>> getAllSellers() {
        return ResponseEntity.ok(adminService.getAllSellersDirectory());
    }

    /**
     * Inspect specific seller: profile, listed products, and selling history
     */
    @GetMapping("/sellers/{id}")
    public ResponseEntity<?> getSellerDetails(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(adminService.getSellerDetails(id));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", ex.getMessage()));
        }
    }

    /**
     * List all buyers/users with total spend and order counts
     */
    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsersDirectory());
    }

    /**
     * Inspect specific user: profile and complete buying history
     */
    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserDetails(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(adminService.getUserDetails(id));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", ex.getMessage()));
        }
    }
}
