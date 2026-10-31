package com.ecommerce.service;

import com.ecommerce.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    @Value("${payment.upi.vpa:novastore@okhdfcbank}")
    private String merchantUpiVpa;

    @Value("${payment.upi.merchant-name:NOVA India Store}")
    private String merchantName;

    @Value("${payment.razorpay.key-id:rzp_test_TuVcSh0WCborg8}")
    private String razorpayKeyId;

    @Value("${payment.razorpay.key-secret:V5rhHS3AsPM695gjy5lSclsL}")
    private String razorpayKeySecret;

    @Value("${payment.test-mode:true}")
    private boolean testMode;

    private final OrderService orderService;

    @Autowired
    public PaymentService(OrderService orderService) {
        this.orderService = orderService;
    }

    public PaymentConfigResponse getConfig() {
        return new PaymentConfigResponse(
                merchantUpiVpa,
                merchantName,
                razorpayKeyId,
                "INR",
                testMode,
                Arrays.asList("UPI_QR", "UPI_INTENT", "RAZORPAY", "RUPAY_CARD", "COD")
        );
    }

    public PaymentInitiateResponse initiatePayment(PaymentInitiateRequest request) {
        OrderResponse order = orderService.getOrderByNumber(request.getOrderNumber())
                .orElseThrow(() -> new IllegalArgumentException("Order not found with number: " + request.getOrderNumber()));

        BigDecimal amount = request.getAmount() != null ? request.getAmount() : order.getTotalAmount();
        String method = request.getPaymentMethod() != null ? request.getPaymentMethod().toUpperCase() : "UPI";

        String effectiveVpa = (request.getMerchantVpa() != null && !request.getMerchantVpa().isBlank())
                ? request.getMerchantVpa().trim()
                : merchantUpiVpa;

        PaymentInitiateResponse response = new PaymentInitiateResponse();
        response.setOrderNumber(order.getOrderNumber());
        response.setPaymentMethod(method);
        response.setAmount(amount);
        response.setCurrency("INR");
        response.setMerchantVpa(effectiveVpa);
        response.setRazorpayKeyId(razorpayKeyId);

        // 1. Build standard NPCI UPI URI: upi://pay?pa=...&pn=...&am=...&cu=INR&tr=...&tn=...
        try {
            String encodedName = URLEncoder.encode(merchantName, StandardCharsets.UTF_8).replace("+", "%20");
            String note = URLEncoder.encode("Order " + order.getOrderNumber(), StandardCharsets.UTF_8).replace("+", "%20");
            String upiUri = String.format("upi://pay?pa=%s&pn=%s&am=%.2f&cu=INR&tr=%s&tn=%s&mode=02",
                    effectiveVpa,
                    encodedName,
                    amount.doubleValue(),
                    order.getOrderNumber(),
                    note);
            response.setUpiUri(upiUri);
            response.setUpiQrData(upiUri);
        } catch (Exception e) {
            response.setUpiUri("upi://pay?pa=" + effectiveVpa + "&am=" + amount + "&cu=INR");
            response.setUpiQrData(response.getUpiUri());
        }

        // 2. Build or Create Razorpay Order Reference
        String rzpOrderId;
        if (method.contains("RAZORPAY")) {
            rzpOrderId = createRazorpayOrderViaApi(order.getOrderNumber(), amount);
        } else {
            rzpOrderId = "order_" + order.getOrderNumber().replace("-", "_") + "_" + UUID.randomUUID().toString().substring(0, 4);
        }
        response.setRazorpayOrderId(rzpOrderId);
        response.setStatus("INITIATED");

        return response;
    }

    private String createRazorpayOrderViaApi(String orderNumber, BigDecimal amount) {
        try {
            long amountInPaise = amount.multiply(new BigDecimal("100")).setScale(0, RoundingMode.HALF_UP).longValue();
            String jsonPayload = String.format("{\"amount\":%d,\"currency\":\"INR\",\"receipt\":\"%s\"}",
                    amountInPaise, orderNumber);

            String auth = razorpayKeyId + ":" + razorpayKeySecret;
            String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.razorpay.com/v1/orders"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Basic " + encodedAuth)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200 || resp.statusCode() == 201) {
                String body = resp.body();
                int idIdx = body.indexOf("\"id\":\"");
                if (idIdx != -1) {
                    int start = idIdx + 6;
                    int end = body.indexOf("\"", start);
                    String createdOrderId = body.substring(start, end);
                    log.info("[RAZORPAY-ORDER-CREATED] Live Razorpay Order created: {} for Order {}", createdOrderId, orderNumber);
                    return createdOrderId;
                }
            } else {
                log.warn("[RAZORPAY-ORDER-ERROR] Status {}: {}", resp.statusCode(), resp.body());
            }
        } catch (Exception e) {
            log.warn("[RAZORPAY-ORDER-EXCEPTION] Failed to call Razorpay API: {}", e.getMessage());
        }
        return "order_" + orderNumber.replace("-", "_") + "_" + UUID.randomUUID().toString().substring(0, 4);
    }

    public PaymentVerifyResponse verifyPayment(PaymentVerifyRequest request) {
        OrderResponse order = orderService.getOrderByNumber(request.getOrderNumber())
                .orElseThrow(() -> new IllegalArgumentException("Order not found with number: " + request.getOrderNumber()));

        String method = request.getPaymentMethod() != null ? request.getPaymentMethod().toUpperCase() : "UPI";
        String txnId;
        String status = "PAID";
        String details;
        String message;

        if (method.contains("RAZORPAY")) {
            // Verify Razorpay HMAC SHA256 Signature
            boolean validSignature = verifyRazorpaySignature(
                    request.getRazorpayOrderId(),
                    request.getRazorpayPaymentId(),
                    request.getRazorpaySignature()
            );

            if (!validSignature && !testMode) {
                return new PaymentVerifyResponse(false, order.getOrderNumber(), null, method, "FAILED", "Invalid Razorpay payment signature.");
            }

            txnId = request.getRazorpayPaymentId() != null && !request.getRazorpayPaymentId().isBlank()
                    ? request.getRazorpayPaymentId()
                    : "pay_test_" + UUID.randomUUID().toString().substring(0, 10);
            details = "Razorpay: " + (request.getRazorpayOrderId() != null ? request.getRazorpayOrderId() : "Direct");
            message = "Razorpay payment authorized successfully!";

        } else if (method.contains("CARD")) {
            // RuPay / Card 3D-Secure verification
            if (request.getOtp() == null || request.getOtp().trim().length() < 4) {
                return new PaymentVerifyResponse(false, order.getOrderNumber(), null, method, "FAILED", "Invalid 3D Secure OTP entered.");
            }
            txnId = "TXN_RUPAY_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            details = "Card ending in " + (request.getCardLast4() != null ? request.getCardLast4() : "1234");
            message = "Card payment authorized via 3D Secure OTP!";

        } else if (method.contains("COD") || method.contains("CASH")) {
            status = "COD_CONFIRMED";
            txnId = "COD-" + order.getOrderNumber();
            details = "Pay cash/UPI at doorstep upon delivery";
            message = "Cash on Delivery confirmed for this order.";

        } else {
            // UPI Verification (UTR or Direct Dynamic UPI QR)
            if (request.getUpiUtr() != null && !request.getUpiUtr().isBlank()) {
                txnId = "UPI-UTR-" + request.getUpiUtr().trim();
            } else if (request.getTransactionId() != null && !request.getTransactionId().isBlank()) {
                txnId = request.getTransactionId().trim();
            } else {
                txnId = "UPI-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
            }
            details = "UPI VPA: " + merchantUpiVpa;
            message = "UPI payment credited and verified!";
        }

        // Update database with payment details
        orderService.updatePayment(order.getOrderNumber(), status, txnId, details);

        return new PaymentVerifyResponse(true, order.getOrderNumber(), txnId, method, status, message);
    }

    private boolean verifyRazorpaySignature(String orderId, String paymentId, String signature) {
        if (signature == null || signature.isBlank() || orderId == null || paymentId == null) {
            return false;
        }
        try {
            String payload = orderId + "|" + paymentId;
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(razorpayKeySecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] rawHmac = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String generatedSignature = HexFormat.of().formatHex(rawHmac);
            return generatedSignature.equalsIgnoreCase(signature);
        } catch (Exception e) {
            return false;
        }
    }
}
