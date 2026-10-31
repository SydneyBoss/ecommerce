package com.ecommerce.service;

import com.ecommerce.model.Product;
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

    @Autowired
    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
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
        return productRepository.save(product);
    }

    @Transactional
    public Product updateProduct(Long id, Product details) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found with id: " + id));
        if (details.getName() != null && !details.getName().isBlank()) {
            product.setName(details.getName());
        }
        if (details.getDescription() != null) {
            product.setDescription(details.getDescription());
        }
        if (details.getPrice() != null) {
            product.setPrice(details.getPrice());
        }
        if (details.getOriginalPrice() != null) {
            product.setOriginalPrice(details.getOriginalPrice());
        }
        if (details.getStockQuantity() != null) {
            product.setStockQuantity(details.getStockQuantity());
        }
        if (details.getImageUrl() != null && !details.getImageUrl().isBlank()) {
            product.setImageUrl(details.getImageUrl());
        }
        if (details.getBadge() != null) {
            product.setBadge(details.getBadge().isBlank() ? null : details.getBadge());
        }
        if (details.getCategory() != null) {
            product.setCategory(details.getCategory());
        }
        return productRepository.save(product);
    }

    @Transactional
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }
}
