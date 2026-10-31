package com.ecommerce.dto;

import java.util.List;

public class PaymentConfigResponse {

    private String merchantUpiId;
    private String merchantName;
    private String razorpayKeyId;
    private String currency;
    private boolean testMode;
    private List<String> supportedGateways;

    public PaymentConfigResponse() {}

    public PaymentConfigResponse(String merchantUpiId, String merchantName, String razorpayKeyId, String currency, boolean testMode, List<String> supportedGateways) {
        this.merchantUpiId = merchantUpiId;
        this.merchantName = merchantName;
        this.razorpayKeyId = razorpayKeyId;
        this.currency = currency;
        this.testMode = testMode;
        this.supportedGateways = supportedGateways;
    }

    public String getMerchantUpiId() { return merchantUpiId; }
    public void setMerchantUpiId(String merchantUpiId) { this.merchantUpiId = merchantUpiId; }

    public String getMerchantName() { return merchantName; }
    public void setMerchantName(String merchantName) { this.merchantName = merchantName; }

    public String getRazorpayKeyId() { return razorpayKeyId; }
    public void setRazorpayKeyId(String razorpayKeyId) { this.razorpayKeyId = razorpayKeyId; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public boolean isTestMode() { return testMode; }
    public void setTestMode(boolean testMode) { this.testMode = testMode; }

    public List<String> getSupportedGateways() { return supportedGateways; }
    public void setSupportedGateways(List<String> supportedGateways) { this.supportedGateways = supportedGateways; }
}
