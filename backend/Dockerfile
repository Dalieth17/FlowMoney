# Backend FlowMoney — API Node/Express.
FROM node:20-alpine

WORKDIR /app

# Instala dependencias primero (mejor cache)
COPY package.json ./
RUN npm install --omit=dev

# Código
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
