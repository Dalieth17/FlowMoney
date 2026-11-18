// Conserva la moneda con la que se abrió un formulario durante toda la petición.
const { AsyncLocalStorage } = require('node:async_hooks');
module.exports = new AsyncLocalStorage();
