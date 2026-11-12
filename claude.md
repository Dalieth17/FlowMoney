# claude.md — Contexto de FlowMoney

> Léelo al inicio de cada sesión en vez de re‑explorar el repo. Mantenlo corto y al día.

## Qué es

Finanzas personales (ES). **Sitio web full‑stack** listo y app Android (Kotlin, Compose, Room,
Hilt, Clean Architecture, MVVM) en desarrollo por módulos.

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
- Docker: web en 8080 (`WEB_PORT`); MySQL publicado solo en `127.0.0.1:3309` (`MYSQL_PORT`, nunca
  3306: el usuario tiene un MySQL local). Dentro de la red de Docker la API usa `db:3306`.

## Diseño (tokens.css)

Paper `#f1f4ef` · Ink `#16231e` · Pine `#1f4d3a` (ingresos) · Clay `#c25a44` (gastos/alertas)
· Brass `#c08a3e` (saldo/acento) · Sage `#6b8f7d`. Fraunces (display) + Hanken Grotesk (UI).

## Android (`android/`)

- Módulos: `:domain` (Kotlin puro, testFixtures con `FakeCategoryRepository` y
  `FakeTransactionRepository`) y `:app`
  (`com.flowmoney`: data/local, data/repository, di, presentation/{theme,components,navigation,ui}, util).
- Patrón por módulo: Entity+DAO (Room) → Repository (contrato en domain, impl en app) →
  UseCase (devuelve `Outcome<T, XError>`) → ViewModel (`uiState: StateFlow`, `onEvent(Event)`,
  `messages: Flow` para snackbars) → Screen (con estado) + Content (sin estado, previews y tests).
- Ids `Long`; colores "#RRGGBB"; íconos = clave de Material (catálogo en `CategoryVisuals.kt`).
- Textos en `res/values/strings.xml`; errores de dominio → texto en `CategoryTexts.kt` /
  `MovementTexts.kt`.
- Dinero en céntimos `Long` (`Money.parseToCents` acepta "12,50" o "12.50"); fechas `LocalDate`
  guardadas como días‑época; `Clock` inyectado (`TimeModule`) para tests deterministas.
- Esquema Room: subir `version` + `MIGRATION_X_Y` en `data/local/migrations/Migrations.kt` +
  caso en `MigrationTest` (crea la v1 a mano y migra). Sin migración destructiva.
- Navegación: barra inferior en `FlowMoneyNavHost` (`TopLevelTab`); cada pestaña es un destino
  `@Serializable`. Las pantallas tienen su propio Scaffold (insets ya consumidos por el padre).
- Componentes compartidos en `presentation/components`: `MonthSelector`, `AmountField`, `CategoryAvatar`.
- Formularios: `XEditorSheet` (ModalBottomSheet) envuelve a `XEditorForm`, que es lo que se testea.
- Tests de Compose: Robolectric usa una pantalla baja; con listas largas usar
  `@Config(qualifiers = "w411dp-h891dp")` y `performScrollTo()` antes de tocar botones.
- Nombres de test **solo ASCII** (sin tildes): Kotlin los convierte en nombres de archivo .class.
- Este sandbox no tiene Android SDK (dl.google.com bloqueado; el usuario no quiso cambiar la red):
  `:domain` se prueba aquí con un settings temporal; `:app` lo compila/prueba/lintea el CI.

## Estado

- [x] Web: landing + login + panel (7 vistas) + MySQL + API en capas + 63 tests + CI
- [x] Android: setup (Gradle, Hilt, Room, Compose) + módulo **Categorías**
- [x] Android: módulo **Movimientos** (BD v3, pantalla inicial con barra inferior)
- [x] Android: módulo **Presupuestos** (BD v4: `budgets` por categoría y mes `aaaamm`; avisos 80/100 %)
- [ ] Android: Reportes → IA (esperar confirmación entre módulos)
- Ideas web: recuperar contraseña por correo, movimientos recurrentes, gráfico por cuenta.
