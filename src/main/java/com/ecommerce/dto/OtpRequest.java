package com.ecommerce.dto;

import jakarta.validation.constraints.NotBlank;

public class OtpRequest {

    @NotBlank(message = "Phone number is required")
    private String phone;

    private String orderNumber;
    private String otp;

    public OtpRequest() {}

    public OtpRequest(String phone, String orderNumber, String otp) {
        this.phone = phone;
        this.orderNumber = orderNumber;
        this.otp = otp;
    }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getOtp() { return otp; }
    public void setOtp(String otp) { this.otp = otp; }
}
