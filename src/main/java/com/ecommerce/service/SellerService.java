package com.ecommerce.service;

import com.ecommerce.model.Order;
import com.ecommerce.model.OrderItem;
import com.ecommerce.model.Product;
import com.ecommerce.model.User;
import com.ecommerce.repository.OrderItemRepository;
import com.ecommerce.repository.OrderRepository;
import com.ecommerce.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class SellerService {

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    @Autowired
    public SellerService(ProductRepository productRepository,
                         OrderRepository orderRepository,
                         OrderItemRepository orderItemRepository) {
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
    }

    public Map<String, Object> getSellerDashboardStats(Long sellerId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        List<Product> products = productRepository.findBySellerId(sellerId);
        List<OrderItem> soldItems = orderItemRepository.findBySellerId(sellerId);
        List<Order> orders = orderRepository.findOrdersBySellerId(sellerId);

        int totalProducts = products.size();
        int activeStockCount = (int) products.stream().filter(p -> p.getStockQuantity() > 0).count();
        int outOfStockCount = (int) products.stream().filter(p -> p.getStockQuantity() == 0).count();

        int totalUnitsSold = soldItems.stream()
                .mapToInt(OrderItem::getQuantity)
                .sum();

        BigDecimal totalRevenue = soldItems.stream()
                .map(OrderItem::getSubtotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        stats.put("sellerId", sellerId);
        stats.put("totalProducts", totalProducts);
        stats.put("activeStockCount", activeStockCount);
        stats.put("outOfStockCount", outOfStockCount);
        stats.put("totalUnitsSold", totalUnitsSold);
        stats.put("totalOrdersCount", orders.size());
        stats.put("totalRevenue", totalRevenue);

        return stats;
    }

    public List<Product> getSellerProducts(Long sellerId) {
        return productRepository.findBySellerId(sellerId);
    }

    public List<Map<String, Object>> getSellerSellingHistory(Long sellerId) {
        List<Order> orders = orderRepository.findOrdersBySellerId(sellerId);
        List<Map<String, Object>> history = new ArrayList<>();

        for (Order order : orders) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("orderId", order.getId());
            entry.put("orderNumber", order.getOrderNumber());
            entry.put("createdAt", order.getCreatedAt());
            entry.put("customerName", order.getCustomerName());
            entry.put("customerCity", order.getCity());
            entry.put("customerState", order.getState());
            entry.put("status", order.getStatus());
            entry.put("paymentMethod", order.getPaymentMethod());
            entry.put("paymentStatus", order.getPaymentStatus());

            // Filter items that belong specifically to this seller
            List<Map<String, Object>> sellerItems = new ArrayList<>();
            BigDecimal sellerSubtotal = BigDecimal.ZERO;

            for (OrderItem item : order.getItems()) {
                if (item.getSeller() != null && item.getSeller().getId().equals(sellerId)) {
                    Map<String, Object> itemMap = new HashMap<>();
                    itemMap.put("productId", item.getProduct() != null ? item.getProduct().getId() : null);
                    itemMap.put("productName", item.getProductName());
                    itemMap.put("quantity", item.getQuantity());
                    itemMap.put("unitPrice", item.getUnitPrice());
                    itemMap.put("subtotal", item.getSubtotal());
                    sellerItems.add(itemMap);

                    if (item.getSubtotal() != null) {
                        sellerSubtotal = sellerSubtotal.add(item.getSubtotal());
                    }
                }
            }

            entry.put("items", sellerItems);
            entry.put("sellerEarnings", sellerSubtotal);
            history.add(entry);
        }

        return history;
    }
}
