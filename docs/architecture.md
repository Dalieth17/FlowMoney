# Estructura y arquitectura

```text
FlowMoney/
├── apps/
│   ├── api/                  API Express y MySQL
│   │   ├── src/
│   │   │   ├── config/       Configuración y versión legal
│   │   │   ├── db/           Pool, migrador y migraciones SQL
│   │   │   ├── middleware/   Sesión, validación y errores
│   │   │   ├── repositories/ Acceso a datos
│   │   │   ├── routes/       Endpoints HTTP
│   │   │   ├── services/     Reglas de negocio
│   │   │   ├── utils/        Utilidades del servidor
│   │   │   ├── validation/   Esquemas de entrada
│   │   │   ├── app.js        Construcción de Express
│   │   │   └── server.js     Inicio y apagado
│   │   ├── tests/            Unitarias e integración con MySQL
│   │   └── Dockerfile
│   ├── web/                  Sitio y panel web
│   │   ├── nginx/            Proxy y cabeceras de seguridad
│   │   ├── public/           HTML y recursos públicos
│   │   │   └── assets/
│   │   │       ├── css/      Estilos y temas
│   │   │       ├── img/      Imágenes
│   │   │       ├── js/       core, domain, forms, pages, ui y views
│   │   │       └── vendor/   Librerías externas sin modificar
│   │   ├── tests/            Lógica pura y formularios DOM
│   │   └── Dockerfile
│   └── android/              Proyecto Gradle independiente
│       ├── app/              Room, repositorios, DI y Compose
│       ├── domain/           Modelos y casos de uso Kotlin
│       └── gradle/           Wrapper y catálogo de versiones
├── docs/                     Documentación para colaboradores
├── .github/workflows/        Integración continua
├── docker-compose.yml        Arranque de MySQL, API y web
├── package.json              Calidad y pruebas del monorepo
├── README.md                 Punto de entrada del proyecto
└── claude.md                 Contexto y convenciones para agentes
```

Las tres aplicaciones tienen ciclos de ejecución distintos. API conserva su propio
`package.json` y lockfile. Web usa módulos ES sin build y las herramientas de calidad de la
raíz. Android conserva sus dos módulos y su wrapper Gradle dentro de `apps/android`.

API mantiene el flujo `routes → services → repositories → MySQL`. Las migraciones conservan
sus nombres y su ubicación relativa al migrador: no se renumeran ni se reaplican al moverlas.
Web mantiene rutas relativas entre sus módulos. Sus URLs públicas y las rutas `/api` no cambian.

Los Dockerfiles viven junto a las aplicaciones que empaquetan; Nginx se configura en
`apps/web/nginx`. Compose permanece en la raíz para conservar `docker compose up --build`,
la búsqueda de `.env`, el nombre de proyecto `flowmoney` y el volumen de datos `db_data`.

La entrada Git antigua `FlowMoney` era un gitlink sin `.gitmodules`. Se retira del índice
sin borrar su carpeta local y se ignora `/FlowMoney/` para no volver a registrar una copia anidada.
Esto no modifica ni integra cambios que existan en repositorios de otros equipos.
