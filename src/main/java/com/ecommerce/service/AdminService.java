package com.ecommerce.service;

import com.ecommerce.model.Order;
import com.ecommerce.model.OrderItem;
import com.ecommerce.model.Product;
import com.ecommerce.model.Role;
import com.ecommerce.model.User;
import com.ecommerce.repository.OrderItemRepository;
import com.ecommerce.repository.OrderRepository;
import com.ecommerce.repository.ProductRepository;
import com.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AdminService {

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final SellerService sellerService;

    @Autowired
    public AdminService(UserRepository userRepository,
                        ProductRepository productRepository,
                        OrderRepository orderRepository,
                        OrderItemRepository orderItemRepository,
                        SellerService sellerService) {
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.sellerService = sellerService;
    }

    /**
     * Directory of all registered sellers with their product metrics and total sales.
     */
    public List<Map<String, Object>> getAllSellersDirectory() {
        List<User> sellers = userRepository.findByRoleOrderByCreatedAtDesc(Role.ROLE_SELLER);
        List<Map<String, Object>> result = new ArrayList<>();

        for (User s : sellers) {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("id", s.getId());
            summary.put("name", s.getName());
            summary.put("email", s.getEmail());
            summary.put("storeName", s.getStoreName() != null ? s.getStoreName() : s.getName() + " Store");
            summary.put("phone", s.getPhone());
            summary.put("city", s.getCity());
            summary.put("state", s.getState());
            summary.put("createdAt", s.getCreatedAt());

            Map<String, Object> stats = sellerService.getSellerDashboardStats(s.getId());
            summary.put("totalProducts", stats.get("totalProducts"));
            summary.put("totalUnitsSold", stats.get("totalUnitsSold"));
            summary.put("totalRevenue", stats.get("totalRevenue"));
            summary.put("totalOrdersCount", stats.get("totalOrdersCount"));

            result.add(summary);
        }

        return result;
    }

    /**
     * Deep inspection of a single seller: profile, all listed products, and complete selling history.
     */
    public Map<String, Object> getSellerDetails(Long sellerId) {
        User seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new IllegalArgumentException("Seller not found with ID: " + sellerId));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("seller", seller);
        details.put("stats", sellerService.getSellerDashboardStats(sellerId));
        details.put("products", productRepository.findBySellerId(sellerId));
        details.put("sellingHistory", sellerService.getSellerSellingHistory(sellerId));

        return details;
    }

    /**
     * Directory of all registered buyers/users with total spend and buying activity.
     */
    public List<Map<String, Object>> getAllUsersDirectory() {
        List<User> users = userRepository.findByRoleOrderByCreatedAtDesc(Role.ROLE_USER);
        List<Map<String, Object>> result = new ArrayList<>();

        for (User u : users) {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("id", u.getId());
            summary.put("name", u.getName());
            summary.put("email", u.getEmail());
            summary.put("phone", u.getPhone());
            summary.put("city", u.getCity());
            summary.put("state", u.getState());
            summary.put("createdAt", u.getCreatedAt());

            List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(u.getId());
            summary.put("totalOrders", orders.size());

            BigDecimal totalSpent = orders.stream()
                    .map(Order::getTotalAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            summary.put("totalSpent", totalSpent);

            summary.put("lastOrderDate", orders.isEmpty() ? null : orders.get(0).getCreatedAt());

            result.add(summary);
        }

        return result;
    }

    /**
     * Deep inspection of a single user: profile and complete buying history.
     */
    public Map<String, Object> getUserDetails(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + userId));

        List<Order> buyingHistory = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);

        BigDecimal totalSpent = buyingHistory.stream()
                .map(Order::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("user", user);
        details.put("totalOrders", buyingHistory.size());
        details.put("totalSpent", totalSpent);
        details.put("buyingHistory", buyingHistory);

        return details;
    }
}
