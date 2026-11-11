# FlowMoney

App de finanzas personales para Android (Kotlin · Jetpack Compose · Room · Clean Architecture),
100% offline. Este repositorio arranca con el **diseño web de escritorio** (landing + preview
del panel), contenerizado en Docker.

## Ejecutar el sitio web

Con Docker:

```bash
docker compose up --build
```

Luego abre http://localhost:8080 — verás la **landing** y, desde "Abrir el panel",
la **app funcional** (`/app.html`).

> La app necesita servirse por HTTP (usa módulos ES). Con Docker ya funciona.
> Para desarrollo sin Docker: `cd frontend && python3 -m http.server 8080`.

## Qué hace (sitio funcional)

La app corre 100% en el navegador y **guarda los datos en `localStorage`** (offline):

- **Resumen** — ingresos/gastos/balance, flujo semanal, gasto por categoría, alertas de presupuesto y movimientos recientes.
- **Movimientos** — alta, edición y borrado, con filtros por tipo y categoría.
- **Categorías** — predeterminadas + creación de propias (ícono y color).
- **Presupuestos** — límite por categoría con aviso automático al 80% y al superarlo.
- **Reportes** — dona por categoría, barras de 6 meses, tasa de ahorro y **Exportar PDF** (imprimir).
- **IA** — al escribir la descripción, sugiere la categoría (clasificador local por palabras clave).

Usa "Restaurar datos de ejemplo" en la barra lateral para volver al estado inicial.

## Estructura

```
frontend/
  index.html              Landing (hero "río de flujo")
  app.html                App funcional (shell del panel)
  assets/css/app.css      Estilos de la app (mismo sistema de diseño)
  assets/js/
    format.js             Moneda, fechas, semanas
    data.js               Store (localStorage) + datos de ejemplo
    ai.js                 Clasificador local por palabras clave
    charts.js             Dona y barras en SVG
    ui.js                 Modal, toast, confirm, pickers
    app.js                Router + 5 vistas + formularios
Dockerfile                Imagen Nginx que sirve /frontend
nginx.conf                Config de Nginx (gzip, cache, headers)
docker-compose.yml        Levanta el sitio en localhost:8080
claude.md                 Contexto del proyecto (arquitectura, tokens, estado)
```

## Ramas

- `DEV` — desarrollo.
- `QA` — revisión de calidad.

## Siguiente paso

Setup del proyecto Android (Gradle, Hilt, Room `AppDatabase`) y luego los módulos:
Categorías → Movimientos → Presupuestos → Reportes → IA.
