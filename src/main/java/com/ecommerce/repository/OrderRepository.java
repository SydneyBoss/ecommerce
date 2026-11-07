package com.ecommerce.repository;

import com.ecommerce.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    Optional<Order> findByOrderNumber(String orderNumber);
    List<Order> findAllByOrderByCreatedAtDesc();
    List<Order> findByCustomerEmailOrderByCreatedAtDesc(String customerEmail);

    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items item WHERE o.user.id = :userId ORDER BY o.createdAt DESC")
    List<Order> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    long countByUserId(Long userId);

    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items item WHERE item.seller.id = :sellerId ORDER BY o.createdAt DESC")
    List<Order> findOrdersBySellerId(@Param("sellerId") Long sellerId);
}
