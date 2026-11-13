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

| Puerto en tu equipo | Servicio | Variable (`.env`) | Notas                                                    |
| ------------------- | -------- | ----------------- | -------------------------------------------------------- |
| 8080                | Web      | `WEB_PORT`        | El sitio y la API (`/api`).                              |
| 3309                | MySQL    | `MYSQL_PORT`      | Solo desde tu equipo (`127.0.0.1`), para Workbench, etc. |

MySQL usa el **3309** (y no el 3306) para convivir con un MySQL que ya tengas instalado. Si algún
puerto está ocupado, crea un archivo `.env` junto a `docker-compose.yml` con otro valor
(p. ej. `MYSQL_PORT=3310`) y vuelve a ejecutar el comando. Para entrar a la base con un cliente:
host `127.0.0.1`, puerto `3309`, usuario y contraseña `flowmoney` (base `flowmoney`).

Para producción copia `.env.example` a `.env`, define contraseñas propias y `COOKIE_SECURE=true`
si sirves por HTTPS.

## Funciones

| Sección          | Qué hace                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **Cuenta**       | Registro e ingreso; sesiones revocables en el servidor (cookie httpOnly); contraseñas con scrypt. |
| **Resumen**      | Ingresos, gastos y balance del mes, flujo semanal, gasto por categoría, alertas.                  |
| **Movimientos**  | Alta, edición y borrado; búsqueda por texto; filtros por tipo, categoría y cuenta; CSV.           |
| **Cuentas**      | Efectivo, banco y ahorros con saldo = saldo inicial + ingresos − gastos.                          |
| **Categorías**   | Predeterminadas + propias con ícono y color.                                                      |
| **Presupuestos** | Límite mensual por categoría; aviso al 80 % y al superarlo.                                       |
| **Reportes**     | Dona por categoría, barras de 6 meses, tasa de ahorro, exportar a PDF (imprimir).                 |
| **Perfil**       | Nombre, moneda ($, S/, US$, €), cambio de contraseña, exportar todo, restaurar ejemplo.           |
| **IA**           | Sugiere la categoría al escribir la descripción (reglas por palabras clave, en el navegador).     |

## Arquitectura

```
Navegador ──► web (Nginx :8080) ──/api──► api (Express :3000) ──► db (MySQL 8)
              estáticos + CSP              routes → services → repositories
```

La API no publica ningún puerto (vive en la red interna de Docker) y MySQL solo se publica en
`127.0.0.1`, así que la base no queda expuesta a otros equipos de la red.

### Backend (`backend/src`) — capas al estilo Clean Architecture

| Capa            | Responsabilidad                                                           |
| --------------- | ------------------------------------------------------------------------- |
| `routes/`       | HTTP: valida la entrada (zod) y responde. Sin lógica de negocio.          |
| `services/`     | Reglas: propiedad de los datos, categorías protegidas, cuentas en uso.    |
| `repositories/` | SQL parametrizado y mapeo fila → entidad. Aceptan una transacción.        |
| `validation/`   | Esquemas zod con mensajes en español.                                     |
| `db/`           | Pool, migraciones versionadas (`db/migrations/*.sql`) y datos de ejemplo. |
| `middleware/`   | Autenticación, validación, rate limit del login, errores centralizados.   |

Seguridad: sesiones opacas en el servidor (solo se guarda el hash del token; cerrar sesión o
cambiar la contraseña las revoca al instante), contraseñas con scrypt sin límite de 72 bytes
(los hashes bcrypt antiguos se renuevan al iniciar sesión), helmet, rate limit en login/registro,
cookies httpOnly + SameSite, consultas parametrizadas, operaciones de comprobar-y-borrar en
transacciones con bloqueo de filas, datos acotados por usuario e imágenes Docker sin root.

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

Necesitan un MySQL aparte, desechable (así no llenan de usuarios de prueba tu base de desarrollo).
Usa el puerto 3308 para no chocar con un MySQL local (3306) ni con el de `docker compose` (3309):

```bash
docker run -d --name flowmoney-test-db -p 127.0.0.1:3308:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=flowmoney -e MYSQL_USER=flowmoney -e MYSQL_PASSWORD=flowmoney mysql:8.0
```

```bash
DB_HOST=127.0.0.1 DB_PORT=3308 npm --prefix backend run test:integration
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

Estado:

- **Categorías** — lista, crear/editar con ícono y color, borrar con confirmación; las
  predeterminadas y las que tienen movimientos están protegidas; nombres únicos sin importar
  mayúsculas (también con tildes: `Educación` = `EDUCACIÓN`).
- **Movimientos** (pantalla inicial) — selector de mes, resumen de ingresos/gastos/balance,
  filtros por tipo y categoría, lista agrupada por día (Hoy, Ayer…), alta/edición en hoja inferior
  (monto con teclado decimal, categoría, calendario, nota) y borrado con confirmación.
  Montos en céntimos (`Long`) y fechas como día (`LocalDate`): sin errores de redondeo ni de zona horaria.

- **Presupuestos** — límite mensual por categoría (cada mes el suyo, como en la web) con barra de
  avance, aviso al 80 % y al superarlo, resumen del mes, gasto en categorías sin presupuesto,
  "repetir los límites" del último mes que los tenga y quitar con **Deshacer**. Al guardar un gasto
  que deja su categoría cerca o por encima del límite, Movimientos lo avisa en el momento.
- **Reportes** — resumen del mes (ingresos, gastos, balance, tasa de ahorro y comparación con el
  mes anterior), gráfico de dona por categoría con sus porcentajes, y barras de ingresos y gastos
  por semana o por mes. Exporta el reporte a **PDF** con el diálogo de impresión del sistema (los
  gráficos van como SVG; el documento no usa JavaScript ni red).

- **IA (todo en el teléfono, sin internet: tus datos no salen del dispositivo)**
  - _Sugerencia de categoría_ al escribir un movimiento: aprende de cómo clasificas tú, reconoce el
    nombre de tus categorías y usa las mismas palabras clave que la web. Se aplica sola mientras no
    elijas otra, y explica por qué la sugiere.
  - _Asesor financiero_: nota de salud financiera (0–100) con su desglose, cierre estimado del mes,
    regla 50/30/20 y recomendaciones priorizadas con tus cifras (gasto mayor que ingreso, presupuestos
    en riesgo con monto diario, categorías disparadas, gastos hormiga, suscripciones, fondo de
    emergencia, límites sugeridos…).
  - _Preguntas_ en lenguaje natural: «¿puedo comprar algo de 800?», «¿cuánto puedo gastar por día?»,
    «¿cómo ahorro más?», «¿en qué gasto más?», deudas, inversión, proyección y más.

La base de datos se actualiza con migraciones de Room (probadas en `MigrationTest`), nunca borrando
datos. Los porcentajes se reparten de modo que siempre sumen 100.

```bash
cd android && ./gradlew :domain:test :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Requiere JDK 17+ y el Android SDK (Android Studio lo instala). Las versiones están fijadas en
`android/gradle/libs.versions.toml`. CI publica el APK de depuración como artefacto
(**Actions → CI → flowmoney-debug-apk**) para instalarlo sin compilar.

## Ramas

- `DEV` — desarrollo.
- `QA` — revisión de calidad.
