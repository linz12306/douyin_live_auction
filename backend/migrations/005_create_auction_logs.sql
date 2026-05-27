CREATE TABLE IF NOT EXISTS auction_logs (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    auction_id BIGINT NOT NULL,
    action     VARCHAR(50) NOT NULL,
    user_id    BIGINT NOT NULL,
    detail     JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auction (auction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
