package com.ecommerce.config;

import com.ecommerce.model.*;
import com.ecommerce.repository.CategoryRepository;
import com.ecommerce.repository.OrderRepository;
import com.ecommerce.repository.ProductRepository;
import com.ecommerce.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(CategoryRepository categoryRepository,
                           ProductRepository productRepository,
                           UserRepository userRepository,
                           OrderRepository orderRepository,
                           PasswordEncoder passwordEncoder) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        // 1. Seed Users (Admin, Sellers, Buyers) if not present
        User admin = userRepository.findByEmail("admin@nova.in").orElse(null);
        if (admin == null) {
            admin = new User("Master Admin", "admin@nova.in", passwordEncoder.encode("admin123"), "9876543200", Role.ROLE_ADMIN, "NOVA Central Hub", "Bengaluru", "Karnataka");
            userRepository.save(admin);
        }

        User seller1 = userRepository.findByEmail("seller1@nova.in").orElse(null);
        if (seller1 == null) {
            seller1 = new User("Vikram Malhotra", "seller1@nova.in", passwordEncoder.encode("seller123"), "9876543211", Role.ROLE_SELLER, "Apex Tech India", "Bengaluru", "Karnataka");
            userRepository.save(seller1);
        }

        User seller2 = userRepository.findByEmail("seller2@nova.in").orElse(null);
        if (seller2 == null) {
            seller2 = new User("Ananya Desai", "seller2@nova.in", passwordEncoder.encode("seller123"), "9876543222", Role.ROLE_SELLER, "Nova Audio & Lifestyle", "Mumbai", "Maharashtra");
            userRepository.save(seller2);
        }

        User user1 = userRepository.findByEmail("user1@nova.in").orElse(null);
        if (user1 == null) {
            user1 = new User("Aarav Patel", "user1@nova.in", passwordEncoder.encode("user123"), "9876543233", Role.ROLE_USER, null, "New Delhi", "Delhi");
            userRepository.save(user1);
        }

        User user2 = userRepository.findByEmail("user2@nova.in").orElse(null);
        if (user2 == null) {
            user2 = new User("Priya Sharma", "user2@nova.in", passwordEncoder.encode("user123"), "9876543244", Role.ROLE_USER, null, "Bengaluru", "Karnataka");
            userRepository.save(user2);
        }

        // 2. Seed Categories if empty
        if (categoryRepository.count() == 0) {
            Category electronics = new Category("Electronics", "electronics", "Latest gadgets, computing and premium electronics", "laptop");
            Category audio = new Category("Audio & Sound", "audio", "Premium high-fidelity headphones, earbuds and speakers", "headphones");
            Category fashion = new Category("Fashion & Apparel", "fashion", "Curated contemporary fashion, watches and daily wear", "shirt");
            Category home = new Category("Home & Living", "home-living", "Modern minimalist lifestyle and interior essentials", "home");
            Category accessories = new Category("Accessories", "accessories", "Handcrafted leather accessories and everyday carry items", "gem");

            categoryRepository.saveAll(Arrays.asList(electronics, audio, fashion, home, accessories));
        }

        // 3. Seed Products if empty
        if (productRepository.count() == 0) {
            Category electronics = categoryRepository.findBySlug("electronics").orElse(null);
            Category audio = categoryRepository.findBySlug("audio").orElse(null);
            Category fashion = categoryRepository.findBySlug("fashion").orElse(null);
            Category home = categoryRepository.findBySlug("home-living").orElse(null);
            Category accessories = categoryRepository.findBySlug("accessories").orElse(null);

            List<Product> products = Arrays.asList(
                    new Product("UltraPro M3 15\" Laptop", "High performance lightweight laptop with 32GB unified memory, 1TB NVMe SSD.", new BigDecimal("124999.00"), new BigDecimal("139999.00"), "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80", 18, 4.9, 128, true, "Best Seller", electronics),
                    new Product("Quantum Mechanical Keyboard", "Custom tactile mechanical switches with hot-swappable PCB and RGB backlighting.", new BigDecimal("8499.00"), new BigDecimal("9999.00"), "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80", 35, 4.8, 84, true, "Staff Pick", electronics),
                    new Product("Apex 4K Creator Drone", "Foldable quadcopter with 3-axis motorized gimbal and 45-min flight time.", new BigDecimal("54999.00"), new BigDecimal("62999.00"), "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?auto=format&fit=crop&w=800&q=80", 12, 4.7, 46, false, "New", electronics),
                    new Product("ErgoPrecision Wireless Mouse", "Sculpted ergonomic vertical mouse with silent switches and hyper-fast scroll.", new BigDecimal("4499.00"), new BigDecimal("5499.00"), "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80", 50, 4.6, 92, false, null, electronics),
                    new Product("Aura ANC Wireless Headphones", "Hybrid active noise cancelling over-ear headphones with 40-hour playback and Hi-Res audio.", new BigDecimal("18999.00"), new BigDecimal("24999.00"), "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80", 24, 4.9, 210, true, "Top Rated", audio),
                    new Product("SonicPulse Studio Soundbar", "Dolby Atmos 5.1 surround home cinema soundbar with wireless down-firing subwoofer.", new BigDecimal("29999.00"), new BigDecimal("34999.00"), "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80", 15, 4.8, 73, false, "15% OFF", audio),
                    new Product("EchoBuds Pro True Wireless", "True wireless earbuds with spatial audio, low-latency gaming mode and IPX5 resistance.", new BigDecimal("6999.00"), new BigDecimal("8999.00"), "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80", 60, 4.5, 142, false, null, audio),
                    new Product("Merino Wool Oversized Knit", "100% fine spun Australian merino wool sweater tailored for modern Indian winters.", new BigDecimal("4999.00"), new BigDecimal("6499.00"), "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80", 40, 4.6, 38, false, "Winter Edition", fashion),
                    new Product("Chronos Sapphire Automatic Watch", "Self-winding mechanical wristwatch with 316L stainless steel case and exhibition back.", new BigDecimal("22499.00"), new BigDecimal("27999.00"), "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80", 16, 4.9, 64, true, "Luxury", fashion),
                    new Product("Organic Cotton Relaxed Chinos", "Garment-dyed stretch cotton trousers crafted with sustainable botanical dyes.", new BigDecimal("2999.00"), new BigDecimal("3499.00"), "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80", 75, 4.4, 52, false, null, fashion),
                    new Product("Nordic Minimalist Desk Lamp", "Matte aluminum dimmable desk lamp with inductive wireless phone charging base.", new BigDecimal("3499.00"), new BigDecimal("4299.00"), "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80", 30, 4.7, 59, false, "Design Award", home),
                    new Product("Hand-Poured Soy Amber Candle", "Artisan scented candle with teakwood, amber, and cardamom notes. 60-hr burn time.", new BigDecimal("1299.00"), new BigDecimal("1599.00"), "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80", 100, 4.8, 118, false, null, home),
                    new Product("Full-Grain Leather Cardholder", "Hand-stitched vegetable-tanned Italian leather wallet with RFID blocking layer.", new BigDecimal("1899.00"), new BigDecimal("2499.00"), "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80", 85, 4.7, 95, true, "Handcrafted", accessories),
                    new Product("Aerospace Titanium Key Clip", "CNC milled Grade 5 titanium carabiner with integrated bottle opener and pry bar.", new BigDecimal("2199.00"), new BigDecimal("2699.00"), "https://images.unsplash.com/photo-1585751119414-ef2636f8aede?auto=format&fit=crop&w=800&q=80", 45, 4.6, 41, false, null, accessories)
            );

            // Assign products to sellers
            for (int i = 0; i < products.size(); i++) {
                Product p = products.get(i);
                p.setSeller(i % 2 == 0 ? seller1 : seller2);
            }

            productRepository.saveAll(products);
        } else {
            // Ensure existing products have assigned sellers
            List<Product> existing = productRepository.findAll();
            boolean updated = false;
            for (int i = 0; i < existing.size(); i++) {
                Product p = existing.get(i);
                if (p.getSeller() == null) {
                    p.setSeller(i % 2 == 0 ? seller1 : seller2);
                    updated = true;
                }
            }
            if (updated) {
                productRepository.saveAll(existing);
            }
        }

        // 4. Seed Sample Orders if fewer than 2 orders exist
        if (orderRepository.count() < 2) {
            List<Product> allProds = productRepository.findAll();
            if (allProds.size() >= 4) {
                createSampleOrder("ORD-20261107-SAMPLE1", user1, "Aarav Patel", "user1@nova.in", "9876543233",
                        "Plot 14, Sector 62, Noida", "Noida", "Uttar Pradesh", "201301",
                        "UPI", "PAID", OrderStatus.DELIVERED,
                        Arrays.asList(allProds.get(0), allProds.get(1)));

                createSampleOrder("ORD-20261107-SAMPLE2", user2, "Priya Sharma", "user2@nova.in", "9876543244",
                        "Flat 204, Indiranagar 100ft Road", "Bengaluru", "Karnataka", "560038",
                        "Razorpay", "PAID", OrderStatus.PROCESSING,
                        Arrays.asList(allProds.get(4), allProds.get(12)));
            }
        }
    }

    private void createSampleOrder(String orderNumber, User buyer, String name, String email, String phone,
                                   String address, String city, String state, String pin,
                                   String payMethod, String payStatus, OrderStatus orderStatus,
                                   List<Product> prods) {
        Order order = new Order();
        order.setOrderNumber(orderNumber);
        order.setUser(buyer);
        order.setCustomerName(name);
        order.setCustomerEmail(email);
        order.setCustomerPhone(phone);
        order.setShippingAddress(address);
        order.setCity(city);
        order.setState(state);
        order.setPostalCode(pin);
        order.setCountry("India");
        order.setPaymentMethod(payMethod);
        order.setPaymentStatus(payStatus);
        order.setStatus(orderStatus);
        order.setCreatedAt(LocalDateTime.now().minusDays(1));

        BigDecimal subtotal = BigDecimal.ZERO;
        for (Product p : prods) {
            OrderItem item = new OrderItem(order, p, p.getName(), p.getPrice(), 1);
            item.setSeller(p.getSeller());
            order.addItem(item);
            subtotal = subtotal.add(item.getSubtotal());
        }

        order.setSubtotalAmount(subtotal);
        BigDecimal shippingFee = subtotal.compareTo(new BigDecimal("999.00")) >= 0 ? BigDecimal.ZERO : new BigDecimal("99.00");
        order.setShippingFee(shippingFee);
        BigDecimal tax = subtotal.multiply(new BigDecimal("0.18")).setScale(2, RoundingMode.HALF_UP);
        order.setTaxAmount(tax);
        order.setTotalAmount(subtotal.add(shippingFee).add(tax));

        orderRepository.save(order);
    }
}
