// Logger mínimo con niveles. Silencioso en tests para no ensuciar la salida.
const config = require('../config');

const silent = config.isTest;
const stamp = () => new Date().toISOString();

const logger = {
  info: (...args) => !silent && console.log(stamp(), 'INFO ', ...args),
  warn: (...args) => !silent && console.warn(stamp(), 'WARN ', ...args),
  error: (...args) => !silent && console.error(stamp(), 'ERROR', ...args),
};

module.exports = logger;
