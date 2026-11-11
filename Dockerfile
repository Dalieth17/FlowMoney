# FlowMoney — landing/preview web estático servido con Nginx.
# Imagen pequeña y sin estado: solo sirve los archivos de /frontend.
FROM nginx:1.27-alpine

# Config de Nginx (gzip, cache, SPA-friendly, headers básicos de seguridad)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Archivos del sitio
COPY frontend/ /usr/share/nginx/html/

# Nginx escucha en 80 dentro del contenedor
EXPOSE 80

# Healthcheck simple contra la raíz
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
