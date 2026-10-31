package com.ecommerce.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/location")
@CrossOrigin(origins = "*")
public class LocationController {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .build();

    // In-memory quick lookup for popular Indian pin codes for lightning-fast response
    private static final Map<String, Map<String, Object>> POPULAR_PINCODES = new HashMap<>();

    static {
        registerPincode("500081", "Madhapur / HITEC City", "Hyderabad", "Telangana", 17.4483, 78.3839);
        registerPincode("500032", "Gachibowli", "Hyderabad", "Telangana", 17.4401, 78.3489);
        registerPincode("500084", "Kondapur", "Hyderabad", "Telangana", 17.4658, 78.3587);
        registerPincode("560001", "MG Road / Ashok Nagar", "Bengaluru", "Karnataka", 12.9756, 77.6066);
        registerPincode("560100", "Electronic City", "Bengaluru", "Karnataka", 12.8452, 77.6602);
        registerPincode("560034", "Koramangala", "Bengaluru", "Karnataka", 12.9279, 77.6271);
        registerPincode("560038", "Indiranagar", "Bengaluru", "Karnataka", 12.9784, 77.6408);
        registerPincode("110001", "Connaught Place", "New Delhi", "Delhi", 28.6315, 77.2167);
        registerPincode("110016", "Hauz Khas", "New Delhi", "Delhi", 28.5494, 77.2001);
        registerPincode("400001", "Fort / Marine Drive", "Mumbai", "Maharashtra", 18.9322, 72.8354);
        registerPincode("400050", "Bandra West", "Mumbai", "Maharashtra", 19.0596, 72.8295);
        registerPincode("400076", "Powai", "Mumbai", "Maharashtra", 19.1176, 72.9060);
        registerPincode("600001", "George Town", "Chennai", "Tamil Nadu", 13.0878, 80.2785);
        registerPincode("600028", "R.A. Puram / Mylapore", "Chennai", "Tamil Nadu", 13.0289, 80.2583);
        registerPincode("700001", "BBD Bagh / Dalhousie", "Kolkata", "West Bengal", 22.5726, 88.3639);
        registerPincode("411001", "Pune Station / Camp", "Pune", "Maharashtra", 18.5204, 73.8567);
        registerPincode("411057", "Hinjawadi IT Park", "Pune", "Maharashtra", 18.5913, 73.7389);
        registerPincode("380001", "Lal Darwaja", "Ahmedabad", "Gujarat", 23.0225, 72.5714);
    }

    private static void registerPincode(String pin, String area, String city, String state, double lat, double lon) {
        Map<String, Object> data = new HashMap<>();
        data.put("pincode", pin);
        data.put("area", area);
        data.put("city", city);
        data.put("state", state);
        data.put("country", "India");
        data.put("latitude", lat);
        data.put("longitude", lon);
        data.put("areas", Collections.singletonList(area));
        POPULAR_PINCODES.put(pin, data);
    }

    @GetMapping("/pincode/{pincode}")
    public ResponseEntity<?> lookupPincode(@PathVariable String pincode) {
        String cleanPin = pincode.replaceAll("[^0-9]", "");
        if (cleanPin.length() != 6) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Indian PIN code must be exactly 6 digits"));
        }

        // Check cache first
        if (POPULAR_PINCODES.containsKey(cleanPin)) {
            return ResponseEntity.ok(POPULAR_PINCODES.get(cleanPin));
        }

        // Query postalpincode.in live API
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.postalpincode.in/pincode/" + cleanPin))
                    .header("User-Agent", "NovaEcommerceApp/1.0")
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200 && response.body().contains("\"Status\":\"Success\"")) {
                // Also query Nominatim for exact lat/lon
                Double lat = 20.5937; // Center of India fallback
                Double lon = 78.9629;

                try {
                    HttpRequest geoReq = HttpRequest.newBuilder()
                            .uri(URI.create("https://nominatim.openstreetmap.org/search?postalcode=" + cleanPin + "&country=India&format=json"))
                            .header("User-Agent", "NovaEcommerceApp/1.0 (contact@novastore.in)")
                            .timeout(Duration.ofSeconds(3))
                            .GET()
                            .build();
                    HttpResponse<String> geoRes = httpClient.send(geoReq, HttpResponse.BodyHandlers.ofString());
                    if (geoRes.statusCode() == 200 && geoRes.body().contains("\"lat\":")) {
                        // Extract lat lon simply
                        String body = geoRes.body();
                        int latIdx = body.indexOf("\"lat\":\"");
                        int lonIdx = body.indexOf("\"lon\":\"");
                        if (latIdx != -1 && lonIdx != -1) {
                            String latStr = body.substring(latIdx + 7, body.indexOf("\"", latIdx + 7));
                            String lonStr = body.substring(lonIdx + 7, body.indexOf("\"", lonIdx + 7));
                            lat = Double.parseDouble(latStr);
                            lon = Double.parseDouble(lonStr);
                        }
                    }
                } catch (Exception ignored) {}

                // Extract post office names, city, state
                Map<String, Object> result = new HashMap<>();
                result.put("pincode", cleanPin);
                result.put("country", "India");
                result.put("latitude", lat);
                result.put("longitude", lon);
                result.put("raw", response.body());
                return ResponseEntity.ok(result);
            }
        } catch (Exception e) {
            // Log and fallback
        }

        // Fallback default coordinates for India
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("pincode", cleanPin);
        fallback.put("country", "India");
        fallback.put("latitude", 20.5937);
        fallback.put("longitude", 78.9629);
        return ResponseEntity.ok(fallback);
    }
}
