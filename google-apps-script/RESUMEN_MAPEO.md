# RESUMEN — conexión a Google Sheets (build 1.17)

**Estado:** código preparado en GitHub, pendiente de copiar/desplegar en Google Apps Script y comprobar la respuesta real. **No se editan las hojas de cálculo.**

## Fuente y contrato

- Libro: `HMS_IW` (ID `1CY7eP3AU7MmHUOx2kySKSrONObgstneBUxaPZMHYabc`).
- Zona horaria: `America/Cancun`.
- Acción del frontend: `summary.get` (POST JSON serializado como `text/plain`).
- Entrada: `{ "action": "summary.get" }`.
- Salida: `{ "ok": true, "data": { "monthly": [...], "performance": [...], "rateDays": [...], "generatedAt": "..." } }`.
- Frontend: `src/services/summaryService.ts` y `src/components/DashboardViews.tsx`.
- Apps Script: `Config.gs`, `Code.gs`, `Utils.gs`, `Summary.gs`.

## Mapeo de columnas (datos desde fila 7; encabezados en fila 6)

| Destino del dashboard | Pestaña | Columnas en hoja | Campo entregado / cálculo |
| --- | --- | --- | --- |
| Periodo mensual | INDICADORES | A (Mes) | monthly[].key, year, month, label |
| Ingresos mensuales | INDICADORES | E (Ingreso de habitaciones) | monthly[].revenue |
| Noches disponibles | INDICADORES | B (Noches-habitación disponibles) | monthly[].availableNights |
| Noches vendidas | INDICADORES | C (Noches-habitación ocupadas) | monthly[].soldNights |
| Reservas activas | INDICADORES | H | monthly[].bookings |
| Reservas canceladas | INDICADORES | I | monthly[].cancellations |
| Ocupación mensual | INDICADORES | B, C | React: soldNights / availableNights × 100 |
| ADR mensual | INDICADORES | C, E | React: revenue / soldNights |
| RevPAR mensual | INDICADORES | B, E | React: revenue / availableNights |
| Fechas de desempeño reciente | OPERACION_DIARIA | A | performance[].date; últimas 14 fechas hasta hoy |
| Ingresos recientes | OPERACION_DIARIA | N (Ingreso estimado de habitaciones) | performance[].ingresos |
| Ocupación reciente | OPERACION_DIARIA | E (Ocupación) | performance[].ocupacion, expresada en porcentaje 0–100 |
| Fechas próximas | OPERACION_DIARIA | A | rateDays[].date; próximos 7 días incluyendo hoy |
| Capacidad diaria | OPERACION_DIARIA | C | available = C − D |
| Habitaciones ocupadas | OPERACION_DIARIA | D | rateDays[].occupied |
| Ocupación próxima | OPERACION_DIARIA | E | rateDays[].occupancy, porcentaje 0–100 |

La hoja INDICADORES contiene fórmulas dependientes de RESERVAS; OPERACION_DIARIA también. Apps Script **lee el resultado** de esas fórmulas, sin duplicar su cálculo. La hoja indica que los ingresos de noches cruzadas entre meses son **estimaciones proporcionales**, no tarifas observadas por noche.

## Fuentes pendientes

- Costos y resultado operativo: se mantienen `costs: 0` con `costsAvailable: false` hasta recibir la tercera hoja de costos. No mostrarlos como gastos cero reales.
- Alertas / oportunidades RMS: `data.alerts` queda vacío hasta conectar RMS; no se generan alertas ficticias.
- La segunda hoja `Inventory` no interviene en Resumen actualmente: se utilizará al trabajar la pestaña Inventario.

## Cómo instalar cuando se decida lanzar

1. Crear o abrir el proyecto de Apps Script relacionado con el hotel.
2. Copiar el contenido de los **cuatro archivos** `Config.gs`, `Code.gs`, `Utils.gs`, `Summary.gs` desde `google-apps-script/` (sin modificar la Sheet).
3. Desplegar la app web y guardar su URL que termina en `/exec`.
4. En GitHub, establecer `VITE_APPS_SCRIPT_URL` como variable de Actions y redesplegar GitHub Pages.
5. Revisar los seis KPIs, la gráfica de los últimos 14 días y el bloque de próximos 7 días. Comprobar que encabezados en fila 6 no hayan cambiado.
6. No exponer datos operativos reales públicamente sin configurar control de acceso del servidor.

**Nota:** las conexiones de `Indicadores` y `Reservas` tienen archivos adicionales en la carpeta; se validarán por separado cuando trabajemos esas pestañas.
