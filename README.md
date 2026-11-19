# FlowMoney

Finanzas personales: ingresos, gastos, cuentas, presupuestos y reportes, con sugerencia de
categoría por IA. Este repositorio contiene el **sitio web full‑stack** (landing + panel con
cuentas de usuario) y servirá de referencia para la app Android (Kotlin · Compose · Room).

**Stack:** Nginx (estáticos) · API Node.js 24 + Express · MySQL 8 · Docker Compose.
Frontend en JavaScript nativo con módulos ES (sin paso de build).

## Organización del repositorio

```text
apps/api/       API, migraciones MySQL y pruebas del servidor
apps/web/       Sitio, panel web, configuración Nginx y pruebas web
apps/android/   Aplicación Android y módulos Gradle
docs/           Arquitectura y guía de desarrollo
.github/        Automatización de calidad
```

Consulta el [índice de documentación](docs/README.md), la
[arquitectura](docs/architecture.md) y la [guía de desarrollo](docs/development.md).
Compose y las herramientas de calidad se ejecutan desde esta raíz.

## Ejecutar

```bash
docker compose up --build
```

Abre http://localhost:8080 → **Crear cuenta** → el panel arranca con un mes de ejemplo.

### Recuperar acceso a la cuenta

En **Ingresar → ¿Olvidaste tu contraseña?**, solicita un enlace con tu correo. Dura 30 minutos,
solo funciona una vez y al cambiar la contraseña cierra las sesiones de todos los dispositivos.
Cambiar la contraseña desde Perfil también invalida los enlaces pendientes. Se limita la solicitud
por IP y se espera un minuto entre correos para la misma cuenta; la respuesta no revela si existe.

En localhost, Compose inicia **Mailpit**: abre http://localhost:8025 para leer el correo de prueba.
Los mensajes se capturan ahí y no se envían a tu bandeja real. Puedes usar cualquier correo de
pruebas al registrarte. `MAIL_UI_PORT` cambia el puerto del buzón local.

