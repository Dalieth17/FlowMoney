-- 004_currency_codes.sql — la moneda pasa a ser un código ISO: COP (peso colombiano) o USD (dólar).
-- Los usuarios que tenían US$ quedan en USD; el resto ($, S/, €) pasa a COP.
UPDATE users SET currency = CASE WHEN currency IN ('US$', 'USD') THEN 'USD' ELSE 'COP' END;
ALTER TABLE users ALTER COLUMN currency SET DEFAULT 'COP';
