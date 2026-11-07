# CAJA — Mapeo completo y conexiones (noviembre 2026)

## Principios
- **Fuente principal:** HMS_IW `1CY7eP3AU7MmHUOx2kySKSrONObgstneBUxaPZMHYabc`. No editar las Google Sheets ni crear columnas.
- **Libro de movimientos:** `MOVIMIENTOS_CAJA!A:U`, encabezados fila 5, datos desde fila 6.
- **Apertura y cierre:** `CIERRES_CAJA!A:T`, encabezados fila 5, datos desde fila 6.
- **Pagos de reservas:** ruta existente `reservations.payment` que escribe `RESERVAS!V,W,Z` y un movimiento en Caja, sin tocar fórmulas `RESERVAS!AA:AI`.
- **Pagos de tours:** `TOURS!A:V`, `PAGOS_TOURS!A:M` y Caja, mediante `tour.payment`. Se leen resultados de fórmulas `TOURS!J:R`, **no se sobrescriben**.
- **Costos contables ≠ movimientos de Caja**. `CIERRES_CAJA` muestra flujos, no utilidad/GOP.

## Campos exactos de MOVIMIENTOS_CAJA

| Columna | Campo | Uso |
| --- | --- | --- |
| A | ID movimiento | Clave de idempotencia y consulta exacta |
| B | Fecha y hora | Timestamp real de captura |
| C | Fecha operativa | Fecha de operación, tipo Date de Sheets |
| D | Movimiento | `Entrada` / `Salida` |
| E | Categoría | Pago reserva/anticipo, restaurante, gastos, tour, etc. |
| F | Departamento | Clasificación de área |
| G | Concepto | Descripción |
| H | Método de pago | Efectivo, tarjeta o transferencia |
| I | Monto | Valor de entrada o salida |
| J | Clave de reserva | Vínculo para reservas; anulación especializada |
| K | ID tour | Vínculo para pagos de Tours |
| L | ID compra | Vínculo para inventario |
| M | Usuario | Por ahora `Sistema HMS`; sustituir por usuario autenticado antes de producción |
| N | Estado | **`Activo`** para contabilizar; `Anulado` al revertir movimientos independientes |
| O | Comprobante | Pendiente de documentos |
| P | Nota | Marca de conciliación en pagos de Reservas |
| Q | Actualizado | Fecha de modificación |
| R | Cancelado por | Al anular |
| S | Fecha de cancelación | Al anular |
| T | Motivo de cancelación | Obligatorio en nuevas anulaciones |
| U | Origen | `Caja Web`, `Reservas Web` o `Tours Web` |

**Importante:** las fórmulas de `CIERRES_CAJA` filtran específicamente `MOVIMIENTOS_CAJA!N = "Activo"`. Los lectores de React muestran `Por revisar` cuando un movimiento tiene estado no reconocido, y **no lo cuentan como activo**. También preservan los métodos de pago desconocidos como `Sin registro`, nunca como efectivo.

## Campos exactos de CIERRES_CAJA

| Columna | Campo | Origen de dato |
| --- | --- | --- |
| A | ID cierre | Nuevo registro `CIERRE-YYYYMMDD` |
| B | Fecha operativa | Se escribe Date |
| C | Saldo inicial | Captura explícita desde Caja |
| D | Entradas efectivo | Fórmula de Sheets; solo lectura |
| E | Salidas efectivo | Fórmula; solo lectura |
| F | Efectivo esperado | Fórmula C+D−E; solo lectura |
| G | Efectivo contado | Conteo capturado en Caja |
| H | Diferencia | Fórmula G−F; solo lectura |
| I–L | Entradas/salidas tarjeta/transferencia | Fórmulas; solo lectura |
| M–O | Entradas, salidas y neto del día | Fórmulas; solo lectura |
| P | Cerrado por | `Sistema HMS` mientras no exista identidad real |
| Q | Fecha y hora del cierre | Escritura al cerrar |
| R | Estado | `Abierto` / `Cerrado` |
| S | Revisado por | Reservado para aprobación futura |
| T | Nota | Justificación del cierre / diferencia |

El cierre exige **fondo inicial y efectivo contado** explícitos. Si existe una diferencia, exige aceptación expresa y nota. Tras cerrar, el servidor impide nuevas entradas/salidas, anulaciones o pagos de reserva/tour sobre la fecha cerrada. No se implementa reapertura administrativa todavía.

## Contratos de API

