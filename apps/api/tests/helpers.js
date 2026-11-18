// Debe requerirse ANTES que cualquier módulo de src/ (config lee el entorno al cargarse).
process.env.NODE_ENV = 'test';

let counter = 0;
/** Correo único por ejecución para no chocar con datos previos. */
const uniqueEmail = (prefix = 'test') => `${prefix}.${Date.now()}.${process.pid}.${++counter}@flowmoney.test`;

module.exports = { uniqueEmail };
