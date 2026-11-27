// Punto de entrada de los esquemas de validación (reexporta los módulos por dominio).
const { CURRENCIES, TRANSACTION_TYPES, ACCOUNT_TYPES, idParamSchema } = require('./commonSchemas');
const authSchemas = require('./authSchemas');
const resourceSchemas = require('./resourceSchemas');

module.exports = {
  CURRENCIES,
  TRANSACTION_TYPES,
  ACCOUNT_TYPES,
  idParamSchema,
  ...authSchemas,
  ...resourceSchemas,
};
