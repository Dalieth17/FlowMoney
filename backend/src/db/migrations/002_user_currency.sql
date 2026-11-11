-- 002_user_currency.sql — moneda preferida por usuario (se edita en Perfil).
ALTER TABLE users ADD COLUMN currency VARCHAR(8) NOT NULL DEFAULT '$' AFTER password_hash;
