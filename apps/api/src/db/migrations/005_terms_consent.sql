-- Prueba de la autorización del tratamiento de datos (Ley 1581 de 2012, Decreto 1377 de 2013 art. 8):
-- qué versión de los Términos y la Política aceptó cada persona y cuándo.
ALTER TABLE users
  ADD COLUMN terms_version VARCHAR(20) NULL AFTER currency,
  ADD COLUMN terms_accepted_at DATETIME NULL AFTER terms_version;
