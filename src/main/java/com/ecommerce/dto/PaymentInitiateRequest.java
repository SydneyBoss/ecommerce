package com.ecommerce.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public class PaymentInitiateRequest {

    @NotBlank(message = "Order number is required")
    private String orderNumber;

    private BigDecimal amount;
    private String paymentMethod; // UPI, RAZORPAY, CARD, COD
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    public PaymentInitiateRequest() {}

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }

    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
}
