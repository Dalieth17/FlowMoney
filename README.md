# FlowMoney

App de finanzas personales para Android (Kotlin · Jetpack Compose · Room · Clean Architecture),
100% offline. Este repositorio arranca con el **diseño web de escritorio** (landing + preview
del panel), contenerizado en Docker.

## Ver el diseño web

Con Docker:

```bash
docker compose up --build
```

Luego abre http://localhost:8080

Sin Docker, basta con abrir `frontend/index.html` en el navegador.

## Estructura

```
frontend/index.html     Diseño web (self-contained)
Dockerfile              Imagen Nginx que sirve /frontend
nginx.conf              Config de Nginx (gzip, cache, headers)
docker-compose.yml      Levanta el sitio en localhost:8080
claude.md               Contexto del proyecto (arquitectura, tokens, estado)
```

## Ramas

- `DEV` — desarrollo.
- `QA` — revisión de calidad.

## Siguiente paso

Setup del proyecto Android (Gradle, Hilt, Room `AppDatabase`) y luego los módulos:
Categorías → Movimientos → Presupuestos → Reportes → IA.