En producción configura `PUBLIC_APP_URL=https://tu-dominio`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD` y `SMTP_FROM` de tu proveedor de correo. Para 587 usa `SMTP_SECURE=false`
(STARTTLS obligatorio en producción); para 465 usa `SMTP_SECURE=true`. El origen público se valida
al arrancar y nunca se toma de cabeceras enviadas por el cliente. Sin SMTP configurado en producción
se indica que la recuperación no está disponible. Si ejecutas Node sin Compose en desarrollo,
apunta `SMTP_HOST`/`SMTP_PORT` a un servidor SMTP accesible desde ese proceso.

### Conversión entre pesos y dólares (web)

En **Perfil → Moneda**, al elegir COP o USD se consulta automáticamente la tasa de
[ExchangeRate-API](https://www.exchangerate-api.com). Se muestra cuántos COP equivalen a 1 USD,
la fecha de cotización y una equivalencia de ejemplo. La consulta no envía datos del usuario;
no requiere clave y se comparte en caché durante una hora. Se rechazan cotizaciones de más de 72 horas.
Si falla, puedes introducir una tasa manual (hasta seis decimales).

Al confirmar se convierten en una sola transacción cuentas, movimientos, presupuestos,
transferencias y comisiones, conciliaciones, recurrencias y metas/aportes de ahorro.
Se conservan IDs e historial de ejecuciones para evitar duplicados. La tasa y su origen quedan
registrados; Perfil muestra la última conversión. Se redondea a dos decimales: volver a convertir
puede producir diferencias de centavos. Si un monto positivo quedaría por debajo de 0.01,
excede el límite o pierde coherencia, se rechaza toda la conversión sin guardar cambios.
Los formularios abiertos en otra pestaña con la moneda anterior se rechazan al guardar para
evitar mezclar pesos con dólares; recarga esa pestaña antes de continuar.
La tasa es orientativa y puede diferir de la de un banco. Android mantiene su funcionamiento offline.

| Puerto en tu equipo | Servicio | Variable (`.env`) | Notas                                                    |
| ------------------- | -------- | ----------------- | -------------------------------------------------------- |
| 8080                | Web      | `WEB_PORT`        | El sitio y la API (`/api`).                              |
| 3309                | MySQL    | `MYSQL_PORT`      | Solo desde tu equipo (`127.0.0.1`), para Workbench, etc. |

MySQL usa el **3309** (y no el 3306) para convivir con un MySQL que ya tengas instalado. Si algún
puerto está ocupado, crea un archivo `.env` junto a `docker-compose.yml` con otro valor
(p. ej. `MYSQL_PORT=3310`) y vuelve a ejecutar el comando. Para entrar a la base con un cliente:
host `127.0.0.1`, puerto `3309`, usuario y contraseña `flowmoney` (base `flowmoney`).

Para producción copia `.env.example` a `.env`, configura `NODE_ENV=production`, contraseñas
propias y `COOKIE_SECURE=true`, y termina HTTPS en un proxy exterior. La API rechaza el arranque
en producción si la contraseña de base de datos es de ejemplo o tiene menos de 16 caracteres,
o si las cookies no son seguras. Cambia también la contraseña root de MySQL.
Compose usa modo desarrollo por defecto para que la demostración local siga funcionando por HTTP.
La API confía en un único Nginx (`TRUST_PROXY=1`), que sustituye `X-Forwarded-For` con la IP
de su conexión. Si añades proxies exteriores, configura explícitamente las redes de confianza
en Nginx; no aceptes cabeceras de IP directamente de internet.

Los movimientos web usan días de **America/Bogota** en todos los dispositivos, fechas entre
2000 y 2100 y timestamps al mediodía colombiano para entradas nuevas. Los timestamps existentes
se conservan. Usuarios que antes registraban desde otras zonas deben revisar movimientos
cercanos al cambio de día. Android continúa usando `LocalDate` offline.

La lista web muestra 50 movimientos por página y carga el histórico en peticiones de hasta 200.
`GET /api/transactions/page?limit=100&beforeId=123&from=...&to=...` devuelve `{items,nextCursor}`,
ordenado por ID descendente, con rangos en epoch ms e inclusivos. `nextCursor=null` indica el final.
La carga inicial usa `/api/bootstrap?transactions=none`. Se mantiene el bootstrap completo para
compatibilidad. **Reportes** consulta agregados de MySQL para el mes y los últimos seis meses,
con filtro por cuenta o por movimientos sin cuenta, distribución por categoría y actividad por
cuenta con tabla de importes. Se puede imprimir el período filtrado como PDF.
**Cuentas** y las conciliaciones también consultan saldos agregados en MySQL, incluidos saldos
actuales, proyectados y número de movimientos. Resumen y los filtros locales de Movimientos
todavía utilizan el histórico cargado en el navegador.

Desde esta versión, las altas, ediciones y borrados individuales de movimientos dejan un
historial atómico en `transaction_history` (migración 006). Se consulta con
`GET /api/transactions/:id/history` (últimos 100 cambios, solo del usuario autenticado).
No reconstruye cambios antiguos ni registra la siembra o el reinicio masivo. Al eliminar
la cuenta también desaparece su historial. Perfil permite exportar todos los datos activos a
JSON además del CSV de movimientos. El JSON no incluye contraseñas ni sesiones ni sustituye
una copia de seguridad del servidor. Se restaura desde Operaciones, con vista previa y contraseña.

Las sesiones vencidas se limpian al arrancar y cada minuto en lotes de 1000. Las migraciones
se serializan con un bloqueo MySQL para impedir que dos instancias las apliquen simultáneamente.
Los DDL de MySQL no ofrecen rollback conjunto: respalda la base antes de actualizar.

El registro, el ingreso y el cambio de contraseña crean sus sesiones dentro de la misma
transacción que valida o modifica las credenciales; la cookie se envía después del commit.
Si falla crear la sesión, también se revierte el registro o cambio de contraseña.
Los saldos actuales incluyen todo el día civil de Colombia, hasta las 23:59:59.999;
los movimientos posteriores afectan únicamente al saldo proyectado.

## Funciones

| Sección          | Qué hace                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cuenta**       | Registro e ingreso; sesiones revocables en el servidor (cookie httpOnly); contraseñas con scrypt.                                                                            |
| **Resumen**      | Ingresos, gastos y balance del mes, flujo semanal, gasto por categoría, alertas.                                                                                             |
| **Movimientos**  | Alta, edición y borrado; búsqueda por texto; filtros por tipo, categoría y cuenta; CSV.                                                                                      |
| **Cuentas**      | Efectivo, banco y ahorros con saldo = saldo inicial + ingresos − gastos.                                                                                                     |
| **Categorías**   | Predeterminadas + propias con ícono y color.                                                                                                                                 |
| **Presupuestos** | Límite mensual por categoría; aviso al 80 % y al superarlo.                                                                                                                  |
| **Reportes**     | Dona por categoría, barras de 6 meses, tasa de ahorro, exportar a PDF (imprimir).                                                                                            |
| **Perfil**       | Nombre, moneda (pesos COP o dólares USD), tema, cambio de contraseña, exportar todo, restaurar ejemplo.                                                                      |
| **Legal**        | Términos de uso y Política de tratamiento de datos (Ley 1581 de 2012); aceptación obligatoria al registrarse, guardada con versión y fecha; eliminar la cuenta desde Perfil. |
| **Apariencia**   | Dos temas a elección: **Verde y negro** (por defecto) o **Blanco y negro**. Escenas 3D con Three.js.                                                                         |
| **IA**           | Sugiere la categoría al escribir la descripción (reglas por palabras clave, en el navegador).                                                                                |

## Arquitectura

Pequeñas ayudas de uso: el selector de fechas incluye **Mes actual** para regresar de un salto;
en Movimientos, los filtros activos aparecen como etiquetas que puedes quitar individualmente.
Los botones muestran un indicador mientras procesan una acción e impiden repetir esa misma
acción antes de que termine. Las animaciones respetan la preferencia de movimiento reducido.

El gráfico 3D de **Resumen → Gastos por día** usa únicamente los movimientos del mes
seleccionado: la altura de cada columna representa el gasto de ese día, con escala monetaria
visible. Los días sin gastos no generan columnas y los gastos registrados para fechas futuras
se muestran delineados como **Programados**, sin estimaciones automáticas basadas en presupuestos.
Ingresos, transferencias y ajustes de conciliación no se cuentan como gastos; las comisiones sí.
Se recalcula al crear, editar o borrar movimientos, cambiar de mes, moneda o tema.
La tabla «Ver importes por día» permite comprobar gasto y acumulado. Sin WebGL, o si falla
su carga, el gráfico SVG conserva exactamente los mismos datos diarios y la misma escala.

```
Navegador ──► web (Nginx :8080) ──/api──► api (Express :3000) ──► db (MySQL 8)
              estáticos + CSP              routes → services → repositories
