package com.ecommerce.service;

import com.ecommerce.model.Product;
import com.ecommerce.model.User;
import com.ecommerce.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;
    private final AuthService authService;

    @Autowired
    public ProductService(ProductRepository productRepository, AuthService authService) {
        this.productRepository = productRepository;
        this.authService = authService;
    }

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public Optional<Product> getProductById(Long id) {
        return productRepository.findById(id);
    }

    public List<Product> getFeaturedProducts() {
        return productRepository.findByFeaturedTrue();
    }

    public List<Product> getProductsByCategory(String categorySlug) {
        return productRepository.findByCategorySlug(categorySlug);
    }

    public List<Product> getProductsBySellerId(Long sellerId) {
        return productRepository.findBySellerId(sellerId);
    }

    public List<Product> searchProducts(String query) {
        if (query == null || query.trim().isEmpty()) {
            return getAllProducts();
        }
        return productRepository.searchProducts(query.trim());
    }

    public List<Product> filterProducts(String categorySlug, String query) {
        String cat = (categorySlug == null || categorySlug.isBlank() || "all".equalsIgnoreCase(categorySlug)) ? null : categorySlug.trim();
        String q = (query == null || query.isBlank()) ? null : query.trim();
        return productRepository.filterProducts(cat, q);
    }

    @Transactional
    public Product saveProduct(Product product) {
        if (product.getSeller() == null) {
            authService.getCurrentAuthenticatedUser().ifPresent(product::setSeller);
        }
        return productRepository.save(product);
    }

    @Transactional
    public Product updateProduct(Long id, Product details) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found with id: " + id));

        product.setName(details.getName());
        product.setDescription(details.getDescription());
        product.setPrice(details.getPrice());
        product.setOriginalPrice(details.getOriginalPrice());
        product.setImageUrl(details.getImageUrl());
        product.setStockQuantity(details.getStockQuantity());
        product.setCategory(details.getCategory());
        if (details.getBadge() != null) product.setBadge(details.getBadge());
        product.setFeatured(details.isFeatured());
        if (details.getSeller() != null) {
            product.setSeller(details.getSeller());
        }

        return productRepository.save(product);
    }

    @Transactional
    public void deleteProduct(Long id) {
        if (!productRepository.existsById(id)) {
            throw new IllegalArgumentException("Product not found with id: " + id);
        }
        productRepository.deleteById(id);
    }
}
