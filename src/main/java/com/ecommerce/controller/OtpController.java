package com.ecommerce.controller;

import com.ecommerce.dto.OtpRequest;
import com.ecommerce.dto.OtpResponse;
import com.ecommerce.service.OtpService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/otp")
@CrossOrigin(origins = "*")
public class OtpController {

    private final OtpService otpService;

    @Autowired
    public OtpController(OtpService otpService) {
        this.otpService = otpService;
    }

    @PostMapping("/send-cod-otp")
    public ResponseEntity<OtpResponse> sendCodOtp(@Valid @RequestBody OtpRequest request) {
        OtpResponse response = otpService.sendCodOtp(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-cod-otp")
    public ResponseEntity<OtpResponse> verifyCodOtp(@Valid @RequestBody OtpRequest request) {
        OtpResponse response = otpService.verifyCodOtp(request);
        if (!response.isSuccess()) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok(response);
    }
}
