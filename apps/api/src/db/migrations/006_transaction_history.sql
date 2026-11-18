-- Historial privado del usuario; se elimina al suprimir su cuenta.
CREATE TABLE IF NOT EXISTS transaction_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  transaction_id INT NOT NULL,
  action ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_history_user_transaction (user_id, transaction_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
