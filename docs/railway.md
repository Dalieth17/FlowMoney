# Desplegar FlowMoney en Railway

El repositorio es un monorepo: su `package.json` raíz contiene las herramientas de calidad;
la API vive en `apps/api` y la web en `apps/web/public`. El error
**No start command detected** correspondía a intentar iniciar la raíz sin un script `start`.

Ahora hay un comando `npm start` en la raíz y una configuración de despliegue explícita:
`railway.json` selecciona el `Dockerfile` raíz, que instala las dependencias de la API y copia
los archivos públicos. Un proceso Node sirve la web y `/api` desde el mismo origen y escucha
el `PORT` inyectado por Railway. MySQL se mantiene en un servicio separado.

## Configurar el servicio

1. En el servicio conectado al repositorio, selecciona la rama que contiene esta corrección
   (**DEV**) y deja **Root Directory** en `/`.
2. Usa `railway.json` de la raíz como configuración. El constructor debe ser **Dockerfile** y
   la ruta, `Dockerfile`. El arranque definido en código es `node src/server.js` dentro de la imagen.
3. Añade o conecta un servicio **MySQL** en el mismo proyecto. Referencia sus variables en el
   servicio de FlowMoney mediante la pestaña **Variables**.

Si el servicio de base de datos se llama `MySQL`, puedes usar estas referencias en FlowMoney:

```dotenv
NODE_ENV=production
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
COOKIE_SECURE=true
```

Si tiene otro nombre, sustitúyelo en las referencias. También se aceptan directamente los nombres
`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD` y `MYSQLDATABASE`; si defines ambos conjuntos,
`DB_*` tiene prioridad. No copies las claves de ejemplo del `.env` local: producción exige una
contraseña de base de datos de al menos 16 caracteres.

El Dockerfile ya define `NODE_ENV=production`, `SERVE_WEB=true`, `WEB_ROOT=/app/public` y
`TRUST_PROXY=1`. Railway proporciona `PORT`; no es necesario fijarlo manualmente.

4. Lanza un despliegue nuevo desde el commit corregido de DEV. El build debe mostrar que utiliza
   el Dockerfile. El inicio espera a MySQL y aplica las migraciones antes de abrir el puerto.
5. En **Settings → Networking**, genera el dominio público de FlowMoney. La captura inicial
   mostraba **Unexposed service**: sin dominio no habrá una dirección pública para abrir la app.
6. Define `PUBLIC_APP_URL=https://TU-DOMINIO.up.railway.app` usando el dominio real que generaste.
   Mantén `COOKIE_SECURE=true`; Railway termina HTTPS en su proxy.

Si la interfaz solicita un puerto de destino para el dominio, usa el puerto que indique `PORT`
en Railway; el mensaje de arranque de la aplicación muestra en cuál está escuchando.

La comprobación de arranque está en `/api/health`, con hasta 180 segundos de espera. No hace falta
exponer MySQL a internet ni configurar un dominio separado para `/api`.

## Correo opcional

Para recuperar contraseñas por correo, configura también un proveedor SMTP y `PUBLIC_APP_URL`
con HTTPS. En Railway no se inicia el Mailpit de desarrollo. Sin SMTP configurado, la aplicación
funciona y la recuperación informa que el envío de correo no está disponible.

## Validación y diagnóstico

- `npm run check` y las pruebas MySQL verifican el código y el modo de servicio unificado.
- CI construye tanto las imágenes de Compose como la imagen raíz. Arranca esta última en
  producción con un MySQL desechable, variables `MYSQL*` y un puerto diferente de 3000.
  Comprueba web, módulos, gráficos, migraciones, registro y sesión con cookie segura.
- Si vuelve a aparecer Railpack, revisa la rama, el commit y el directorio raíz usados por ese
  despliegue. La configuración corregida selecciona Dockerfile.
- Si compila pero falla al iniciar, consulta los logs de ejecución: las variables MySQL,
  `COOKIE_SECURE` y el origen público se validan por separado del build.

La construcción local de esta imagen es `docker build -t flowmoney-railway .` desde la raíz.
Docker Compose conserva su organización de API, Nginx y MySQL para el desarrollo local.

Referencias oficiales: [Dockerfiles](https://docs.railway.com/builds/dockerfiles),
[configuración como código](https://docs.railway.com/config-as-code/reference) y
[variables de MySQL](https://docs.railway.com/databases/mysql).
