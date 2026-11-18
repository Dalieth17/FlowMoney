# Web de FlowMoney: estáticos + proxy de /api, con Nginx sin privilegios de root.
FROM nginxinc/nginx-unprivileged:1.28-alpine

USER root
RUN mkdir -p /etc/nginx/snippets && chmod 755 /etc/nginx/snippets
USER 101

COPY --chmod=644 nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --chmod=644 nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chown=101:101 public/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1
