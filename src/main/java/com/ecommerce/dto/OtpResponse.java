package com.ecommerce.dto;

public class OtpResponse {

    private boolean success;
    private String message;
    private String phone;
    private String maskedPhone;
    private int expirySeconds;
    private String demoOtp; // Available for testing / demo verification
    private String orderNumber;

    public OtpResponse() {}

    public OtpResponse(boolean success, String message, String phone, String maskedPhone, int expirySeconds, String demoOtp, String orderNumber) {
        this.success = success;
        this.message = message;
        this.phone = phone;
        this.maskedPhone = maskedPhone;
        this.expirySeconds = expirySeconds;
        this.demoOtp = demoOtp;
        this.orderNumber = orderNumber;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getMaskedPhone() { return maskedPhone; }
    public void setMaskedPhone(String maskedPhone) { this.maskedPhone = maskedPhone; }

    public int getExpirySeconds() { return expirySeconds; }
    public void setExpirySeconds(int expirySeconds) { this.expirySeconds = expirySeconds; }

    public String getDemoOtp() { return demoOtp; }
    public void setDemoOtp(String demoOtp) { this.demoOtp = demoOtp; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
}
