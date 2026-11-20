# Despliegue desde la raíz del monorepo: web y API en un único puerto HTTP.
FROM node:24-alpine

ENV NODE_ENV=production \
    SERVE_WEB=true \
    WEB_ROOT=/app/public \
    TRUST_PROXY=1
WORKDIR /app

COPY --chown=node:node apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node apps/api/src ./src
COPY --chown=node:node apps/web/public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
