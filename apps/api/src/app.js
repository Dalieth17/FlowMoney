// Construye la app Express sin levantar el puerto (lo usan server.js y los tests).
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const buildApiRouter = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp({ serveWeb = config.web.enabled, webRoot = config.web.root } = {}) {
  const app = express();

  // Detrás de Nginx: confiar en X-Forwarded-For (IP real para el rate limit).
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use('/api/finance/backup', express.json({ limit: '20mb' }));
  app.use('/api/transactions/import', express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use(
    '/api',
    (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    },
    buildApiRouter(),
  );

  if (serveWeb) app.use(require('./middleware/serveWeb')(webRoot, { production: config.isProduction }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
