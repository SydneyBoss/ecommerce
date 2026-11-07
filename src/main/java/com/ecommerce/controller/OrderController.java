package com.ecommerce.controller;

import com.ecommerce.dto.OrderRequest;
import com.ecommerce.dto.OrderResponse;
import com.ecommerce.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*")
public class OrderController {

    private final OrderService orderService;
    private final com.ecommerce.service.AuthService authService;

    @Autowired
    public OrderController(OrderService orderService, com.ecommerce.service.AuthService authService) {
        this.orderService = orderService;
        this.authService = authService;
    }

    @GetMapping("/my-orders")
    public ResponseEntity<?> getMyOrders() {
        return authService.getCurrentAuthenticatedUser()
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(orderService.getUserOrders(user.getId())))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Collections.singletonMap("error", "Please sign in to view your orders")));
    }

    @PostMapping
    public ResponseEntity<?> placeOrder(@Valid @RequestBody OrderRequest request) {
        try {
            OrderResponse response = orderService.createOrder(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Failed to process order: " + ex.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> getAllOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    @GetMapping("/{orderNumber}")
    public ResponseEntity<?> getOrderByOrderNumber(@PathVariable String orderNumber) {
        return orderService.getOrderByNumber(orderNumber)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Collections.singletonMap("error", "Order not found with number: " + orderNumber)));
    }

    @PatchMapping("/{orderNumber}/status")
    public ResponseEntity<?> updateOrderStatus(
            @PathVariable String orderNumber,
            @RequestBody Map<String, String> body) {
        try {
            String statusStr = body.get("status");
            if (statusStr == null || statusStr.isBlank()) {
                return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Status is required"));
            }
            com.ecommerce.model.OrderStatus status = com.ecommerce.model.OrderStatus.valueOf(statusStr.toUpperCase());
            OrderResponse updated = orderService.updateOrderStatus(orderNumber, status);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @GetMapping("/stats/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(orderService.getDashboardStats());
    }
}
