# Revisión de lógica — 19 de noviembre de 2026

Revisión del código propio de API, web y Android: autenticación, sesiones, validación,
repositorios, transacciones, saldos, transferencias, recurrencias, respaldos, metas,
cálculos financieros y estados de presentación. Las librerías de terceros no se modifican.

## Correcciones

| Área                | Problema                                                                                                                                                             | Corrección y comprobación                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credenciales        | Un login podía completar la verificación con una contraseña revocada; migrar bcrypt podía sobrescribir una contraseña cambiada durante la comprobación.              | Revalidación bajo bloqueo de usuario. Una migración concurrente del mismo secreto sigue permitiendo ambos logins. Pruebas con bcrypt y scrypt.                                  |
| Sesiones            | Registro y renovación de sesión se confirmaban por separado. Un fallo podía dejar una cuenta creada sin sesión o un cambio de contraseña incompleto para el cliente. | Creación de sesión en la transacción; cookie después del commit. Pruebas de rollback y registros simultáneos. La limpieza de sesiones vencidas permanece en la tarea periódica. |
| Saldos              | La API cerraba el día a medianoche UTC, excluyendo las últimas cinco horas del día colombiano.                                                                       | Cierre a las 23:59:59.999 de Colombia. Prueba con el último milisegundo del día, el siguiente y una conciliación.                                                               |
| Rendimiento         | Cada cuenta volvía a recorrer todos los movimientos para calcular saldos.                                                                                            | Agregación por cuenta en una sola pasada, tanto en API como en web: O(cuentas + movimientos). Se conservan saldos actuales, proyectados y conteos.                              |
| Formularios web     | Al cerrar un formulario y abrir otro mientras se guardaba, la respuesta del primero podía cerrar el nuevo y perder su borrador.                                      | Cada formulario cierra únicamente su propio modal. Regresiones para movimientos, cuentas y categorías.                                                                          |
| Metas web           | Guardar una meta y navegar a otra sección podía hacer que la respuesta tardía sustituyera esa sección por la carga de metas.                                         | La recarga comprueba que la sección siga activa. Prueba con guardado pendiente y navegación.                                                                                    |
| Movimientos Android | El filtro nuevo podía combinarse temporalmente con movimientos del filtro anterior.                                                                                  | Filtro y resultados viajan juntos en el flujo. Prueba con una consulta lenta entre dos meses.                                                                                   |
| Asesor Android      | Importes con el sufijo «millones» podían desbordar un entero y convertirse en otro precio positivo.                                                                  | Comprobación del límite antes de multiplicar. Pruebas con valores al borde del límite y superiores.                                                                             |

## Verificación

La caché web también detecta respuestas de una revisión anterior y recarga el estado confirmado
por el servidor. Reinicio y conversión se coordinan para impedir mezclar IDs o importes anteriores.
Hay regresiones para ediciones fuera de orden, reinicio y cambio de moneda. Si una escritura
terminó pero falla la recarga, se ofrece volver a cargar los datos sin repetir esa escritura.

- `npm run check`: lint, formato y pruebas de web/API.
- Resultado local: 76 pruebas web, 32 unitarias de API y 63 de integración MySQL, todas correctas.
- `DB_HOST=127.0.0.1 DB_PORT=3308 npm run test:integration`: MySQL de pruebas separado.
- GitHub Actions ejecuta los tests de dominio y aplicación Android, lint, compilación del APK
  y construcción de imágenes Docker. El entorno local no dispone de Android SDK.
- Las regresiones de MySQL existentes cubren también aislamiento entre usuarios, cambio de moneda,
  transferencias, recurrencias sin duplicados y exportación/restauración de respaldos.

Este informe corresponde a la revisión anterior al cierre de funcionalidades. La entrega posterior
traslada reportes/saldos a SQL y añade recuperación por correo; consulta el [estado actual](features.md).
Android continúa offline: conversión de divisas, operaciones y respaldos web no son funciones
equivalentes de Android.
