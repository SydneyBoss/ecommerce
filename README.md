# NOVA — Indian Full-Stack E-Commerce Platform

A production-ready, full-stack E-Commerce application tailored for **India**, built with **Java 24**, **Spring Boot 3.4**, **Spring Data JPA**, **H2 In-Memory Database**, and a responsive web storefront styled with **Tailwind CSS**, featuring **Interactive Leaflet Delivery Maps** and **Indian 6-digit PIN Code Auto-Detection**.

---

## 🇮🇳 India-Specific Features

- **Indian Rupee (₹ INR) Pricing & GST**: All products, order calculations, and revenue analytics are in ₹ INR with standard 18% GST.
- **Indian PIN Code Lookup & Interactive Map**:
  - Type any 6-digit Indian PIN code (e.g., `500081`, `560001`, `110001`, `400001`).
  - Automatically identifies **Area / Locality**, **City / District**, and **State**.
  - **Leaflet Map Integration**: Shows the identified Indian neighborhood with a draggable marker to pinpoint the customer's exact doorstep.
- **Indian Payment Methods**:
  - 📱 **UPI** (Google Pay, PhonePe, Paytm, BHIM)
  - 💳 **Credit & Debit Cards** (RuPay, Visa, MasterCard)
  - 💵 **Cash on Delivery (COD)**
- **Indian Express Logistics**: Free delivery on orders above ₹999 across India.

---

## 🚀 Portals & Roles

- **🛒 User Mode (Customer)**: Browse catalog in ₹ INR, search, filter by category, quick view, cart drawer, checkout with Indian address + Leaflet map, and order tracking.
- **📦 Seller Mode (Merchant)**: Inventory overview, adjust stock levels, update unit prices in ₹ INR, and create new listings.
- **🛡️ Admin Mode (Executive)**: Review gross revenue (₹), total orders, pending fulfillment pipeline, update live order status (`PENDING` → `DELIVERED`), and manage categories.

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Language** | Java 24 (compatible with Java 21+) |
| **Backend Framework** | Spring Boot 3.4.2 |
| **Persistence** | Spring Data JPA / Hibernate |
| **Database** | H2 In-Memory Database |
| **Build Tool** | Apache Maven & Maven Wrapper |
| **Frontend** | HTML5, Modern Vanilla ES6 JavaScript, Tailwind CSS, FontAwesome |

---

## 📂 Project Structure

```
ecommerce/
├── pom.xml                               # Maven project configuration
├── mvnw / mvnw.cmd                       # Maven Wrapper scripts
├── README.md                             # Documentation
└── src/
    ├── main/
    │   ├── java/com/ecommerce/
    │   │   ├── EcommerceApplication.java # Spring Boot entrypoint
    │   │   ├── config/
    │   │   │   ├── CorsConfig.java       # CORS configuration for APIs
    │   │   │   └── DataInitializer.java  # Seeds categories & products on startup
    │   │   ├── controller/
    │   │   │   ├── ProductController.java# /api/products endpoints
    │   │   │   ├── CategoryController.java# /api/categories endpoints
    │   │   │   └── OrderController.java  # /api/orders endpoints
    │   │   ├── dto/
    │   │   │   ├── OrderRequest.java     # Checkout payload validation
    │   │   │   ├── OrderItemRequest.java # Item request DTO
    │   │   │   └── OrderResponse.java    # Order response DTO
    │   │   ├── model/
    │   │   │   ├── Product.java          # Product JPA entity
    │   │   │   ├── Category.java         # Category JPA entity
    │   │   │   ├── Order.java            # Order JPA entity
    │   │   │   ├── OrderItem.java        # Order line item JPA entity
    │   │   │   └── OrderStatus.java      # Order lifecycle enum
    │   │   ├── repository/
    │   │   │   ├── ProductRepository.java
    │   │   │   ├── CategoryRepository.java
    │   │   │   └── OrderRepository.java
    │   │   └── service/
    │   │       ├── ProductService.java   # Product business logic & queries
    │   │       └── OrderService.java     # Order processing & stock deduction
    │   └── resources/
    │       ├── application.properties    # Server & H2 DB configuration
    │       └── static/                   # Storefront web assets
    │           ├── index.html            # Main storefront SPA UI
    │           ├── css/style.css         # Styling enhancements & animations
    │           └── js/app.js             # Client-side store & API logic
    └── test/
        └── java/com/ecommerce/
            └── EcommerceApplicationTests.java
```

---

## 🏃 Getting Started

### Prerequisites
- **JDK 21 or Java 24** installed (`java -version`)
- **Maven 3.8+** (or use the included `./mvnw`)

### 1. Run the Application
Open your terminal in the project directory and run:

```bash
mvn spring-boot:run
```
*(Or with Maven Wrapper: `./mvnw spring-boot:run`)*

### 2. Access the Application
- **Storefront Web UI**: Open [http://localhost:8080](http://localhost:8080) in your browser.
- **H2 Database Console**: [http://localhost:8080/h2-console](http://localhost:8080/h2-console)
  - **JDBC URL**: `jdbc:h2:mem:ecommercedb`
  - **User Name**: `sa`
  - **Password**: *(leave blank)*

---

## 📡 REST API Reference

### 1. Products
- `GET /api/products` — Retrieve all products (Supports `?category=slug`, `?search=term`, `?featured=true`).
- `GET /api/products/{id}` — Retrieve a single product by ID.
- `POST /api/products` — Add a new product *(Admin)*.
- `DELETE /api/products/{id}` — Delete a product *(Admin)*.

### 2. Categories
- `GET /api/categories` — List all categories.
- `GET /api/categories/{slug}` — Get category details by slug.

### 3. Orders
- `POST /api/orders` — Place a new customer order.
  ```json
  {
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "customerPhone": "+1 (555) 123-4567",
    "shippingAddress": "123 Market Street",
    "city": "San Francisco",
    "postalCode": "94105",
    "country": "United States",
    "paymentMethod": "Credit Card",
    "items": [
      {
        "productId": 1,
        "quantity": 2
      }
    ]
  }
  ```
- `GET /api/orders` — Retrieve list of all placed orders.
- `GET /api/orders/{orderNumber}` — Retrieve specific order by tracking number (e.g. `ORD-20261031-A1B2C3`).

---

## 🧪 Running Tests

```bash
mvn test
```
