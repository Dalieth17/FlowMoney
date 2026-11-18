ALTER TABLE transactions
  ADD COLUMN kind ENUM('NORMAL','TRANSFER','ADJUSTMENT') NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN operation_id CHAR(36) NULL,
  ADD INDEX idx_tx_operation (user_id, operation_id);

CREATE TABLE financial_operations (
  user_id INT NOT NULL,
  id CHAR(36) NOT NULL,
  kind ENUM('TRANSFER','RECONCILIATION') NOT NULL,
  data JSON NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recurring_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  data JSON NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_schedule_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recurring_occurrences (
  schedule_id INT NOT NULL,
  period CHAR(7) NOT NULL,
  transaction_id INT NULL,
  PRIMARY KEY (schedule_id, period),
  FOREIGN KEY (schedule_id) REFERENCES recurring_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
