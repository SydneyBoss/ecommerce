package com.ecommerce.service;

import com.ecommerce.dto.OrderItemRequest;
import com.ecommerce.dto.OrderRequest;
import com.ecommerce.dto.OrderResponse;
import com.ecommerce.model.Order;
import com.ecommerce.model.OrderItem;
import com.ecommerce.model.OrderStatus;
import com.ecommerce.model.Product;
import com.ecommerce.model.User;
import com.ecommerce.repository.OrderRepository;
import com.ecommerce.repository.ProductRepository;
import com.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final AuthService authService;

    @Autowired
    public OrderService(OrderRepository orderRepository,
                        ProductRepository productRepository,
                        UserRepository userRepository,
                        AuthService authService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.authService = authService;
    }

    public OrderResponse createOrder(OrderRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("Order must contain at least one item.");
        }

        Order order = new Order();
        order.setOrderNumber(generateOrderNumber());

        // Associate with buyer user if authenticated or matched by email
        Optional<User> currentUser = authService.getCurrentAuthenticatedUser();
        if (currentUser.isPresent()) {
            order.setUser(currentUser.get());
        } else if (request.getCustomerEmail() != null && !request.getCustomerEmail().isBlank()) {
            userRepository.findByEmail(request.getCustomerEmail().trim().toLowerCase())
                    .ifPresent(order::setUser);
        }

        order.setCustomerName(request.getCustomerName());
        order.setCustomerEmail(request.getCustomerEmail());
        order.setCustomerPhone(request.getCustomerPhone());
        order.setShippingAddress(request.getShippingAddress());
        order.setArea(request.getArea());
        order.setCity(request.getCity());
        order.setState(request.getState());
        order.setPostalCode(request.getPostalCode());
        order.setCountry(request.getCountry() != null && !request.getCountry().isBlank() ? request.getCountry() : "India");
        order.setLatitude(request.getLatitude());
        order.setLongitude(request.getLongitude());
        order.setPaymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod() : "UPI");
        if (request.getPaymentStatus() != null && !request.getPaymentStatus().isBlank()) {
            order.setPaymentStatus(request.getPaymentStatus());
        } else if ("Cash On Delivery".equalsIgnoreCase(order.getPaymentMethod()) || "COD".equalsIgnoreCase(order.getPaymentMethod())) {
            order.setPaymentStatus("COD_PENDING");
        } else {
            order.setPaymentStatus("PAID");
        }
        order.setPaymentTransactionId(request.getPaymentTransactionId());
        order.setPaymentDetails(request.getPaymentDetails());
        order.setStatus(OrderStatus.CONFIRMED);
        order.setCreatedAt(LocalDateTime.now());

        BigDecimal subtotal = BigDecimal.ZERO;

        for (OrderItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException("Product not found with id: " + itemReq.getProductId()));

            if (product.getStockQuantity() < itemReq.getQuantity()) {
                throw new IllegalStateException("Insufficient stock for product: " + product.getName() +
                        ". Available: " + product.getStockQuantity());
            }

            // Deduct stock
            product.setStockQuantity(product.getStockQuantity() - itemReq.getQuantity());
            productRepository.save(product);

            OrderItem orderItem = new OrderItem(
                    order,
                    product,
                    product.getName(),
                    product.getPrice(),
                    itemReq.getQuantity()
            );
            // Link item to product's seller
            orderItem.setSeller(product.getSeller());
            order.addItem(orderItem);

            subtotal = subtotal.add(orderItem.getSubtotal());
        }

        order.setSubtotalAmount(subtotal);

        // Indian Shipping fee calculation: Free delivery across India for orders above ₹999, else ₹99
        BigDecimal shippingFee = subtotal.compareTo(new BigDecimal("999.00")) >= 0
                ? BigDecimal.ZERO
                : new BigDecimal("99.00");
        order.setShippingFee(shippingFee);

        // Indian GST calculation (18% standard GST)
        BigDecimal gstRate = new BigDecimal("0.18");
        BigDecimal tax = subtotal.multiply(gstRate).setScale(2, RoundingMode.HALF_UP);
        order.setTaxAmount(tax);

        BigDecimal total = subtotal.add(shippingFee).add(tax);
        order.setTotalAmount(total);

        Order savedOrder = orderRepository.save(order);
        return new OrderResponse(savedOrder);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(OrderResponse::new)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getUserOrders(Long userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(OrderResponse::new)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<OrderResponse> getOrderByNumber(String orderNumber) {
        return orderRepository.findByOrderNumber(orderNumber)
                .map(OrderResponse::new);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getOrdersByCustomerEmail(String email) {
        return orderRepository.findByCustomerEmailOrderByCreatedAtDesc(email).stream()
                .map(OrderResponse::new)
                .collect(Collectors.toList());
    }

    public OrderResponse updateOrderStatus(String orderNumber, OrderStatus status) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with number: " + orderNumber));
        order.setStatus(status);
        Order updated = orderRepository.save(order);
        return new OrderResponse(updated);
    }

    public OrderResponse updateOrderStatus(Long orderId, OrderStatus status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));
        order.setStatus(status);
        Order updated = orderRepository.save(order);
        return new OrderResponse(updated);
    }

    public OrderResponse updatePaymentStatus(String orderNumber, String paymentStatus, String transactionId, String paymentDetails) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with number: " + orderNumber));
        order.setPaymentStatus(paymentStatus);
        if (transactionId != null) {
            order.setPaymentTransactionId(transactionId);
        }
        if (paymentDetails != null) {
            order.setPaymentDetails(paymentDetails);
        }
        Order updated = orderRepository.save(order);
        return new OrderResponse(updated);
    }

    public OrderResponse updatePayment(String orderNumber, String paymentStatus, String transactionId, String paymentDetails) {
        return updatePaymentStatus(orderNumber, paymentStatus, transactionId, paymentDetails);
    }

    private String generateOrderNumber() {
        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uniquePart = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "ORD-" + datePart + "-" + uniquePart;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDashboardStats() {
        List<Order> orders = orderRepository.findAll();

        long totalOrders = orders.size();
        BigDecimal totalRevenue = orders.stream()
                .filter(o -> o.getStatus() != OrderStatus.CANCELLED)
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long pendingOrders = orders.stream()
                .filter(o -> o.getStatus() == OrderStatus.PENDING ||
                             o.getStatus() == OrderStatus.CONFIRMED ||
                             o.getStatus() == OrderStatus.PROCESSING)
                .count();

        long deliveredOrders = orders.stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalOrders", totalOrders);
        stats.put("totalRevenue", totalRevenue);
        stats.put("pendingOrders", pendingOrders);
        stats.put("deliveredOrders", deliveredOrders);

        return stats;
    }
}
