# API de FlowMoney (Node.js LTS). Instalación reproducible y usuario sin privilegios.
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Dependencias primero (aprovecha la caché de capas) y exactamente las del lockfile.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "src/server.js"]
