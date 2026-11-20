const express = require('express');
const helmet = require('helmet');
const fs = require('node:fs');
const path = require('node:path');

// Mismo origen para HTML y /api: las cookies y llamadas relativas siguen funcionando.
function serveWeb(root, { production = false } = {}) {
  if (!fs.existsSync(path.join(root, 'index.html')))
    throw Error('SERVE_WEB requiere la carpeta public de la web. Revisa WEB_ROOT y el Dockerfile.');
  const router = express.Router();
  router.use(
    helmet.contentSecurityPolicy({
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(production ? { upgradeInsecureRequests: [] } : {}),
      },
    }),
  );
  router.use(helmet.frameguard({ action: 'deny' }));
  router.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
  router.use((_req, res, next) => {
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  router.use(
    express.static(root, {
      dotfiles: 'ignore',
      index: 'index.html',
      maxAge: 0,
      setHeaders: (res) => res.set('Cache-Control', 'no-cache'),
    }),
  );
  return router;
}
module.exports = serveWeb;
