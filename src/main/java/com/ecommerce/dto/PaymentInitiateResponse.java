package com.ecommerce.dto;

import java.math.BigDecimal;

public class PaymentInitiateResponse {

    private String orderNumber;
    private String paymentMethod;
    private BigDecimal amount;
    private String currency = "INR";
    private String upiUri;
    private String upiQrData;
    private String merchantVpa;
    private String razorpayOrderId;
    private String razorpayKeyId;
    private String status;

    public PaymentInitiateResponse() {}

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getUpiUri() { return upiUri; }
    public void setUpiUri(String upiUri) { this.upiUri = upiUri; }

    public String getUpiQrData() { return upiQrData; }
    public void setUpiQrData(String upiQrData) { this.upiQrData = upiQrData; }

    public String getMerchantVpa() { return merchantVpa; }
    public void setMerchantVpa(String merchantVpa) { this.merchantVpa = merchantVpa; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public String getRazorpayKeyId() { return razorpayKeyId; }
    public void setRazorpayKeyId(String razorpayKeyId) { this.razorpayKeyId = razorpayKeyId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
