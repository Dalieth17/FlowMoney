# claude.md — Contexto de FlowMoney

> Léelo al inicio de cada sesión en vez de re‑explorar el repo. Mantenlo corto y al día.

## Qué es

Finanzas personales (ES). Hoy: **sitio web full‑stack** listo. Después: app Android
(Kotlin, Compose, Room, Hilt, Clean Architecture, MVVM) — pendiente de empezar.

## Ramas y flujo

- Trabajar en **DEV**; sincronizar **QA** para revisión. `git push -u origin <rama>`.
- Antes de commitear: `npm run check` (lint + formato + tests unitarios) y, si toca la API,
  `test:integration` con MySQL (ver README). CI en `.github/workflows/ci.yml`.

## Estructura

```
backend/src/   config · db (pool, migrate, seed, migrations/*.sql) · repositories · services
               · routes (crudRouter + *.routes) · validation (zod) · middleware · utils
backend/tests/ unit (sin BD) · integration (MySQL real, supertest)
frontend/public/ index.html (landing) · login.html · app.html
  assets/js/   core (api, store, router, format) · domain (selectors, classifier, rules, csv,
               accountTypes) · ui (dom, feedback, widgets, charts, pickers, exportCsv)
               · forms · views (resumen, movimientos, cuentas, categorias, presupuestos,
               reportes, perfil) · pages (app, login)
  assets/css/  tokens.css (diseño) · app.css · auth.css · landing.css
frontend/nginx/ default.conf + security-headers.conf (incluir en CADA location)
frontend/tests/ tests de domain/ y format (node:test)
```

## Convenciones (respetar)

- Backend en capas: route (valida con zod → `req.valid`) → service (reglas, `HttpError`) →
  repository (SQL parametrizado, acepta `conn` para transacciones). Todo filtrado por `user_id`.
- Errores API: `{ error }` en español; 400 validación, 401 sesión, 404, 409 regla de negocio.
  Contraseña actual incorrecta = 400 (401 haría que el front redirija al login).
- Cambios de esquema = **nueva migración** `NNN_descripcion.sql` (nunca editar las aplicadas).
- Frontend: vistas montan con `mount(root, ...)` (nunca `append(null)`); texto siempre por
  `h()`/textContent; `html:` solo para SVG propio. Lógica pura en `domain/` (+ test).
- Montos DECIMAL(12,2) → number; fechas epoch ms (BIGINT); mes 0‑based (como JS Date).
- Moneda por usuario (`users.currency`: `$`, `S/`, `US$`, `€`); `setCurrency()` en el store.
- Prettier (120 col, comillas simples) y ESLint flat config en la raíz; HTML fuera de Prettier.

## Diseño (tokens.css)

Paper `#f1f4ef` · Ink `#16231e` · Pine `#1f4d3a` (ingresos) · Clay `#c25a44` (gastos/alertas)
· Brass `#c08a3e` (saldo/acento) · Sage `#6b8f7d`. Fraunces (display) + Hanken Grotesk (UI).

## Estado

- [x] Landing + login + panel (7 vistas) + MySQL + API en capas + migraciones
- [x] Cuentas con saldos, perfil (moneda/contraseña), búsqueda y CSV, IA local
- [x] 63 tests (31 front, 17 API unit, 15 integración) + E2E manual con Playwright
- [ ] Android: setup (Gradle, Hilt, Room) → Categorías → Movimientos → Presupuestos → Reportes → IA
- Ideas web: recuperar contraseña por correo, movimientos recurrentes, gráfico por cuenta.
