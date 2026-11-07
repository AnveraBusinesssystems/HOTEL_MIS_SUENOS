# OPERACIÓN DIARIA — fuentes, columnas, conexiones y pendientes

**Fuente:** HMS_IW (`1CY7eP3AU7MmHUOx2kySKSrONObgstneBUxaPZMHYabc`). No alterar las Google Sheets. Código preparado en GitHub; no desplegado ni probado.

## Pantalla: Hoy / Habitaciones / Limpieza / Tours / Cierre diario

| Necesidad del frontend | Pestaña | Columnas / filas | Conexión |
| --- | --- | --- | --- |
| Fechas, ocupación, llegadas y salidas, desayunos, ingresos/ADR/RevPAR estimados | OPERACION_DIARIA | A:R, encabezados fila 6, datos fila 7+ | `Summary.gs` ya lee A, C, D, E, N. Operación puede ampliar del mismo origen cuando lo requiera |
| Reservas y huéspedes del día | RESERVAS | A, C, E, G, H, J, M, N, O, Q, AA, AD, AE, AF | **Reutiliza** `reservations.get` y `reservations.update` |
| Catálogo de 17 habitaciones activas | CONFIGURACION | A:E, encabezados fila 18, datos 19+ | `Operation.gs` relaciona número y código |
| Tablero físico de habitaciones | ESTADO_HABITACIONES | A:M, encabezados fila 5, datos 6+ | `operation.get` devuelve `roomStates` |
| Ocupación, salida, entrada, trabajo requerido y estado base | ESTADO_HABITACIONES | B:F, **fórmulas de Sheets** | Solo lectura. **Nunca escribir B:F** |
| Responsable, horas, incidencias | ESTADO_HABITACIONES | G:M, editables | `operation.event` actualiza únicamente campos relacionados |
| Actividad de limpieza | REGISTRO_LIMPIEZA | A:F, encabezados fila 5, datos 6+ | `operation.event` agrega acciones; `operation.get` puede reconstruir tareas |
| Tours | TOURS A:V | Encabezados fila 5, registros 6+ | Lectura implementada en \`FinanceReaders.gs\`; cobros/edición pendientes |
| Entradas y salidas monetarias | MOVIMIENTOS_CAJA | A:U, encabezados fila 5 | Lectura implementada en \`FinanceReaders.gs\`; escritura general de Caja pendiente |
| Asistencia y horarios | PERSONAL / TURNOS_PERSONAL | A:M / A:O | Configuración y turnos existen, pero fichajes reales no se deducen automáticamente |
| Cierres de caja | CIERRES_CAJA | A:T | Existe fuente de cierre financiero, **no** equivalente a reporte operativo diario enviado |

## Rutas preparadas

- `operation.get`: lectura del estado de habitaciones, historial y tareas de limpieza derivadas de eventos. Se carga al abrir Operación diaria y se guarda en caché durante 60 segundos.
- `operation.event`: registra acción de limpieza, aprobación o incidencia en `REGISTRO_LIMPIEZA` y actualiza G:M de `ESTADO_HABITACIONES`. Cada solicitud tiene `eventId` para identificar repeticiones.
- Confirmación de salida: reutiliza `reservations.update` (Q de RESERVAS) antes de registrar la solicitud de limpieza.
- `reservations.get`: cargado al entrar en Operación diaria si no estaba ya en memoria. No crea una nueva conexión para huéspedes.

### Límite importante

La reconstrucción de tareas a partir del historial A:F es **aproximada** porque el log no incluye un ID de tarea estructurado, prioridad, fecha límite, transiciones tipadas, incidencias resueltas individuales ni un identificador de evento en columna separada. El ID de idempotencia se guarda dentro de la nota. Para preservar con exactitud todo el flujo avanzado de Limpieza será necesario un contrato más rico o un modelo de tareas en otra fuente; **no inventamos columnas sin aprobarlas**.

## Derivable sin columnas nuevas

- Llegadas, salidas, ocupación, próximos huéspedes: de RESERVAS y datos ya calculados en OPERACION_DIARIA.
- Capacidad física por categoría: contando CONFIGURACION A:E.
- Limpiezas de salida necesarias: de salida de reservas + estado del tablero.
- Estimación de ingresos por noche: OPERACION_DIARIA N, indicada explícitamente como **estimación proporcional**.
- Resumen de caja: se obtendrá de MOVIMIENTOS_CAJA, no requiere una columna de total.
- Ocupación de próximas fechas: derivable de RESERVAS + catálogo, sin forecast estadístico.

## Pendiente de conexión/estructura real

1. **Tareas persistentes con ID**, prioridad, asignado, estado y vencimiento: el `REGISTRO_LIMPIEZA` actual permite historial simple, no todo el modelo `OperationTask`.
2. **Bloqueos, acceso / No molestar, incidencias detalladas y resolución individual**: no hay campos estructurados para mantenerlos con fidelidad. La UI aún tiene algunos cambios locales.
3. **Inicio y cierre formal de jornada**: el estado `operationDays` se deriva de fechas, pero marcar «Abierto» todavía es local; no se simula Cloudbeds.
4. **Tours y pagos asociados**: lectura básica de TOURS ya conectada; escribir, cobrar, liquidar y registrar pagos en PAGOS_TOURS/Caja pendiente. Las operaciones que aparentaban guardarse solo localmente se han bloqueado hasta conectar escritura.
5. **Cierre diario por correo, observaciones, versión e historial de envíos**: no existe `REPORTES_DIARIOS`; no confundir con `CIERRES_CAJA`.
6. **Asistencia real y fichajes**: PERSONAL + TURNOS_PERSONAL no equivalen a entradas/salidas reales de empleados.
7. **Cancelaciones realizadas hoy**: necesitan historial de eventos; una reserva cancelada ahora no revela cuándo ocurrió la cancelación.
8. **Datos incompletos de TOURS**: no se encontraron columnas estructuradas de **hora programada, proveedor ni número de participantes**. La interfaz indica que no hay registro en lugar de inventar valores.
9. **Información de limpieza en Reservas**: `cleaningRequested` se maneja aún localmente; futura conexión al mismo log de eventos.

La lectura inicial de habitaciones, datos diarios, tours y caja está preparada; no afirmar que todas las interacciones de cada subvista están persistidas. No se han probado ni desplegado las conexiones.

## Archivos afectados

- `google-apps-script/Operation.gs` (nuevo)
- `google-apps-script/Code.gs`, `Config.gs`
- `src/services/operationService.ts` (nuevo), `hotelService.ts`
- `src/App.tsx`, `src/components/OperationsView.tsx`
- `src/types.ts`, `src/data/emptyData.ts`

**Próxima sección:** Caja. También debe coordinarse la conexión de Tours y Cierre diario para no duplicar escrituras en MOVIMIENTOS_CAJA.