```

La API no publica ningún puerto (vive en la red interna de Docker) y MySQL solo se publica en
`127.0.0.1`, así que la base no queda expuesta a otros equipos de la red.

### Backend (`apps/api/src`) — capas al estilo Clean Architecture

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

### Frontend (`apps/web/public/assets/js`)

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
npm ci && npm --prefix apps/api ci
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
DB_HOST=127.0.0.1 DB_PORT=3308 npm run test:integration
```

GitHub Actions (`.github/workflows/ci.yml`) corre lint, formato, todos los tests (con MySQL) y
el build de las imágenes en cada push a `DEV`, `QA` y `main`, y en cada pull request.

## API

Todas las rutas (salvo `health` y `auth`) requieren sesión y operan solo sobre los datos del usuario.

| Método              | Ruta                                                    | Descripción                               |
| ------------------- | ------------------------------------------------------- | ----------------------------------------- |
| GET                 | `/api/health`                                           | Estado de la API                          |
| POST                | `/api/auth/register`, `/api/auth/login`                 | Crea cuenta / inicia sesión               |
| POST                | `/api/auth/forgot-password`, `/api/auth/reset-password` | Solicita enlace / cambia contraseña       |
| POST · GET          | `/api/auth/logout` · `/api/auth/me`                     | Cierra sesión · usuario actual            |
| GET                 | `/api/bootstrap`                                        | Todos los datos del usuario               |
| GET · PUT           | `/api/profile` · `/api/profile/password`                | Perfil y moneda · cambio de contraseña    |
| GET POST PUT DELETE | `/api/transactions[/:id]`                               | Movimientos                               |
| GET POST PUT DELETE | `/api/accounts[/:id]`                                   | Cuentas                                   |
| GET                 | `/api/accounts/balances`                                | Saldos SQL actuales/proyectados y conteos |
| GET                 | `/api/reports/monthly?month=0&year=2026&accountId=none` | Reporte SQL; cuenta opcional, mes 0–11    |
| GET POST PUT DELETE | `/api/categories[/:id]`                                 | Categorías                                |
| GET · PUT           | `/api/budgets`                                          | Presupuestos (PUT con monto 0 lo elimina) |
| POST                | `/api/data/reset`                                       | Restaura el mes de ejemplo                |

Errores: `{ "error": "mensaje en español" }` con 400 (validación), 401, 404, 409 (regla de negocio) o 429.

## App Android (`apps/android/`)

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

- **Tema** — después de la moneda se elige **Verde y negro** u **Blanco y negro**; se cambia luego con
  el botón de paleta en Movimientos. Reportes muestra una dona 3D que gira (quieta si el sistema
  desactiva las animaciones).
- **Moneda** — al abrir la app por primera vez se elige **pesos colombianos (COP)** o **dólares
  (USD)**; se cambia después con el botón de moneda en Movimientos. COP se muestra como
  `$ 4.500.000` (sin centavos si no los hay) y USD como `US$ 1,234.56`. Los montos se pueden
  escribir con separador de miles (`4.500.000`, `1,234.50`). Cambiar de moneda no convierte montos.

La base de datos se actualiza con migraciones de Room (probadas en `MigrationTest`), nunca borrando
datos. Los porcentajes se reparten de modo que siempre sumen 100.

