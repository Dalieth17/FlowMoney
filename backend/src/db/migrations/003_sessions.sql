-- 003_sessions.sql — sesiones en el servidor (revocables).
-- La cookie lleva un token aleatorio; aquí solo se guarda su hash SHA-256,
-- así una filtración de la base de datos no permite suplantar sesiones.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64)  NOT NULL PRIMARY KEY,
  user_id    INT       NOT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME  NOT NULL,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_session_user (user_id),
  INDEX idx_session_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
