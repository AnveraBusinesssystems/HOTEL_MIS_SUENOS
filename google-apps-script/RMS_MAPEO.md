# RMS / TARIFAS — Mapeo y contrato de conexiones

## Arquitectura

- Fuente: **HMS_IW**, ID `1CY7eP3AU7MmHUOx2kySKSrONObgstneBUxaPZMHYabc`.
- API existente: `Code.gs` recibe `{ "action": "rms.get", "refresh": false }` y llama a `RMS.gs`.
- Frontend: `src/services/rmsService.ts` → `hotelService.getRms` → carga perezosa en `App.tsx` → `RatesView.tsx`.
- Respuesta: `{ ok: true, data: { calendar: RMSCalendarEntry[], reservationsWithoutCategory: number, generatedAt: string } }`.
- Periodos de 14, 30, 90, 180 días se seleccionan **en React** desde los mismos 180 días; no se hacen cuatro consultas.
- Caché del RMS: 180 segundos, independiente de Resumen, Indicadores y Reservas. Actualización manual usa `refresh:true`.

## Requerimientos reales de la pantalla

| Campo en calendario | Origen | Columna / cálculo | Estado |
| --- | --- | --- | --- |
| Fecha | Calendario creado en Apps Script (180 días desde hoy) | `todayKey_()`, America/Cancun | Preparado |
| Categoría / nombre | CONFIGURACION | B19:B (código), C19:C (tipo) | Preparado |
| Capacidad activa por categoría | CONFIGURACION | A19:A (habitación), B19:B (categoría), E19:E (Activa) | Preparado |
| Entrada / salida | RESERVAS | G (Entrada), H (Salida) | Preparado |
| Unidades de habitación reservadas | RESERVAS | J (Habitaciones reservadas) | Preparado |
| Estado para excluir cancelaciones y no-shows | RESERVAS | Q (Estado) | Preparado |
| Distribución entre categorías por reserva | RESERVAS | AC (Tipos normalizados), AD (Códigos de categoría) | Preparado con salvaguardas |
| Ocupación categoría-fecha | RESERVAS + CONFIGURACION | Suma de unidades de reserva activa para `checkIn <= fecha < checkOut` / capacidad activa | Preparado |
| Disponibilidad categoría-fecha | RESERVAS + CONFIGURACION | `max(0, capacidad − ocupadas)` | Preparado |
| Tarifa actual por categoría-fecha | No existe un calendario de tarifas vigentes en las hojas verificadas | **null** hasta integrar PMS/Cloudbeds o fuente de tarifas reales | Pendiente |
| Tarifa recomendada | Futuro algoritmo RMS | **null** hasta existir salida del modelo | Pendiente |
| Diferencia de precios | Tarifa recomendada − tarifa actual | No calculable hasta tener ambas | Pendiente |
| Pickup últimos 7 días | Se requieren snapshots históricos de reservas por fecha de observación | No se infiere de una foto actual de RESERVAS | Pendiente |
| Clasificación demanda y justificación | Motor RMS / pronósticos | No se fabrican | Pendiente |
| Publicar Cloudbeds | Conector externo no implementado | UI no realiza publicación real | Pendiente |

## Encabezados y posiciones exactas

- `RESERVAS`: encabezados **fila 1**, datos desde **fila 2**; G, H, J, Q, AC, AD.
- `CONFIGURACION`: encabezados del catálogo **fila 18**, registros desde **fila 19**; A:E.
- `INDICADORES_HABITACIONES`: **no** sirve para disponibilidad exacta por día, sino para KPIs **mensuales**; ya lo maneja `Indicators.gs`.
- `OPERACION_DIARIA`: ofrece ocupación **general** para una ventana corta y se reutiliza en `Summary.gs`; no alcanza para 180 días ni categorías individuales.
- `Inventory`: no es fuente tarifaria.
- Tercera hoja de costos: futura entrada para el algoritmo de optimización (restricciones de beneficio neto y umbrales), no se supone ningún esquema.

## Política de datos dudosos

1. Si una reserva incluye múltiples categorías, `AC` debe indicar cantidades (ej. `1 × CHA | 2 × NA`) que sumen las unidades de J. De no ser así, se registra en `reservationsWithoutCategory`; **no** se distribuye inventario arbitrariamente.
2. Solo las reservas no canceladas/no-show con fechas reales intervienen en ocupación. Se compara por **noches**: check-in incluido, check-out excluido.
3. Si una categoría supera su capacidad, `overbooked: true`. El campo `available` se mantiene no negativo y la ocupación puede superar 100%.
4. El calendario representa **ocupación reservada**, no ocupación futura probabilística ni forecast de demanda.
5. Cualquier tarifa de venta actual o recomendada, pickup y pronóstico permanece `null` hasta recibir su fuente verificable. Nunca usar el ADR histórico como si fuera tarifa vigente.
6. `CONFIGURACION` determina capacidad real por categoría, sin codificar 1/3/6/2/5 dentro del servicio.

## Archivos que se copiarán cuando el propietario decida integrarlos

1. Compartidos: `Config.gs`, `Utils.gs`, `Code.gs`.
2. Dependencia de Resumen (si se integran todas las rutas): `Summary.gs`.
3. RMS: `RMS.gs`.
4. Otros módulos con rutas declaradas en `Code.gs`: `Indicators.gs`, `Reservations.gs`.

El frontend ya tiene configurada la ruta de petición `rms.get`. **No se ha ejecutado ni desplegado Apps Script, no se han probado cifras ni modificado ninguna Sheet.**

## Próximas entradas del algoritmo

- Tarifa **publicada** real por categoría y día (fuente PMS/channel manager o tabla existente a identificar).
- Historial de capturas por día para pickup y evolución de reservas.
- Costos diarios fijos/variables, comisiones OTA, margen por categoría.
- Tabla de resultados del motor (fecha, categoría, tarifa recomendada, límites, razón, versión del modelo).
- Solo después: ajustes locales con persistencia y publicación a Cloudbeds.

Estas entradas deberán conectarse sin reemplazar `rms.get`: se pueden combinar datos de ocupación y resultados del motor manteniendo un único contrato para `RatesView`.
