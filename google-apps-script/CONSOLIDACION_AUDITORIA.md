# CONSOLIDACIÓN DEL CÓDIGO — Noviembre 2026

**Objetivo:** revisar la arquitectura tras preparar Resumen, Indicadores, RMS/Tarifas, Reservas y Operación diaria. Este registro describe cambios en GitHub, **sin editar Google Sheets ni desplegar/probar Apps Script**.

## Mejoras aplicadas

| Problema detectado | Corrección realizada | Archivos |
| --- | --- | --- |
| RMS con 180 días × 5 categorías podía exceder el máximo de un elemento de caché de Apps Script | Serializar y cachear solo si el resultado mide menos de 90.000 caracteres; de otro modo retornar sin cachear | `RMS.gs` |
| Reservas podía intentar cachear hasta 500 registros, potencialmente sobrepasando el límite | Misma protección de tamaño en el caché de reservas | `Reservations.gs` |
| Al modificar reservas, el caché de Operación diaria podía seguir mostrando datos anteriores | Se invalida también `OPERATION_CACHE_KEY` tras escrituras de reserva y pagos | `Reservations.gs` |
| Resumen dependía del huso horario del navegador y podía escoger períodos futuros | Elegir último mes no posterior al actual según `America/Cancun` | `DashboardViews.tsx` |
| Primer mes disponible mostraba comparación artificial | KPI permite `previous:null` y muestra «Sin comparativo» | `DashboardViews.tsx`, `types.ts` |
| Ingresos diarios estimados se mostraban como «REAL» | Etiqueta «ESTIMADO» | `DashboardViews.tsx` |
| Resumen mostraba un denominador fijo de 17 habitaciones en calendario | Se usa `occupied + available` de cada día | `DashboardViews.tsx` |
| `Indicators.gs` asignaba ADR histórico a `currentRate` | Se devuelve `historicalAdr` y se alinea `RoomPerformance`; no confundir ADR histórico con tarifa actual | `Indicators.gs`, `types.ts` |
| `FinanceReaders.gs` convertía método desconocido en «Efectivo» y categorías no reconocidas en categorías económicas reales | Preservar como «Sin registro» / «Sin clasificar»; normalizar área solo si reconocida | `FinanceReaders.gs`, `types.ts` |
| Saldo de tour vacío se interpretaba como liquidado | Usar estado «Sin registro» si no hay saldo conocido | `FinanceReaders.gs`, `types.ts` |
| Un check de limpieza del día anterior podía marcar limpia una habitación que ahora necesita limpieza | El estado operativo derivado de eventos solo se actualiza con eventos del día actual; se conserva historial | `Operation.gs` |
| El frontend podía confirmar una escritura de limpieza aunque hubiese fallado su consulta posterior | Separar éxito de escritura y fallo al refrescar. Si la escritura falla, intentar recuperar estado del servidor y, si tampoco se puede, restaurar snapshot local | `App.tsx` |
| Reintentos de pago podían devolver éxito con libro de caja no conciliado | Guardar monto anterior/posterior en nota; si existe el mismo ID, comprobar reserva, importe, método y monto final antes de considerarlo repetición válida | `Reservations.gs` |
| Error parcial al registrar pago podía dejar importes inconsistentes | Intento de restauración de V/W y limpieza del movimiento; registrar explícitamente errores de rollback para conciliación | `Reservations.gs` |
| Instrucciones manuales incompletas | Enumerar nueve archivos .gs e indicar qué rutas y fuentes faltan | `google-apps-script/README.md` |

## Riesgos pendientes — no presentar como solucionados

