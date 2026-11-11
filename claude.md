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

## Entregable web (hecho — SITIO FUNCIONAL)
Sitio de escritorio contenerizado en Docker (`docker compose up --build` → http://localhost:8080):
- `frontend/index.html` — landing (hero "río de flujo").
- `frontend/app.html` + `assets/` — **app funcional** (SPA en JS vanilla, módulos ES).
  Persistencia en **localStorage** (offline). 5 vistas: Resumen, Movimientos (CRUD+filtros),
  Categorías (crear/editar), Presupuestos (alerta 80%), Reportes (dona+barras SVG, export PDF/print).
  IA de clasificación local en `assets/js/ai.js` (reglas por palabras clave, es-PE).
- JS: `format.js, data.js, ai.js, charts.js, ui.js, app.js`. Sin build step (nginx sirve estáticos).
- Nota: la app requiere servirse por HTTP (módulos ES); Docker ya lo hace.
- Moneda actual: `$` (cambiar en `assets/js/format.js` → `CURRENCY`). Mes en Store: 0-based (como JS Date).

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
- [x] Sitio web PC **funcional** (landing + app con CRUD, presupuestos, reportes, IA; offline)
- [x] claude.md
- [ ] Setup Android (Gradle, Hilt, AppDatabase)
- [ ] Módulos 2–6 (la lógica web ya sirve de referencia: entidades, categorías, reglas IA)
