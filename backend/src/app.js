// Construye la app Express sin levantar el puerto (lo usan server.js y los tests).
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const buildApiRouter = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Detrás de Nginx: confiar en X-Forwarded-For (IP real para el rate limit).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', buildApiRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
