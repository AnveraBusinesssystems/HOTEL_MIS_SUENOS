# REGISTRO DE DATOS FALTANTES — HOTEL MIS SUEÑOS

**Regla:** Antes de crear una nueva columna, revisar si el dato se puede calcular de manera fiable a partir de campos existentes. Si se puede, conservar la fórmula en React/Apps Script; **no modificar Google Sheets**. Los estados aquí describen diseño preparado, no despliegue verificado.

## 1. Calculables hoy sin añadir columnas

| Módulo | Indicador | Fuentes existentes | Cálculo / nota |
|---|---|---|---|
| Resumen / Indicadores | Ocupación mensual | INDICADORES B, C | C / B; también calculado en INDICADORES D |
| Resumen / Indicadores | ADR mensual | INDICADORES C, E | E / C; también en F |
| Resumen / Indicadores | RevPAR mensual | INDICADORES B, E | E / B; también en G |
| Resumen / Indicadores | Variación mensual/anual | INDICADORES A, B, C, E | Comparar periodos equivalentes; no fabricar base faltante |
| Indicadores | Ocupación, ADR, RevPAR por categoría | INDICADORES_HABITACIONES G, H, J | H/G, J/H y J/G |
| Indicadores | Aporte por categoría | INDICADORES_HABITACIONES D, J | J de categoría / suma J del mes |
| RMS | Capacidad por categoría | CONFIGURACION A, B, C, E, desde fila 19 | Contar habitaciones activas |
| RMS | Ocupación y disponibilidad por fecha y categoría | RESERVAS G,H,J,Q,AC,AD; CONFIGURACION A:E | Sumar unidades no canceladas con entrada ≤ día < salida; no asumir categorías de reservas ambiguas |
| RMS | Diferencia tarifaria | Dos tarifas por día/categoría, una vez existan | Tarifa recomendada − actual; **no requiere columna separada** |
| RMS | Demanda observada (indicador descriptivo, no pronóstico) | Ocupación calculada por fecha | Se puede clasificar según umbrales definidos, pero no fingir predicción |
| Reservas | Saldo teórico | RESERVAS U,V | Total − pagado; RESERVAS W ya registra saldo |

## 2. Información que sí falta como fuente real o historial

| Prioridad | Módulo | Dato faltante | Por qué no se puede reconstruir exactamente | Fuente recomendada |
|---|---|---|---|---|
| Alta | RMS | Tarifa **actual publicada** por fecha y categoría | El ADR pasado (INDICADORES / RESERVAS X) no es el precio de venta futuro | PMS/Cloudbeds, channel manager o fuente tarifaria por fecha/categoría |
| Alta | RMS | Tarifa **recomendada** por fecha y categoría | No existe todavía un modelo que entregue esos resultados | Salida del futuro algoritmo RMS: fecha, categoría, tarifa, límites, razón, versión |
| Alta | RMS | Pickup verdadero a 7 días y cambios de reservas | RESERVAS F fecha de creación permite aproximar **nuevas reservas creadas en siete días**; no reproduce cancelaciones, ajustes ni inventario observado siete días atrás | Snapshots o log histórico de eventos/ediciones |
| Alta | Resumen / Indicadores | Costos reales consolidados y utilidad operativa | Los campos financieros actuales no garantizan todos los gastos por periodo; MOVIMIENTOS_CAJA es movimientos, no necesariamente devengo ni costo total | Tercera hoja de costos en preparación, con fecha, categoría, monto, naturaleza |
| Media | Indicadores | Costos por categoría con historial mensual | Para volatilidad y desglose se requieren montos consistentes por categoría y mes | Tercera hoja de costos |
| Media | RMS | Costos variables por noche/categoría y comisiones por canal | No existe un costo marginal confiable en las tablas de ocupación | Hoja de costos y reglas de comisiones |
| Media | RMS | Forecast probabilístico de demanda y explicación | Ocupación ya reservada no equivale a demanda final prevista | Modelo con históricos, estacionalidad y variables pertinentes |
| Media | RMS | Historial real de tarifas por noche y categoría | RESERVAS R/X describen importes o promedios de estancias, no precios nocturnos individualizados | Histórico del PMS o tarifas por noche |
| Media | Resumen | Alertas económicas RMS con impacto cuantificado | Requieren pronósticos, tarifas de referencia y lógica de recomendaciones | Motor RMS; no inferir impacto ficticio |
| Posterior | RMS | Publicación de precios a Cloudbeds | Exige integración y confirmación externa, no una columna en Sheets | API/integradora Cloudbeds |

## 3. Política para nuevas columnas/tablas

- Primero reutilizar una columna existente, fórmula o dato ya normalizado.
- Solo solicitar nuevos campos cuando la información no se pueda inferir **sin pérdida material de precisión**.
- Para tarifas, el nivel correcto es **fecha × categoría**. No confundir ADR histórico con tarifa publicada.
- Para pickup, conservar snapshots o eventos de cambio con timestamp; fecha de creación F es solamente proxy de reservas nuevas.
- Para costos, separar monto, fecha, categoría, costos fijos/variables y periodo de reconocimiento; no equiparar todos los egresos de caja con costos operativos.
- No incorporar fuentes pendientes como cero; usar datos no disponibles/\`null\` en interfaz.
- No crear/modificar hojas existentes hasta decisión explícita del propietario.

## 4. Secuencia de trabajo por pestañas

1. [x] **Resumen** — columnas y conexión base preparadas; costos/alertas pendientes.
2. [x] **Indicadores** — Rendimiento y Habitaciones preparados; Costos pendiente.
3. [x] **RMS / Tarifas** — ocupación y disponibilidad preparadas; precios, pickup, modelo y publicación pendientes.
4. [ ] **Reservas** — **SIGUIENTE**. Revisar tabla, filtros, estados, asignación, pagos y acciones crear/editar/eliminar. Comparar cada campo con RESERVAS (A:AI), reutilizar \`Reservations.gs\`, y completar las conexiones de escritura necesarias sin modificar la Sheet ahora.
5. [ ] **Operación diaria**
6. [ ] **Caja**
7. [ ] **Inventario** — conectar la segunda hoja Inventory.
8. [ ] **Personal**
9. [ ] **Configuración**

Actualizar este archivo al concluir cada pestaña.
