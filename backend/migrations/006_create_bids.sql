CREATE TABLE IF NOT EXISTS bids (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    auction_id BIGINT NOT NULL,
    user_id    BIGINT NOT NULL,
    amount     DECIMAL(15,2) NOT NULL,
    status     ENUM('active','outbid','won','cancelled') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES auctions(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_auction_amount (auction_id, amount DESC),
    INDEX idx_user (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
