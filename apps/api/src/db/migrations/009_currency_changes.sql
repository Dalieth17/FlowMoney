CREATE TABLE currency_changes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  from_currency ENUM('COP','USD') NOT NULL,
  to_currency ENUM('COP','USD') NOT NULL,
  cop_per_usd DECIMAL(13,6) NOT NULL,
  source ENUM('automatic','manual') NOT NULL,
  quoted_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_currency_user (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
