package com.ecommerce.dto;

import java.time.LocalDateTime;

public class PaymentVerifyResponse {

    private boolean success;
    private String orderNumber;
    private String transactionId;
    private String paymentMethod;
    private String paymentStatus;
    private String message;
    private LocalDateTime verifiedAt;

    public PaymentVerifyResponse() {
        this.verifiedAt = LocalDateTime.now();
    }

    public PaymentVerifyResponse(boolean success, String orderNumber, String transactionId, String paymentMethod, String paymentStatus, String message) {
        this.success = success;
        this.orderNumber = orderNumber;
        this.transactionId = transactionId;
        this.paymentMethod = paymentMethod;
        this.paymentStatus = paymentStatus;
        this.message = message;
        this.verifiedAt = LocalDateTime.now();
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDateTime getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(LocalDateTime verifiedAt) { this.verifiedAt = verifiedAt; }
}
