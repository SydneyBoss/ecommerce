package com.ecommerce.config;

import com.ecommerce.model.Category;
import com.ecommerce.model.Product;
import com.ecommerce.repository.CategoryRepository;
import com.ecommerce.repository.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public DataInitializer(CategoryRepository categoryRepository, ProductRepository productRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
    }

    @Override
    public void run(String... args) {
        if (categoryRepository.count() > 0) {
            return;
        }

        // 1. Create Categories
        Category electronics = new Category("Electronics", "electronics", "Latest gadgets, computing and premium electronics", "laptop");
        Category audio = new Category("Audio & Sound", "audio", "Premium high-fidelity headphones, earbuds and speakers", "headphones");
        Category fashion = new Category("Fashion & Apparel", "fashion", "Curated contemporary fashion, watches and daily wear", "shirt");
        Category home = new Category("Home & Living", "home-living", "Modern minimalist lifestyle and interior essentials", "home");
        Category accessories = new Category("Accessories", "accessories", "Handcrafted leather accessories and everyday carry items", "gem");

        categoryRepository.saveAll(Arrays.asList(electronics, audio, fashion, home, accessories));

        // 2. Create Products
        List<Product> products = Arrays.asList(
                // Electronics
                new Product(
                        "UltraPro M3 15\" Laptop",
                        "High performance lightweight laptop powered by modern silicon with 32GB unified memory, 1TB NVMe SSD, and 120Hz Retina Display. Designed for creators and engineers.",
                        new BigDecimal("1499.00"),
                        new BigDecimal("1699.00"),
                        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
                        18,
                        4.9,
                        128,
                        true,
                        "Best Seller",
                        electronics
                ),
                new Product(
                        "Quantum Mechanical Keyboard",
                        "Custom tactile mechanical switches with hot-swappable PCB, double-shot PBT keycaps, per-key RGB backlighting, and CNC aluminum unibody construction.",
                        new BigDecimal("149.50"),
                        new BigDecimal("179.99"),
                        "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
                        35,
                        4.8,
                        84,
                        true,
                        "Staff Pick",
                        electronics
                ),
                new Product(
                        "Apex 4K Creator Drone",
                        "Compact foldable drone with 3-axis stabilized 4K HDR camera, 34-minute flight time, omnidirectional obstacle sensing, and intelligent follow modes.",
                        new BigDecimal("699.00"),
                        new BigDecimal("799.00"),
                        "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?auto=format&fit=crop&w=800&q=80",
                        12,
                        4.7,
                        42,
                        false,
                        "New",
                        electronics
                ),
                new Product(
                        "ErgoPrecision Wireless Mouse",
                        "Ergonomic dual-connectivity wireless mouse with high precision 8000 DPI sensor, quiet switches, infinite hyper-scroll wheel, and 70-day battery life.",
                        new BigDecimal("89.99"),
                        new BigDecimal("99.99"),
                        "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
                        50,
                        4.6,
                        95,
                        false,
                        null,
                        electronics
                ),

                // Audio
                new Product(
                        "Aura ANC Wireless Headphones",
                        "Industry-leading active noise cancellation with spatial audio, transparency mode, custom 40mm drivers, and up to 40 hours of battery life on a single charge.",
                        new BigDecimal("279.99"),
                        new BigDecimal("329.99"),
                        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
                        25,
                        4.9,
                        310,
                        true,
                        "Popular",
                        audio
                ),
                new Product(
                        "Pulse 360 Portable Bluetooth Speaker",
                        "Waterproof IPX7 rugged wireless speaker delivering punchy bass and crystal-clear 360-degree sound with 24 hours playtime and power bank feature.",
                        new BigDecimal("119.00"),
                        new BigDecimal("139.00"),
                        "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80",
                        40,
                        4.7,
                        178,
                        false,
                        null,
                        audio
                ),
                new Product(
                        "TrueStudio In-Ear Audio Monitors",
                        "Audiophile-grade dual balanced armature drivers with ergonomic noise-isolating silicone tips and detachable braided silver-plated copper cable.",
                        new BigDecimal("169.00"),
                        null,
                        "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
                        30,
                        4.8,
                        64,
                        false,
                        "Audiophile",
                        audio
                ),

                // Fashion
                new Product(
                        "Heritage Chronograph Watch",
                        "Handcrafted timepiece with surgical-grade 316L stainless steel case, sapphire crystal glass, Japanese quartz movement, and genuine vegetable-tanned Italian leather band.",
                        new BigDecimal("210.00"),
                        new BigDecimal("250.00"),
                        "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80",
                        15,
                        4.8,
                        152,
                        true,
                        "Best Seller",
                        fashion
                ),
                new Product(
                        "Classic Heavyweight Cotton Hoodie",
                        "Premium 450 GSM French terry cotton hoodie crafted with flatlock stitching, pre-shrunk for the ideal oversized relaxed fit.",
                        new BigDecimal("78.00"),
                        null,
                        "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80",
                        60,
                        4.6,
                        89,
                        false,
                        null,
                        fashion
                ),
                new Product(
                        "Aviator Polarized Sunglasses",
                        "Ultra-lightweight titanium frame with anti-glare scratch-resistant UV400 lenses. Offers timeless aesthetic and supreme comfort all day long.",
                        new BigDecimal("125.00"),
                        new BigDecimal("150.00"),
                        "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80",
                        22,
                        4.5,
                        61,
                        false,
                        "Summer Pick",
                        fashion
                ),

                // Home & Living
                new Product(
                        "Ceramic Geometric Pour-Over Kit",
                        "Artisanal ceramic dripper with heat-resistant borosilicate glass carafe and stainless steel reusable mesh filter for brewing barista-grade coffee at home.",
                        new BigDecimal("54.00"),
                        null,
                        "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80",
                        45,
                        4.9,
                        112,
                        true,
                        "Trending",
                        home
                ),
                new Product(
                        "Minimalist Balance Desk Lamp",
                        "Dimmable LED architect desk lamp with touch slider, USB-C pass-through charging, 3 color temperatures, and memory settings.",
                        new BigDecimal("85.00"),
                        new BigDecimal("105.00"),
                        "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80",
                        20,
                        4.7,
                        76,
                        false,
                        null,
                        home
                ),

                // Accessories
                new Product(
                        "Slim RFID Leather Bifold Wallet",
                        "Sleek full-grain leather wallet with pull-tab card slots, money clip, and military-grade RFID blocking technology to keep personal data secure.",
                        new BigDecimal("49.99"),
                        new BigDecimal("65.00"),
                        "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80",
                        55,
                        4.8,
                        204,
                        true,
                        "Popular",
                        accessories
                ),
                new Product(
                        "Water-Resistant Commuter Backpack",
                        "Cordura ballistic nylon backpack featuring dedicated 16-inch padded laptop sleeve, quick-access passport pocket, and magnetic Fidlock buckle closures.",
                        new BigDecimal("135.00"),
                        new BigDecimal("160.00"),
                        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
                        19,
                        4.9,
                        140,
                        true,
                        "Best Seller",
                        accessories
                )
        );

        productRepository.saveAll(products);
    }
}
