package com.ecommerce.model;

public enum Role {
    ROLE_USER,
    ROLE_SELLER,
    ROLE_ADMIN;

    public String getAuthority() {
        return name();
    }
}