```bash
cd apps/android && ./gradlew :domain:test :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Requiere JDK 17+ y el Android SDK (Android Studio lo instala). Las versiones están fijadas en
`apps/android/gradle/libs.versions.toml`. CI publica el APK de depuración como artefacto
(**Actions → CI → flowmoney-debug-apk**) para instalarlo sin compilar.

## Operaciones financieras (web y API)

En **Operaciones** se crean y editan transferencias entre dos cuentas propias. Cada transferencia
guarda la salida, entrada y comisión opcional en una misma transacción MySQL. Los movimientos
internos y ajustes de conciliación no cuentan en ingresos, gastos ni presupuestos; las comisiones
sí cuentan como gasto. No se permite editar o borrar una sola parte desde Movimientos.

**Conciliar saldos** compara el saldo calculado hasta hoy (America/Bogota) con el saldo real
observado. Muestra el ajuste antes de confirmarlo y guarda el motivo. El servidor rechaza una
conciliación si el saldo cambió mientras se revisaba. Los movimientos futuros se muestran en el
saldo proyectado. Para corregir una conciliación se registra otra, conservando el historial.

Las **recurrencias son mensuales y de confirmación manual**: pulsa Procesar pendientes para
registrar los períodos vencidos, hasta 120 por solicitud. Un día 31 se ajusta al último día del mes.
Se pueden editar, pausar, reanudar y limitar con una fecha final; las ediciones afectan únicamente
períodos aún no procesados. Reanudar incluye períodos pendientes de la pausa: ajusta la fecha de
inicio si prefieres omitirlos. La clave única por recurrencia y mes, junto al bloqueo por usuario,
evita duplicados incluso con peticiones simultáneas. Borrar un movimiento generado no habilita
volver a generarlo. No existe un servicio programado que ejecute recurrencias con la app cerrada.

**Respaldos** exporta JSON versión 3 directamente del servidor, con una lectura consistente de
cuentas, categorías, movimientos, presupuestos, operaciones, recurrencias y períodos procesados.
Para restaurar, selecciona el archivo, revisa las cantidades y moneda, escribe tu contraseña y
confirma el reemplazo. Se validan referencias, pares de transferencias y ajustes antes de borrar;
todo el reemplazo es atómico y hace rollback ante errores. Se reasignan IDs al usuario actual y
se preserva el registro de recurrencias para evitar regenerarlas. El perfil y contraseña no se
importan; sí la moneda. No incluye sesiones, contraseñas ni el historial técnico de auditoría.
Se aceptan también los JSON versión 2 y los de versión 1 de Perfil que solo contienen movimientos normales.
La vista previa informa cuántas metas y aportes hay; restaurar una copia antigua sin metas reemplaza también las metas actuales por una lista vacía.
Límites de importación: 20 MB, 20.000 movimientos, 1.000 cuentas y 1.000 recurrencias.
Descarga una copia actual antes de restaurar. Esto no sustituye los respaldos de MySQL.

API autenticada: `GET /api/finance`, `POST/PUT/DELETE /api/finance/transfers/:uuid`,
`POST /api/finance/reconciliations/:uuid`, `POST /api/finance/schedules`,
`PUT /api/finance/schedules/:id`, `POST /api/finance/schedules/run`,
`GET /api/finance/backup`, `POST /api/finance/backup/preview` y
`POST /api/finance/backup/restore`. Reutiliza el UUID en reintentos de una operación y
`creationKey` en reintentos de creación de una recurrencia. El esquema nuevo se aplica con
`007_financial_operations.sql`. Android mantiene sus funciones offline actuales.

## Metas de ahorro (web)

En **Metas de ahorro** puedes crear objetivos con fecha límite opcional, consultar el progreso,
registrar aportes y retiros, corregir registros y archivar/reactivar objetivos. El aporte diario
sugerido reparte lo que falta entre los días restantes contando hoy; es orientativo y no calcula intereses.
Las metas vencidas y las completadas se identifican automáticamente.

Son registros independientes: no reservan fondos, no afectan cuentas, ingresos, gastos ni presupuestos.
No asignes el mismo dinero a varias metas. Para mover fondos reales entre cuentas utiliza Operaciones.
No se admiten retiros que dejen un ahorro negativo ni aportes con fecha futura.

Las metas y su historial se incluyen en respaldos v3, con validación de referencias e importes y
restauración atómica. La migración `008_savings_goals.sql` crea sus tablas. API autenticada:
`GET /api/goals`, `POST/PUT /api/goals/:uuid`, `POST /api/goals/:uuid/entries/:entryUuid` y
`DELETE /api/goals/:uuid/entries/:entryUuid`. Reutiliza UUIDs en reintentos para evitar duplicados.
Android continúa con su alcance offline actual.

## Ramas

- `DEV` — desarrollo.
- `QA` — revisión de calidad.
