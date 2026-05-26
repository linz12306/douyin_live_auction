CREATE TABLE IF NOT EXISTS users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('merchant', 'user') NOT NULL,
    display_name  VARCHAR(50) NOT NULL,
    avatar_url    VARCHAR(255) DEFAULT '',
    balance       DECIMAL(15,2) DEFAULT 1000000.00,
    frozen_amount DECIMAL(15,2) DEFAULT 0.00,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
