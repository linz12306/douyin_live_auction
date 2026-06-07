CREATE TABLE IF NOT EXISTS product_live_media (
    product_id BIGINT PRIMARY KEY,
    media_type ENUM('image','video') NOT NULL,
    media_url  VARCHAR(255) NOT NULL,
    poster_url VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
