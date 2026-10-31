package com.ecommerce.dto;

import com.ecommerce.model.Order;
import com.ecommerce.model.OrderItem;
import com.ecommerce.model.OrderStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

public class OrderResponse {

    private Long id;
    private String orderNumber;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private String shippingAddress;
    private String area;
    private String city;
    private String state;
    private String postalCode;
    private String country;
    private Double latitude;
    private Double longitude;
    private String paymentMethod;
    private BigDecimal subtotalAmount;
    private BigDecimal shippingFee;
    private BigDecimal taxAmount;
    private BigDecimal totalAmount;
    private OrderStatus status;
    private LocalDateTime createdAt;
    private List<OrderItemDto> items;

    public static class OrderItemDto {
        private Long id;
        private Long productId;
        private String productName;
        private BigDecimal unitPrice;
        private Integer quantity;
        private BigDecimal subtotal;

        public OrderItemDto(OrderItem item) {
            this.id = item.getId();
            this.productId = item.getProduct() != null ? item.getProduct().getId() : null;
            this.productName = item.getProductName();
            this.unitPrice = item.getUnitPrice();
            this.quantity = item.getQuantity();
            this.subtotal = item.getSubtotal();
        }

        public Long getId() { return id; }
        public Long getProductId() { return productId; }
        public String getProductName() { return productName; }
        public BigDecimal getUnitPrice() { return unitPrice; }
        public Integer getQuantity() { return quantity; }
        public BigDecimal getSubtotal() { return subtotal; }
    }

    public OrderResponse(Order order) {
        this.id = order.getId();
        this.orderNumber = order.getOrderNumber();
        this.customerName = order.getCustomerName();
        this.customerEmail = order.getCustomerEmail();
        this.customerPhone = order.getCustomerPhone();
        this.shippingAddress = order.getShippingAddress();
        this.area = order.getArea();
        this.city = order.getCity();
        this.state = order.getState();
        this.postalCode = order.getPostalCode();
        this.country = order.getCountry();
        this.latitude = order.getLatitude();
        this.longitude = order.getLongitude();
        this.paymentMethod = order.getPaymentMethod();
        this.subtotalAmount = order.getSubtotalAmount();
        this.shippingFee = order.getShippingFee();
        this.taxAmount = order.getTaxAmount();
        this.totalAmount = order.getTotalAmount();
        this.status = order.getStatus();
        this.createdAt = order.getCreatedAt();
        if (order.getItems() != null) {
            this.items = order.getItems().stream()
                    .map(OrderItemDto::new)
                    .collect(Collectors.toList());
        }
    }

    public Long getId() { return id; }
    public String getOrderNumber() { return orderNumber; }
    public String getCustomerName() { return customerName; }
    public String getCustomerEmail() { return customerEmail; }
    public String getCustomerPhone() { return customerPhone; }
    public String getShippingAddress() { return shippingAddress; }
    public String getArea() { return area; }
    public String getCity() { return city; }
    public String getState() { return state; }
    public String getPostalCode() { return postalCode; }
    public String getCountry() { return country; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public String getPaymentMethod() { return paymentMethod; }
    public BigDecimal getSubtotalAmount() { return subtotalAmount; }
    public BigDecimal getShippingFee() { return shippingFee; }
    public BigDecimal getTaxAmount() { return taxAmount; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public OrderStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<OrderItemDto> getItems() { return items; }
}
