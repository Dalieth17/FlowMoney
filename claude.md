# claude.md — Contexto de FlowMoney

> Archivo de contexto para Claude. Léelo al inicio de cada sesión en vez de re-derivar todo.
> Mantenlo corto y actualízalo cuando cambie una decisión. Ahorra tokens.

## Qué es
App Android de **finanzas personales**, 100% **offline**. Control de ingresos, gastos,
presupuestos, reportes y balance. Nombre: **FlowMoney**. Idioma de UI: **español**.

## Arquitectura (acordada)
- MVVM + **Clean Architecture**, 3 capas: `presentation / domain / data`.
- UI: **Jetpack Compose** + Material 3. Async: **Coroutines + Flow**.
- Persistencia: **Room** (SQLite). DI: **Hilt**. Navegación: **Navigation Compose**.
- Gráficos: **Vico** (preferido sobre MPAndroidChart). IA: reglas heurísticas por
  palabras clave en local (ML Kit opcional, nunca en la nube).

## Paquete base
`com.flowmoney` → `data/{local,repository}`, `domain/{model,repository,usecase}`,
`presentation/{ui,viewmodel,components}`, `di`, `util`.

## Entidades Room
- **Transaction**: id, amount:Double, description:String, date:Long, type(INCOME/EXPENSE),
  categoryId:Int(FK), accountId:Int?(FK), note:String?
- **Category**: id, name, icon(String Material), color(hex), isDefault:Boolean
- **Budget**: id, categoryId(FK), amount:Double, month:Int, year:Int
- **Account** (opcional): id, name, type(CASH/BANK/SAVINGS), initialBalance

## Orden de desarrollo (por módulo: Entity+DAO+Repo+UseCase+ViewModel+Screen)
1. Setup proyecto (build.gradle, AppDatabase, Hilt) → **hecho el diseño web, falta Android**
2. Categorías → 3. Movimientos → 4. Presupuestos → 5. Reportes → 6. IA
> Esperar confirmación del usuario antes de pasar al siguiente módulo.

## Ramas (git)
- Trabajo de desarrollo en **DEV**. **QA** para revisión de calidad.
- No tocar `main`/`master` sin permiso. Push con `git push -u origin <rama>`.

## Entregable web (hecho — FULL‑STACK con login + MySQL)
`docker compose up --build` → http://localhost:8080. 3 servicios: **db (MySQL 8) + api (Node/Express) + web (Nginx)**.
- Frontend (`frontend/`, Nginx): `index.html` (landing), `login.html` (registro/login), `app.html` (panel).
  `assets/js`: `api.js` (cliente /api), `data.js` (caché + mutaciones vs API), `ai.js` (IA local), `charts.js`,
  `ui.js`, `auth.js`, `format.js`, `app.js` (router + 5 vistas). Sin build step.
- Backend (`backend/`, Express): `server.js`, `db.js` (pool MySQL + migración + siembra por usuario),
  `schema.sql`, `middleware/auth.js` (JWT en cookie httpOnly, bcrypt), `routes/auth.js`, `routes/api.js`.
  Datos SIEMPRE acotados por `user_id`. Al registrarse se siembran categorías + datos de ejemplo del mes.
- nginx.conf hace proxy `/api` → `api:3000` (mismo origen, sin CORS). `.env.example` para secretos.
- Moneda `$` (cambiar en `format.js` → `CURRENCY`). Mes: 0‑based (JS Date) en front y en DB (`budgets.month`,
  `transactions.date` = epoch ms BIGINT).
- Verificado end‑to‑end (register/login/bootstrap/CRUD/presupuestos/logout) contra MySQL real.
  Nota: `docker build` del api falla SOLO dentro del sandbox (proxy TLS bloquea npm); en una máquina normal funciona.

## Sistema de diseño (tokens — reusar en la app Android)
- Paper `#F1F4EF` · Ink `#16231E` · Pine `#1F4D3A` · Sage `#6B8F7D` · Brass `#C08A3E` · Clay `#C25A44`
- Ingresos/positivo = pine/sage. Gastos = clay. Acento/saldo = brass. Alerta presupuesto >80%.
- Tipografía web: **Fraunces** (display serif) + **Hanken Grotesk** (UI, cifras tabulares).
- En Android: traducir a Material 3 ColorScheme con estos roles; cifras con `tabularNums`.

## Convenciones
- Código limpio, comentarios solo donde aporten. Guías oficiales de Android/Kotlin.
- Montos: Double en datos; formatear en UI. Fechas: Long (epoch millis).
- Por entrega indicar: decisiones clave + dependencias nuevas necesarias.

## Estado actual
- [x] Diseño web elegante + Docker
- [x] Sitio web PC **full‑stack**: login de usuarios + **MySQL** + API Node + CRUD/presupuestos/reportes/IA
- [x] claude.md
- [ ] Setup Android (Gradle, Hilt, AppDatabase)
- [ ] Módulos 2–6 (referencia lista: `backend/schema.sql` = entidades; `ai.js` = reglas IA)