1. **CRÍTICO — autenticación/autorización:** login en React aún es una demo. `Code.gs` no autentica el solicitante ni controla permisos servidor. No exponer el endpoint público con datos reales o escrituras hasta corregirlo.
2. **ALTO — no atomicidad:** Sheets/Apps Script no proveen transacciones entre hojas. Los intentos de rollback reducen riesgos pero no garantizan consistencia ante cortes, errores de plataforma o reintentos. Requiere conciliación y monitoreo antes del uso operativo de pagos.
3. **ALTO — estado optimista:** varias funciones de `OperationsView` todavía modifican estado local antes de confirmar operaciones. `App.tsx` intenta restaurar, pero falta convertir cada acción a un flujo de confirmación única servidor → estado. No asumir que todas las acciones están completamente persistidas.
4. **ALTO — lectura y cobertura:** `Reservations.gs` transforma hasta ~10.000 filas y devuelve una ventana con máximo de 500. Revisar paginación y filtros por rango si el histórico crece.
5. **MEDIO — normalización de habitaciones:** el parseo de AC/AD y M/AE necesita revisar múltiples formatos reales de reservas multihabitación. El conteo RMS puede excluir reservas ambiguas.
6. **MEDIO — finanzas:** cierres, costos operativos y gastos por categoría no deben confundirse con movimientos de caja. La tercera hoja de costos sigue pendiente.
7. **MEDIO — fecha operativa:** revisar extremos de medianoche, horario de hotel y serialización de fechas con `America/Cancun`.
8. **MEDIO — tareas:** la hoja `REGISTRO_LIMPIEZA` guarda acciones, no un esquema completo de tareas con IDs, prioridades, vencimientos y estados individuales.
9. **PENDIENTE — Caja/Tours:** los lectores están preparados, pero cobros/liquidaciones de Tours necesitan rutas de escritura transaccionalmente coordinadas.
10. **PENDIENTE — validación:** no se ha ejecutado compilación TypeScript, test unitario, integración ni despliegue. Las correcciones descritas son una revisión estática y deberán verificarse cuando el propietario decida probar.

## Próximo bloque de implementación recomendado

1. Revisar y robustecer `Code.gs` con permisos de servidor antes de cualquier uso real de escritura.
2. Refactorizar `OperationsView`: convertir `onOperationEvent` en confirmación previa a mutación del estado; posteriormente integrar tareas estructuradas.
3. Alinear escritura de pagos y caja mediante un ledger único e identificadores de operación.
4. Continuar con **Caja**, reutilizando `FinanceReaders.gs`, `reservations.payment` y las tablas `MOVIMIENTOS_CAJA` / `CIERRES_CAJA` / `TOURS` / `PAGOS_TOURS`.
5. Posteriormente Inventario, Personal y Configuración.

**Se mantiene la regla:** reutilizar datos existentes y registrar lo verdaderamente faltante; no inventar columnas ni alterar las hojas.

## Segunda fase: Reservas + Operación diaria (6 nov 2026)

**Cambios:** acciones de Habitaciones y Limpieza esperan `operation.event` y su lectura posterior, sin confirmar cambios optimistas; solicitudes de limpieza desde Reservas llaman a la misma ruta; confirmar salida primero guarda Q de RESERVAS y luego solicita limpieza, con estado parcial explícito; los reintentos de pago conservan `paymentId`; en Operation.gs se impiden aprobaciones con incidencia activa y se intenta restaurar escrituras parciales; «Iniciar operación» y cambios de acceso sin persistencia quedan deshabilitados.

**Pendiente:** registro estructurado de tareas y múltiples incidencias, asociación de solicitud de limpieza con reserva, escritura formal de apertura de jornada y permisos por rol de servidor. Es necesario validar manualmente todas las rutas cuando se copie Apps Script, no se han ejecutado pruebas.

## Conexiones de Caja y Tours (6 nov 2026)

`Cash.gs` y `TourPayments.gs` se agregaron al puente de Apps Script. Caja dispone de `cash.get`, `cash.movement.create`, `cash.movement.annul`, `cash.day.save` y `cash.day.close`; Tours existentes disponen de `tour.payment` y `tour.update`; los pagos/anticipos de huéspedes reutilizan `reservations.payment`. Se preservan fórmulas de cierres y tours. Los registros desconocidos no se convierten en dinero disponible ni en efectivo.

**Pendiente:** el flujo de compra de inventario y los reembolsos necesitan integraciones con sus fuentes antes de habilitarse. Autenticación, autorización, transacciones multihoja y pruebas siguen pendientes para despliegue real. Ver `CAJA_MAPEO.md`.
