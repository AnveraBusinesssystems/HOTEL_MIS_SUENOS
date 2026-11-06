# INDICADORES — Conexiones y contrato de datos

## Origen

Libro principal: **HMS_IW** `1CY7eP3AU7MmHUOx2kySKSrONObgstneBUxaPZMHYabc`.

Esta pestaña del dashboard contiene tres subvistas: **Rendimiento**, **Habitaciones** y **Costos**.

**Principio de reutilización:** `Resumen` ya carga `monthly` desde `INDICADORES` mediante `summary.get`. Al abrir Indicadores, el frontend pide `indicators.get` solamente para `roomPerformance` y `roomMonthly`. No vuelve a solicitar `monthly` salvo en una actualización manual con `includeMonthly: true`, que lee `INDICADORES` en esa misma petición. No se crea una conexión nueva para KPIs mensuales.

## Tabla de fuentes

Encabezados en **fila 6**; registros desde **fila 7**.

| Campo requerido por el frontend | Pestaña | Columna(s) | Uso |
| --- | --- | --- | --- |
| `monthly[].key / year / month` | INDICADORES | A (Mes) | Filtros año y mes, comparativos |
| `monthly[].availableNights` | INDICADORES | B | Ocupación y RevPAR |
| `monthly[].soldNights` | INDICADORES | C | Ocupación y ADR |
| `monthly[].revenue` | INDICADORES | E | Ingresos y comparativos |
| `monthly[].bookings` | INDICADORES | H | Campo compartido del resumen |
| `monthly[].cancellations` | INDICADORES | I | Campo compartido del resumen |
| `roomMonthly[].year` | INDICADORES_HABITACIONES | B | Seleccionar año |
| `roomMonthly[].month` | INDICADORES_HABITACIONES | C | Seleccionar mes |
| `roomMonthly[].code` | INDICADORES_HABITACIONES | D | Categoría de habitación |
| `roomPerformance[].name` | INDICADORES_HABITACIONES | E | Nombre visible |
| `roomPerformance[].rooms` | INDICADORES_HABITACIONES | F | Número de habitaciones activas |
| `roomMonthly[].availableNights` | INDICADORES_HABITACIONES | G | Ocupación / RevPAR por categoría |
| `roomMonthly[].soldNights` | INDICADORES_HABITACIONES | H | Ocupación / ADR por categoría |
| `roomMonthly[].revenue` | INDICADORES_HABITACIONES | J | Ingresos / participación por categoría |

La hoja también contiene D (ocupación), F (ADR), G (RevPAR) de `INDICADORES`, y columnas I, K, L calculadas de `INDICADORES_HABITACIONES`. El frontend **calcula esos cocientes con B/C/E y G/H/J** para reutilizar una sola lógica y evitar discrepancias por redondeo. No necesita leer esas columnas derivadas.

## Indicadores mostrados

### Rendimiento
- KPIs: ingresos, ocupación, ADR, RevPAR, costos, resultado operativo.
- Comparación intermensual e interanual: buscar fila equivalente de `monthly`, sin inventar valores cuando no existe.
- Gráficas: evolución de ocupación vs ADR, RevPAR del año seleccionado vs año anterior y resultado financiero (este último cuando se conecten costos).
- El año y mes son filtros del lado React: **no requieren peticiones adicionales**.

### Habitaciones
- Filtros: categoría `NAY`, `NA`, `CHA`, `KAA`, `MUU` y todas.
- Ingreso por categoría, ADR, noches vendidas: columnas G/H/J.
- Distribución de ingresos: suma de columna J por código.
- Matriz por meses: recorrer `roomMonthly` para el año seleccionado.
- Tabla de rendimiento: ocupación (H/G), ADR (J/H), RevPAR (J/G), aporte al ingreso (J / suma de J).
- Los datos de habitación se cachean en Apps Script durante 300 segundos y se cargan **solo al entrar** en Indicadores.

### Costos — pendiente de fuente
- Datos requeridos: costos totales mensuales y gastos por categoría, con campos `year`, `month`, `category`, `amount`.
- Cuando recibamos la tercera hoja, habrá que alimentar `DashboardData.expenses` y `monthly[].costs/costsAvailable`; todavía no existe un mapeo de columnas verificado.
- Hasta entonces el panel Costos queda como **sin datos**, no como gastos cero.

## Contrato Apps Script

Archivos a copiar cuando se instale el sistema: `Config.gs`, `Utils.gs`, `Summary.gs`, `Indicators.gs`, `Code.gs`.

El frontend llama a:
```json
{ "action": "indicators.get", "includeMonthly": false }
```
Respuesta:
```json
{
  "ok": true,
  "data": {
    "roomPerformance": [],
    "roomMonthly": [],
    "generatedAt": "ISO-8601"
  }
}
```
En actualización manual también solicita `includeMonthly: true` y recibe `monthly` desde `readMonthlySummary_` **sin crear una segunda implementación**.

## Notas importantes
- Se usa la zona operativa `America/Cancun` para seleccionar el período actual.
- La asignación de ingresos por categoría procede de fórmulas proporcionales del Sheet, no de tarifas nocturnas individuales.
- No modificar las Google Sheets. No desplegar Apps Script ni probar producción hasta que el propietario decida copiar los módulos.
- La subvista Costos se completará al proporcionar la tercera fuente.
