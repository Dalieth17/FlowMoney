-- 001_init.sql — esquema inicial de FlowMoney (MySQL 8).
-- Usa IF NOT EXISTS para convivir con bases creadas por versiones anteriores.

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(40)  NOT NULL,
  icon       VARCHAR(16)  NOT NULL DEFAULT '',
  color      VARCHAR(16)  NOT NULL DEFAULT '#8A94A6',
  is_default TINYINT(1)   NOT NULL DEFAULT 0,
  CONSTRAINT fk_cat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_cat_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS accounts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT           NOT NULL,
  name            VARCHAR(40)   NOT NULL,
  type            ENUM('CASH','BANK','SAVINGS') NOT NULL DEFAULT 'CASH',
  initial_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_acc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_acc_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  description VARCHAR(120)  NOT NULL,
  date        BIGINT        NOT NULL,                 -- epoch en milisegundos
  type        ENUM('INCOME','EXPENSE') NOT NULL,
  category_id INT           NOT NULL,
  account_id  INT           NULL,
  note        VARCHAR(200)  NOT NULL DEFAULT '',
  CONSTRAINT fk_tx_user FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_tx_cat  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tx_acc  FOREIGN KEY (account_id)  REFERENCES accounts(id)   ON DELETE SET NULL,
  INDEX idx_tx_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budgets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  category_id INT           NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  month       TINYINT       NOT NULL,                 -- 0..11 (como Date de JS)
  year        SMALLINT      NOT NULL,
  CONSTRAINT fk_bud_user FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_bud_cat  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE KEY uq_budget (user_id, category_id, month, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