| Acción | Lectura/escritura | Archivos compartidos |
| --- | --- | --- |
| `cash.get` | Movimientos + cierres | `Cash.gs`, `FinanceReaders.gs` |
| `cash.movement.create` | Entradas/salidas **independientes** | `Cash.gs` |
| `cash.movement.annul` | Anula solo movimientos independientes con motivo | `Cash.gs` |
| `cash.day.save` | Apertura y conteo | `Cash.gs` |
| `cash.day.close` | Cierre diario con control de diferencias | `Cash.gs` |
| `reservations.payment` | Cobros/anticipos de reservas: RESERVAS + Caja | `Reservations.gs`, `Cash.gs` |
| `tour.payment` | Cobro huésped, pago proveedor/recepción/hotel: PAGOS_TOURS + Caja | `TourPayments.gs`, `Cash.gs` |
| `tour.update` | Realizado/cancelado en TOURS!T | `TourPayments.gs` |

La aplicación solicita `cash.get` al entrar en Caja y carga también `reservations.get` para el saldo de clientes. Los datos del calendario y diario operativo siguen usando las rutas existentes; `cashInvalidate_` borra la caché de Caja y Operación para que los movimientos se reflejen al actualizar. React no considera un registro financiero guardado hasta recibir confirmación del servidor.

Los identificadores únicos de movimientos y pagos se reutilizan ante reintentos ambiguos. Apps Script utiliza `LockService` y verifica IDs antes de añadir filas. Las escrituras en dos hojas intentan revertirse ante error, pero **no son transacciones atómicas garantizadas**.

## Qué se obtiene sin columnas nuevas

- Total de entradas y salidas, neto, flujos por método y categoría: se derivan de `MOVIMIENTOS_CAJA` activos.
- Efectivo esperado y diferencia: ya los calcula `CIERRES_CAJA`.
- Saldo por reserva: `RESERVAS!U,V`, únicamente si V se conoce; no inventar cero cuando V está en blanco.
- Cobrado y pendiente por tour: `TOURS!M,N,O`; proveedor: P, recepción: Q, hotel: R.
- Comisiones y reparto de tours: `TOURS!J:L`, ligados a porcentajes existentes `CONFIGURACION!B12:B13`.
- Cierre por día, estado y responsable: `CIERRES_CAJA!A:T`.

## Pendientes reales / conexiones dependientes

1. **Compra de inventario**: ahora preparada vía inventory.purchase. Guarda los artículos en Inventory/Transacciones y la salida correspondiente en MOVIMIENTOS_CAJA con ID compartido. La solicitud/compra ligada a una aprobación sigue pendiente de contar con un registro de solicitudes persistente.
2. **Reembolsos de reservas/tours**: requiere flujo especializado que ajuste saldos y conserve historial de la fuente, no solo anular una entrada.
3. **Crear nuevos tours**: la hoja actual no conserva proveedor, horario de servicio ni cantidad de personas. No inventar esos campos. Los cobros/liquidaciones de tours **ya existentes** están preparados.
4. **Usuario real y permisos**: `Sistema HMS` es marcador; se debe autenticar y autorizar en **Apps Script**, no confiar en el rol de React.
5. **Comprobantes**: columna O de Caja y K de PAGOS_TOURS disponibles, pero aún falta almacenamiento/verificación de archivos.
6. **Reapertura/revisión gerencial de cierres**: fuente R/S existente; definir política de revisión y permisos antes de escribir.
7. **Disponibilidad histórica**: RESERVAS sigue usando ventana operativa de ±30/180 días y hasta 500 registros; los saldos de cobranza visibles no equivalen a toda la cartera histórica.
8. **Contabilización de costos y GOP**: tercera hoja de costos aún pendiente. Caja es flujo de efectivo, no estado de resultados.
9. **Datos reales de tours por proveedor y número de participantes**: se requieren fuentes adicionales; el calendario financiero no inventa esos atributos.

## Archivos ejecutables que dependen de Caja

`Config.gs`, `Code.gs`, `Utils.gs`, `FinanceReaders.gs`, `Cash.gs`, `Reservations.gs`, `TourPayments.gs`. Como el dispatcher contiene más rutas, el proyecto Apps Script completo debe incluir además `Summary.gs`, `Indicators.gs`, `RMS.gs` y `Operation.gs`.

React: `cashService.ts`, `tourPaymentsService.ts`, `reservationsService.ts`, `hotelService.ts`, `App.tsx`, `CashView.tsx`, `ToursView.tsx` y modelos en `types.ts`.

**Estado:** código preparado en GitHub, sin edición de Google Sheets, sin compilación/pruebas ni despliegue. No afirmar que las conexiones están verificadas en producción.

**Actualización de Inventario:** las compras directas por factura de productos activos se prepararon en InventoryPurchases.gs, con detalle de artículos reutilizado por Cash.gs. El código no modifica automáticamente una solicitud de compra porque la segunda hoja no tiene un registro de solicitudes. Ver INVENTARIO_MAPEO.md.
