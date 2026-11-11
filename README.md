# FlowMoney

Finanzas personales: ingresos, gastos, cuentas, presupuestos y reportes, con sugerencia de
categoría por IA. Este repositorio contiene el **sitio web full‑stack** (landing + panel con
cuentas de usuario) y servirá de referencia para la app Android (Kotlin · Compose · Room).

**Stack:** Nginx (estáticos) · API Node.js 24 + Express · MySQL 8 · Docker Compose.
Frontend en JavaScript nativo con módulos ES (sin paso de build).

## Ejecutar

```bash
docker compose up --build
```

Abre http://localhost:8080 → **Crear cuenta** → el panel arranca con un mes de ejemplo.

Para producción copia `.env.example` a `.env` y define contraseñas propias, `JWT_SECRET`
(`openssl rand -hex 32`) y `COOKIE_SECURE=true` si sirves por HTTPS.

## Funciones

| Sección          | Qué hace                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **Cuenta**       | Registro e ingreso; sesión con JWT en cookie httpOnly; contraseñas con bcrypt.                |
| **Resumen**      | Ingresos, gastos y balance del mes, flujo semanal, gasto por categoría, alertas.              |
| **Movimientos**  | Alta, edición y borrado; búsqueda por texto; filtros por tipo, categoría y cuenta; CSV.       |
| **Cuentas**      | Efectivo, banco y ahorros con saldo = saldo inicial + ingresos − gastos.                      |
| **Categorías**   | Predeterminadas + propias con ícono y color.                                                  |
| **Presupuestos** | Límite mensual por categoría; aviso al 80 % y al superarlo.                                   |
| **Reportes**     | Dona por categoría, barras de 6 meses, tasa de ahorro, exportar a PDF (imprimir).             |
| **Perfil**       | Nombre, moneda ($, S/, US$, €), cambio de contraseña, exportar todo, restaurar ejemplo.       |
| **IA**           | Sugiere la categoría al escribir la descripción (reglas por palabras clave, en el navegador). |

## Arquitectura

```
Navegador ──► web (Nginx :8080) ──/api──► api (Express :3000) ──► db (MySQL 8)
              estáticos + CSP              routes → services → repositories
```

Solo `web` publica un puerto; la API y MySQL viven en la red interna de Docker.

### Backend (`backend/src`) — capas al estilo Clean Architecture

| Capa            | Responsabilidad                                                           |
| --------------- | ------------------------------------------------------------------------- |
| `routes/`       | HTTP: valida la entrada (zod) y responde. Sin lógica de negocio.          |
| `services/`     | Reglas: propiedad de los datos, categorías protegidas, cuentas en uso.    |
| `repositories/` | SQL parametrizado y mapeo fila → entidad. Aceptan una transacción.        |
| `validation/`   | Esquemas zod con mensajes en español.                                     |
| `db/`           | Pool, migraciones versionadas (`db/migrations/*.sql`) y datos de ejemplo. |
| `middleware/`   | Autenticación, validación, rate limit del login, errores centralizados.   |

Seguridad: helmet, rate limit en login/registro, cookies httpOnly + SameSite, consultas
parametrizadas, todos los datos acotados por usuario, comparación de contraseña en tiempo
constante aunque el correo no exista, imágenes Docker sin root.

### Frontend (`frontend/public/assets/js`)

| Carpeta   | Contenido                                                                       |
| --------- | ------------------------------------------------------------------------------- |
| `core/`   | Cliente de la API, store (caché + mutaciones), router por hash, formato.        |
| `domain/` | Lógica pura y testeable: cálculos financieros, clasificador IA, CSV.            |
| `ui/`     | DOM seguro (sin `innerHTML` con datos), modal accesible, widgets, gráficos SVG. |
| `forms/`  | Formularios de movimiento, categoría y cuenta.                                  |
| `views/`  | Una vista por sección del panel.                                                |
| `pages/`  | Puntos de entrada de `app.html` y `login.html`.                                 |

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm install && npm --prefix backend install
```

```bash
npm run check
```

`npm run check` ejecuta ESLint, Prettier (`format:check`) y los tests unitarios de frontend y API.
Otros scripts: `npm run lint:fix`, `npm run format`, `npm run test:web`, `npm run test:api`.

### Tests de integración de la API

Necesitan un MySQL; por ejemplo:

```bash
docker run -d --name flowmoney-test-db -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=flowmoney -e MYSQL_USER=flowmoney -e MYSQL_PASSWORD=flowmoney mysql:8.0
```

```bash
DB_HOST=127.0.0.1 npm --prefix backend run test:integration
```

GitHub Actions (`.github/workflows/ci.yml`) corre lint, formato, todos los tests (con MySQL) y
el build de las imágenes en cada push a `DEV`, `QA` y `main`, y en cada pull request.

## API

Todas las rutas (salvo `health` y `auth`) requieren sesión y operan solo sobre los datos del usuario.

| Método              | Ruta                                     | Descripción                               |
| ------------------- | ---------------------------------------- | ----------------------------------------- |
| GET                 | `/api/health`                            | Estado de la API                          |
| POST                | `/api/auth/register`, `/api/auth/login`  | Crea cuenta / inicia sesión               |
| POST · GET          | `/api/auth/logout` · `/api/auth/me`      | Cierra sesión · usuario actual            |
| GET                 | `/api/bootstrap`                         | Todos los datos del usuario               |
| GET · PUT           | `/api/profile` · `/api/profile/password` | Perfil y moneda · cambio de contraseña    |
| GET POST PUT DELETE | `/api/transactions[/:id]`                | Movimientos                               |
| GET POST PUT DELETE | `/api/accounts[/:id]`                    | Cuentas                                   |
| GET POST PUT DELETE | `/api/categories[/:id]`                  | Categorías                                |
| GET · PUT           | `/api/budgets`                           | Presupuestos (PUT con monto 0 lo elimina) |
| POST                | `/api/data/reset`                        | Restaura el mes de ejemplo                |

Errores: `{ "error": "mensaje en español" }` con 400 (validación), 401, 404, 409 (regla de negocio) o 429.

## App Android (`android/`)

App offline (Room) con la misma identidad visual. Kotlin · Jetpack Compose · Material 3 · Hilt ·
Room · Navigation (rutas tipadas) · Coroutines/Flow. MVVM + Clean Architecture en dos módulos:

| Módulo    | Contenido                                                                                 |
| --------- | ----------------------------------------------------------------------------------------- |
| `:domain` | Kotlin puro: modelos, reglas, contratos de repositorio y casos de uso. Sin Android.       |
| `:app`    | `data` (Room, repositorios) · `di` (Hilt) · `presentation` (Compose, ViewModels) · `util` |

Estado: **setup + módulo Categorías** (lista, crear/editar con ícono y color, borrar con
confirmación, predeterminadas protegidas). Siguen Movimientos → Presupuestos → Reportes → IA.

```bash
cd android && ./gradlew :domain:test :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Requiere JDK 17+ y el Android SDK (Android Studio lo instala). Las versiones están fijadas en
`android/gradle/libs.versions.toml`. CI publica el APK de depuración como artefacto
(**Actions → CI → flowmoney-debug-apk**) para instalarlo sin compilar.

## Ramas

- `DEV` — desarrollo.
- `QA` — revisión de calidad.
