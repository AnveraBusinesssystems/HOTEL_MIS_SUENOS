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

## 2A. Reservas — lo calculable y lo verdaderamente ausente

| Dato | Estado | Acción |
|---|---|---|
| Noches, huéspedes, saldos conocidos, estado de pago, llegadas/salidas | Derivable de RESERVAS G,H,N,O,U,V,Q | **No crear columnas** |
| Asignación y disponibilidad física | RESERVAS M + CONFIGURACION A:E + fechas G,H | Validar antes de cambiar M |
| Cambios de estado | RESERVAS Q; AA es fórmula | Cambiar solo Q |
| Movimiento de pago con método | MOVIMIENTOS_CAJA A:U + RESERVAS V/W | Conexión preparada, sin crear columnas |
| Pagos históricos con V vacío | **Desconocidos** | Conciliación real, no inferir cero |
| Email / teléfono huésped | **No están en RESERVAS A:AI** | Buscar PMS o añadir fuente de contacto cuando corresponda |
| Solicitud de limpieza persistente | **No hay campo persistente conectado** | Reutilizar tareas de Operación diaria cuando se implemente |
| Búsqueda de reservas más allá de -30/+180 días y más de 500 registros | Limitación de la lectura actual | Extender filtros/paginación de API, **sin nuevas columnas** |
| Crear reservas / borrar | Botones no existen en la UI actual | No construir acciones destructivas invisibles |
| Link y sincronización Cloudbeds | Conector pendiente | Integración externa futura, **no columna** |

Ver `RESERVAS_MAPEO.md` para las 35 columnas y reglas de escritura.

## 2B. Operación diaria — sin duplicar datos

| Dato | ¿Nueva columna? | Acción |
| --- | --- | --- |
| Llegadas/salidas, huéspedes alojados, noches y desayuno esperado | No | RESERVAS + OPERACION_DIARIA A:R |
| Habitación activa y categoría | No | CONFIGURACION A:E |
| Estado básico de habitaciones | No | ESTADO_HABITACIONES A:F, fórmulas protegidas |
| Responsable, inicio, fin, incidencia activa | No | ESTADO_HABITACIONES G:M |
| Historial de acciones de limpieza | No | REGISTRO_LIMPIEZA A:F |
| Tareas complejas, prioridades, estados y vencimientos exactos | Falta estructura persistente | El log simple no conserva todo el modelo; estudiar fuente adecuada antes de agregar campos |
| Acceso/no molestar, bloqueos manuales | Falta persistencia fiable | No inferir desde las fórmulas de ocupación |
| Apertura/cierre de jornada | Falta estado persistente | No confundir marca local con sincronización Cloudbeds |
| Envío e historial de cierre operativo | Falta fuente | CIERRES_CAJA es diferente de reporte operativo diario |
| Tours: lista e importes | No | Lectura de TOURS A:V implementada; MOVIMIENTOS_CAJA compartido con Caja |
| Tours: horario del servicio, proveedor, cantidad de personas | Faltan campos estructurados | No derivables con fiabilidad del TOURS actual |
| Tours: cobro, proveedor, comisión y estado persistente | Falta acción de escritura | Requiere coordinar TOURS, PAGOS_TOURS y MOVIMIENTOS_CAJA; bloqueado en UI hasta conectar |
| Ingresos diarios y ADR / RevPAR de cierre | No | Reutiliza OPERACION_DIARIA A:R; los ingresos son estimaciones proporcionales |
| Fichajes de personal | Falta fuente de asistencia real | TURNOS_PERSONAL son turnos programados |
| Cancelaciones del día | Falta log de eventos | Estado actual de reserva no da fecha de cancelación |

Ver `OPERACION_DIARIA_MAPEO.md`. Se reutilizan las rutas de RESERVAS y se añade `operation.get`/`operation.event`.

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
4. [x] **Reservas** — lectura, filtros locales, validación de asignación, actualización de estados y registro de pagos preparado. Faltan fuente de contacto, persistencia de limpieza, búsqueda histórica fuera de ventana y sincronización Cloudbeds.
5. [x] **Operación diaria** — lecturas de habitaciones, limpieza, datos diarios, tours y caja preparadas; registro de eventos y salidas preparado. Pendiente: acciones de escritura de Tours, tareas avanzadas, apertura/cierre formal, asistencia y envío de reportes.
6. [x] **Caja** — lectura del libro de movimientos, cobros de reservas, cobros/liquidaciones de tours existentes, movimientos independientes, anulación, apertura, conteo y cierre preparados. Pendientes dependientes: compras de Inventario, reembolsos y autenticación del servidor.
7. [ ] **Inventario** — **SIGUIENTE**. Conectar la hoja Inventory y las compras procedentes de Caja.
8. [ ] **Personal**
9. [ ] **Configuración**

Actualizar este archivo al concluir cada pestaña.

## 5. Consolidación transversal del código (6 nov 2026)

Se corrigieron el tratamiento de datos desconocidos en finanzas, la selección de mes de Resumen en horario de Cancún, la denominación de ADR histórico, los límites del caché de RMS/Reservas, la invalidación de caché de Operación, los reintentos de pagos y la recuperación básica de operaciones fallidas. **Esto no añade nuevas columnas ni implica despliegue o pruebas.**

**Riesgos pendientes de alta prioridad:** autenticación y permisos del servidor, transacciones interhojas para pagos, eliminación total de cambios optimistas locales, normalización de reservas multihabitación y disponibilidad de fuentes reales de costos/tarifas. Ver `CONSOLIDACION_AUDITORIA.md`.

## 6. Consolidación de Reservas y Operación diaria — 6 nov 2026

- **Sin nuevas columnas:** se reutiliza `operation.event` para solicitudes de limpieza desde Reservas y Operación; `reservations.update` para salidas, estados y asignaciones.
- **Confirmación de escrituras:** ya no se presentan como guardados los cambios locales de limpieza/habitaciones si falla Apps Script.
- **Estructura todavía faltante:** apertura de jornada persistente; acceso/no molestar; tareas individuales con IDs/prioridades; resoluciones individuales de incidencias; vínculo entre cada solicitud de limpieza y reserva.
- **Precaución financiera:** reintentos de pago con el mismo ID, con conciliación obligatoria si el libro de caja y el monto acumulado no coinciden.
- **Previo a producción:** autenticación y autorización servidor, y verificación manual de las rutas y de la recuperación ante fallos interhojas.

## 7. Caja — información y columnas pendientes (6 nov 2026)

- **Sin nuevas columnas:** `MOVIMIENTOS_CAJA!A:U` permite registrar, clasificar y anular movimientos; `CIERRES_CAJA!A:T` registra apertura, conteo y cierre. D:O de CIERRES_CAJA son fórmulas y permanecen de solo lectura.
- **Reservas:** pagos y anticipos usan `RESERVAS!U,V,W` y `MOVIMIENTOS_CAJA`; no asumir cero cuando V esté vacío.
- **Tours existentes:** los pagos se registran en `PAGOS_TOURS!A:M` y `MOVIMIENTOS_CAJA`, mientras `TOURS!J:R` calcula cobros y saldos; no duplicar esas fórmulas.
- **Fuentes faltantes para terminar procesos relacionados:** compras de inventario con el segundo spreadsheet; reembolsos de reservas/tours; comprobantes y archivos; usuario autenticado y aprobación de cierre; crear tours con proveedor, hora y personas.
- **Permisos y verificación:** la autenticación del servidor es obligatoria antes de publicar las escrituras. Todas las conexiones están preparadas en GitHub, no desplegadas ni probadas.

Ver `CAJA_MAPEO.md`.
