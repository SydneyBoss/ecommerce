package com.ecommerce.service;

import com.ecommerce.dto.OrderItemRequest;
import com.ecommerce.dto.OrderRequest;
import com.ecommerce.dto.OrderResponse;
import com.ecommerce.model.Order;
import com.ecommerce.model.OrderItem;
import com.ecommerce.model.OrderStatus;
import com.ecommerce.model.Product;
import com.ecommerce.repository.OrderRepository;
import com.ecommerce.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;

    @Autowired
    public OrderService(OrderRepository orderRepository, ProductRepository productRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
    }

    public OrderResponse createOrder(OrderRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("Order must contain at least one item.");
        }

        Order order = new Order();
        order.setOrderNumber(generateOrderNumber());
        order.setCustomerName(request.getCustomerName());
        order.setCustomerEmail(request.getCustomerEmail());
        order.setCustomerPhone(request.getCustomerPhone());
        order.setShippingAddress(request.getShippingAddress());
        order.setCity(request.getCity());
        order.setPostalCode(request.getPostalCode());
        order.setCountry(request.getCountry());
        order.setPaymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod() : "Credit Card");
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
            order.addItem(orderItem);

            subtotal = subtotal.add(orderItem.getSubtotal());
        }

        order.setSubtotalAmount(subtotal);

        // Shipping fee calculation: Free shipping for orders above $100, else $9.99
        BigDecimal shippingFee = subtotal.compareTo(new BigDecimal("100.00")) >= 0
                ? BigDecimal.ZERO
                : new BigDecimal("9.99");
        order.setShippingFee(shippingFee);

        // Tax calculation (approx 7.5%)
        BigDecimal taxRate = new BigDecimal("0.075");
        BigDecimal tax = subtotal.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
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
    public Optional<OrderResponse> getOrderByNumber(String orderNumber) {
        return orderRepository.findByOrderNumber(orderNumber)
                .map(OrderResponse::new);
    }

    @Transactional(readOnly = true)
    public Optional<OrderResponse> getOrderById(Long id) {
        return orderRepository.findById(id)
                .map(OrderResponse::new);
    }

    private String generateOrderNumber() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomSuffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "ORD-" + timestamp + "-" + randomSuffix;
    }
}
