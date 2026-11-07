# RESERVAS — Mapeo de datos, acciones y límites

**Fuente principal:** HMS_IW, hoja `RESERVAS`. Encabezados en fila 1, registros desde fila 2, columnas **A:AI**. Google Sheets es la fuente de verdad; las columnas AA:AI contienen **ARRAYFORMULA y nunca deben recibir escrituras desde Apps Script**.

## Lo que pide ReservationsView

| Dato de pantalla / acción | Hoja | Columnas | Tratamiento |
| --- | --- | --- | --- |
| Clave de registro | RESERVAS | A | `subReservationId`, clave estable de actualización |
| Folio visible | RESERVAS | C | `id` (si falta, A) |
| Nombre de huésped | RESERVAS | E | `guestName` |
| Creación | RESERVAS | F | `createdAt` |
| Check-in / check-out | RESERVAS | G, H | `checkIn`, `checkOut` |
| Duración | RESERVAS | G, H o I | Diferencia de fechas (no contar noche de salida) |
| Cantidad de habitaciones | RESERVAS | J y AH | Identifica reservas multihabitación |
| Categorías | RESERVAS | L, AC, AD | Código normalizado `roomType` |
| Habitación asignada | RESERVAS | M (origen); AE, AF (fórmulas) | `roomNumber`; actualizar **solo M** |
| Adultos y menores | RESERVAS | N, O | `adults`, `children` |
| Canal | RESERVAS | P (origen), AB (fórmula) | `channel` |
| Estado | RESERVAS | Q (origen), AA (fórmula) | `status`; actualizar **solo Q** |
| Importe total | RESERVAS | U | `total` |
| Monto pagado | RESERVAS | V | `paid`; blanco implica **desconocido**, no cero |
| Saldo | RESERVAS | U, V; W | `max(0, total - pagado)` solo si V es conocido |
| Estado de pago | Cálculo en React | U, V | Pagada, Parcial, Pendiente o **Sin registro** |
| Marca de actualización | RESERVAS | Z | Escribir al cambiar estado, habitación o pago |
| Incidencias de revisión | RESERVAS | AI (fórmula) | Información auxiliar; no se escribe |
| Capacidad / catálogo de habitaciones | CONFIGURACION | A:E desde fila 19 | Validación de asignación, categoría y activa |
| Registro del pago | MOVIMIENTOS_CAJA | A:U, encabezados fila 5, datos desde 6 | Se guarda importe, método, reserva, origen, fecha e ID |
| Limpieza solicitada | Sin estado de solicitud persistido en esta conexión | No usar ESTADO_HABITACIONES como si fuera una solicitud equivalente | Acción **local** por ahora |
| Teléfono / correo huésped | No existen como columnas de RESERVAS | Campos vacíos; no inventar |
| Enlace a Cloudbeds | No existe URL directa confiable para todos los orígenes | No disponible |

## Contratos API — se reutilizan los servicios existentes

1. `reservations.get`: devuelve reservas con fechas dentro de la ventana operativa del backend (30 días atrás y 180 adelante, máximo 500). Interfaz dispone de calendario de 7, 14 y 21 días, lista y filtros de fecha, estado, tipo, búsqueda y pago. **Los filtros actúan sobre el subconjunto cargado**; la búsqueda histórica fuera de esa ventana necesita una ampliación futura del endpoint.
2. `reservations.update`: `{action:"reservations.update",reservationKey,changes:{status:"Hospedado"}}` o `changes:{roomNumber:"NA-1"}`. Escribe **Q** o **M** y luego **Z**. Solo dos campos permitidos. Valida categoría, habitación activa y no solapamiento de fechas. No escribe AA:AI. Desasignar M se permite con `roomNumber:null`.
3. `reservations.payment`: `{action:"reservations.payment",reservationKey,amount:250,method:"Tarjeta",paymentId:"..."}`. Requiere V previamente conocido, importe positivo no superior al saldo y método explícito. Escribe en `MOVIMIENTOS_CAJA` fila 6+ y actualiza V/W/Z en RESERVAS; si falla el ajuste del total intenta limpiar el movimiento agregado. Identificador único permite reconocer reintentos con el mismo ID.
4. La función `invalidateReservationDependents_` invalida las cachés de **Reservas, Resumen, Indicadores y RMS** tras cambios. Esto es necesario porque ambas hojas analíticas contienen fórmulas dependientes de las reservas.

## Qué no añadimos o inferimos

- El contacto (correo/teléfono) no está en RESERVAS; necesita una fuente adicional si se quiere mostrar.
- No se infiere V=0 a partir de celda en blanco. Resumen de saldos excluye los desconocidos.
- No se crean columnas para duración de estancia, saldo, estado de pago, llegadas/salidas o contadores; son derivables.
- No hay botones de **crear o eliminar reservas** en la pantalla actual; no se inventan endpoints de eliminación. Al ampliar la UI, crear reservas requerirá definir las columnas fuente obligatorias y reglas de importación para que no se rompan fórmulas existentes.
- La acción de solicitar limpieza sigue siendo local; su futura persistencia debería reutilizar un evento/tarea de `Operación diaria`, no una columna arbitraria.
- Integración Cloudbeds todavía no conectada; no se simula una sincronización exitosa.
- Una reserva multi-habitación no se puede asignar como si fuese una sola habitación; se requiere desglose por habitación.
- `RESERVAS` utiliza fuentes históricas combinadas. No se debe sobrescribir datos de PMS para sincronizar con proveedores externos sin una estrategia de reconciliación.

## Código en GitHub

- `google-apps-script/Reservations.gs`: lectura, mapeo y edición segura, validación de habitación, registro de pagos.
- `google-apps-script/Code.gs`: rutas `reservations.get`, `reservations.update`, `reservations.payment`.
- `src/services/reservationsService.ts`, `src/services/hotelService.ts`, `src/App.tsx`, `src/components/ReservationsView.tsx`, `src/types.ts`: integración frontend y modelos.
- Dependencias compartidas: `Config.gs` y `Utils.gs`.

**Estado:** código preparado y guardado; no se ha desplegado, ejecutado ni probado Apps Script; no se ha modificado ninguna Google Sheet.
