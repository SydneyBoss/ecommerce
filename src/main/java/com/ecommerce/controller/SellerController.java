package com.ecommerce.controller;

import com.ecommerce.model.Product;
import com.ecommerce.model.Role;
import com.ecommerce.model.User;
import com.ecommerce.service.AuthService;
import com.ecommerce.service.SellerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/seller")
@CrossOrigin(origins = "*")
public class SellerController {

    private final SellerService sellerService;
    private final AuthService authService;

    @Autowired
    public SellerController(SellerService sellerService, AuthService authService) {
        this.sellerService = sellerService;
        this.authService = authService;
    }

    private Long resolveSellerId(Long requestedSellerId) {
        Optional<User> currentUser = authService.getCurrentAuthenticatedUser();
        if (currentUser.isEmpty()) {
            throw new IllegalStateException("Authentication required");
        }

        User user = currentUser.get();
        if (user.getRole() == Role.ROLE_ADMIN && requestedSellerId != null) {
            return requestedSellerId;
        }

        if (user.getRole() != Role.ROLE_SELLER && user.getRole() != Role.ROLE_ADMIN) {
            throw new SecurityException("User does not have seller permissions");
        }

        return user.getId();
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getSellerStats(@RequestParam(required = false) Long sellerId) {
        try {
            Long targetId = resolveSellerId(sellerId);
            Map<String, Object> stats = sellerService.getSellerDashboardStats(targetId);
            return ResponseEntity.ok(stats);
        } catch (IllegalStateException | SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", ex.getMessage()));
        }
    }

    @GetMapping("/products")
    public ResponseEntity<?> getSellerProducts(@RequestParam(required = false) Long sellerId) {
        try {
            Long targetId = resolveSellerId(sellerId);
            List<Product> products = sellerService.getSellerProducts(targetId);
            return ResponseEntity.ok(products);
        } catch (IllegalStateException | SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", ex.getMessage()));
        }
    }

    @GetMapping("/orders")
    public ResponseEntity<?> getSellerOrders(@RequestParam(required = false) Long sellerId) {
        try {
            Long targetId = resolveSellerId(sellerId);
            List<Map<String, Object>> history = sellerService.getSellerSellingHistory(targetId);
            return ResponseEntity.ok(history);
        } catch (IllegalStateException | SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", ex.getMessage()));
        }
    }
}
