# FlowMoney

App de finanzas personales. Este repositorio contiene el **sitio web full‑stack**
(landing + app con cuentas de usuario) y servirá de referencia para la app Android
(Kotlin · Jetpack Compose · Room · Clean Architecture).

Stack web: **Nginx** (estáticos) + **API Node/Express** + **MySQL**, con **login de usuarios**
(registro, sesión con JWT en cookie httpOnly) y datos por usuario. Todo en Docker.

## Ejecutar (un solo comando)

```bash
docker compose up --build
```

Abre http://localhost:8080 →

1. **Landing** con el hero "río de flujo".
2. **Crear cuenta / Ingresar** (`/login.html`).
3. **Panel** (`/app.html`) ya con datos de ejemplo cargados para tu usuario.

> Para producción, copia `.env.example` a `.env` y cambia las contraseñas y el `JWT_SECRET`.

## Qué hace

Cada usuario tiene sus propios datos, guardados en **MySQL**:

- **Login** — registro e inicio de sesión; sesión con JWT en cookie httpOnly; contraseñas con bcrypt.
- **Resumen** — ingresos/gastos/balance, flujo semanal, gasto por categoría, alertas de presupuesto y movimientos recientes.
- **Movimientos** — alta, edición y borrado, con filtros por tipo y categoría.
- **Categorías** — predeterminadas + creación de propias (ícono y color).
- **Presupuestos** — límite por categoría con aviso automático al 80% y al superarlo.
- **Reportes** — dona por categoría, barras de 6 meses, tasa de ahorro y **Exportar PDF** (imprimir).
- **IA** — al escribir la descripción, sugiere la categoría (clasificador local por palabras clave).

En la barra lateral: "Restaurar ejemplo" (reinicia tus datos) y "Cerrar sesión".

## Arquitectura

```
┌────────────┐   /          ┌──────────────┐   /api/*   ┌──────────────┐
│  Navegador │ ───────────► │  web (Nginx) │ ─────────► │  api (Node)  │
└────────────┘   8080:80    │  estáticos   │  proxy     │  Express     │
                            └──────────────┘            └──────┬───────┘
                                                               │ mysql2
                                                        ┌──────▼───────┐
                                                        │  db (MySQL)  │
                                                        └──────────────┘
```

## Estructura

```
frontend/                   Cliente (Nginx)
  index.html                Landing (hero "río de flujo")
  login.html                Login / registro
  app.html                  Panel (shell)
  assets/css/app.css        Estilos (sistema de diseño compartido)
  assets/js/
    api.js                  Cliente HTTP hacia /api
    data.js                 Caché + mutaciones contra la API
    ai.js                   Clasificador local por palabras clave
    charts.js               Dona y barras en SVG
    ui.js                   Modal, toast, confirm, pickers
    auth.js                 Lógica del login
    format.js               Moneda, fechas, semanas
    app.js                  Router + 5 vistas + formularios
backend/                    API (Node/Express)
  server.js                 App Express
  db.js                     Pool MySQL, migración y siembra por usuario
  schema.sql                Esquema de la base de datos
  middleware/auth.js        JWT en cookie httpOnly
  routes/auth.js            register / login / logout / me
  routes/api.js             categorías, movimientos, presupuestos (por usuario)
  Dockerfile
Dockerfile · nginx.conf     Imagen web (Nginx) + proxy a la API
docker-compose.yml          db (MySQL) + api (Node) + web (Nginx)
.env.example                Variables (contraseñas, JWT_SECRET)
claude.md                   Contexto del proyecto
```

## API (resumen)

| Método | Ruta                     | Descripción                        |
|--------|--------------------------|------------------------------------|
| POST   | `/api/auth/register`     | Crea cuenta + siembra datos        |
| POST   | `/api/auth/login`        | Inicia sesión                      |
| POST   | `/api/auth/logout`       | Cierra sesión                      |
| GET    | `/api/auth/me`           | Usuario actual                     |
| GET    | `/api/bootstrap`         | Todos los datos del usuario        |
| POST/PUT/DELETE | `/api/transactions[/:id]` | CRUD de movimientos         |
| POST/PUT/DELETE | `/api/categories[/:id]`   | CRUD de categorías          |
| PUT    | `/api/budgets`           | Define/actualiza presupuesto       |
| POST   | `/api/data/reset`        | Reinicia a datos de ejemplo        |

## Ramas

- `DEV` — desarrollo.
- `QA` — revisión de calidad.

## Siguiente paso

Setup del proyecto Android (Gradle, Hilt, Room `AppDatabase`) y luego los módulos:
Categorías → Movimientos → Presupuestos → Reportes → IA. El esquema (`backend/schema.sql`)
y las reglas de IA (`frontend/assets/js/ai.js`) ya sirven de referencia.
