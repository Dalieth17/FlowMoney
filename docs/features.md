# Estado de funcionalidades

La versión web incluye los siguientes flujos completos. La integración MySQL valida las reglas
financieras y el aislamiento por usuario; los tests web validan cálculos, formularios y respuestas
fuera de orden. Esta lista define el alcance actual; no implica que cualquier función futura esté incluida.

| Área         | Funciones disponibles                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso       | Registro con consentimiento, inicio/cierre de sesión, cambio de contraseña, recuperación por correo con caducidad y uso único.                          |
| Perfil       | Nombre, moneda COP/USD con tasa automática o manual, historial de conversión, exportación y eliminación de cuenta.                                      |
| Movimientos  | Altas, edición, borrado, búsqueda, filtros, paginación, CSV e historial de cambios.                                                                     |
| Cuentas      | Tipos de cuenta, saldo inicial, saldos actuales/proyectados calculados en SQL y conteos.                                                                |
| Categorías   | Categorías propias y sugerencia local según la descripción.                                                                                             |
| Presupuestos | Límites por categoría/mes y avisos de consumo.                                                                                                          |
| Operaciones  | Transferencias atómicas, comisión como gasto, edición y eliminación de ambas partes; conciliación con detección de saldo obsoleto.                      |
| Recurrencias | Reglas mensuales, fin de mes, pausa/reanudación y procesamiento manual sin duplicados, incluso tras borrar o restaurar.                                 |
| Metas        | Objetivos de ahorro, aportes/retiros, progreso y archivado; no reservan fondos de las cuentas.                                                          |
| Reportes     | Totales SQL, categorías, seis meses, filtro por cuenta y sin cuenta, gráfico/tabla por cuenta e impresión PDF.                                          |
| Resumen      | Finanzas del mes, gastos diarios reales/programados en 3D con alternativa SVG y tabla, sin barras ficticias.                                            |
| Respaldos    | Descarga JSON, vista previa, confirmación con contraseña y restauración atómica con remapeo de IDs.                                                     |
| Interfaz     | Temas, estados vacíos/errores, confirmaciones, protección contra doble envío, descarte de respuestas antiguas y recarga tras pérdida de sincronización. |

## Configuración para usar los flujos

- `docker compose up --build` aplica las migraciones automáticamente. La migración 010 añade
  enlaces de recuperación sin modificar contraseñas existentes ni datos financieros.
- En localhost el correo se consulta en Mailpit (`http://localhost:8025`); el buzón no entrega
  mensajes reales. En producción hace falta configurar un proveedor SMTP y el origen HTTPS del sitio.
- La cotización automática necesita salida a ExchangeRate-API. La tasa manual está disponible
  si el proveedor falla; no hace falta una clave API.
- Las recurrencias se ejecutan al pulsar **Procesar pendientes**. No hay un programador que
  registre cobros sin confirmación del usuario.
- Los textos legales conservan campos del responsable/alojamiento que debe completar quien
  publique el servicio con sus datos reales.

## Android

Android funciona offline con Room. Tiene categorías, movimientos, presupuestos, reportes/PDF,
asesor local y temas. No inicia sesión contra la web ni sincroniza sus datos. Cuentas,
transferencias/conciliaciones, metas y restauración web no se ofrecen como funciones móviles.
Conectar Android y diseñar su sincronización requiere definir ese alcance antes de implementarlo.

## Límites de esta entrega

Reportes y Cuentas ya no calculan totales leyendo todo el histórico en JavaScript. La carga
inicial de la web sigue trayendo el histórico por páginas para Resumen, filtros y otras vistas;
no se presenta este cambio como paginación remota de toda la aplicación.

## Validación de esta entrega

- `npm run check`: lint, formato, 84 pruebas web/DOM y 34 unitarias de API.
- MySQL 8: 69 pruebas de integración, incluidas entrega SMTP local, caducidad, consumo
  concurrente del enlace, revocación de sesiones y reportes con límites de fecha colombianos.
- Chromium: registro, navegación por las nueve vistas, filtro por cuenta, generación PDF,
  recuperación en la misma pestaña y reingreso con la nueva contraseña; sin errores JavaScript.
  Reportes verificado a 375 y 1440 píxeles sin desbordamiento de página.
- CI ejecuta además compilación de imágenes Docker y build/tests/lint Android.
