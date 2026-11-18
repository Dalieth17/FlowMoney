# Desarrollo y pruebas

Todos estos comandos parten de la raíz del repositorio, salvo donde se indique otra cosa.

## Web y API

Requiere Node.js 22 o superior.

```bash
npm ci
npm --prefix apps/api ci
npm run check
```

`npm run check` ejecuta lint, formato, pruebas de web/DOM y pruebas unitarias de API.

```bash
npm run test:web
npm run test:api
```

Para la integración usa una base MySQL desechable, separada de tus datos personales:

```bash
DB_HOST=127.0.0.1 DB_PORT=3308 npm run test:integration
```

Las instrucciones para crear esa base están en el [README](../README.md#tests-de-integración-de-la-api).
El servidor se ejecuta con `npm --prefix apps/api start`; lee las variables de entorno del proceso.
Para arrancar el conjunto completo y cargar `.env` mediante Compose:

```bash
docker compose up --build
```

## Android

Requiere JDK 17 o superior y Android SDK.

```bash
cd apps/android
./gradlew :domain:test :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Si tienes `local.properties` en una copia anterior, consérvalo dentro de `apps/android` y
verifica que `sdk.dir` apunte al SDK de tu equipo. Ese archivo no se versiona.

## Actualización desde la estructura anterior

| Antes       | Ahora           |
| ----------- | --------------- |
| `backend/`  | `apps/api/`     |
| `frontend/` | `apps/web/`     |
| `android/`  | `apps/android/` |

Actualiza las carpetas abiertas en tu editor. Si instalas sin Docker, ejecuta `npm ci` en la
raíz y `npm --prefix apps/api ci` para reconstruir las dependencias en la nueva ubicación.
El código fuente, las migraciones y los recursos se conservan. No elimines volúmenes de MySQL
para actualizar esta estructura.
