# HMS — Auditoría de preparación para lanzamiento
**Fecha:** 16 noviembre 2026 · Estado: **preproducción / demostración**, NO apto para datos privados de huéspedes, personal o caja.

Este documento recopila el estado comprobado del código y el trabajo que puede adelantarse sin tocar el proyecto Apps Script ni las hojas reales. No equivale a una prueba end-to-end ni a una certificación de seguridad.

## Resumen de preparación

| Área | Frontend | Puente Apps Script en GitHub | Estado real / pendiente |
| --- | --- | --- | --- |
| Resumen | Sí | Summary.gs | Lectura no activada hasta autenticación; resumen vacío honesto |
| Indicadores | Sí | Indicators.gs | Confirmar fórmulas históricas y consistencia entre periodos |
| RMS / Tarifas | Sí | RMS.gs | Faltan tarifas actuales reales, motor recomendado y publicación Cloudbeds |
| Reservas | Sí | Reservations.gs | Lectura/actualización preparadas; Cloudbeds no sincronizado; probar pagos/asignaciones |
| Operación diaria | Sí | Operation.gs | Revisar trazabilidad de tareas y estados de habitación |
| Caja | Sí | Cash.gs | Auditoría de registros y conciliación antes de escribir dinero |
| Inventario | Sí | Inventory.gs / InventoryPurchases.gs | Flujo de compras y conteos preparados; comprobar fórmula de stock |
| Personal | Sí | Staff.gs | Autenticación y pruebas con datos reales pendientes; los turnos habituales no se almacenan individualmente |
| Configuración | Parcial | Sin módulo de autenticación / permisos | Usuarios y políticas de acceso siguen locales en React |
| Tours | Sí | TourPayments.gs | Actualizaciones/pagos preparados; creación de tours no integrada |

## Hallazgos más importantes

### P0 — Bloqueantes de producción

1. **No hay login de servidor.** `src/App.tsx` todavía emplea una clave de demostración y rol Dueño fijo; `localStorage` **no verifica una identidad**. El acceso a datos reales es inseguro.
2. **Autenticación global de Apps Script ausente.** El router `Code.gs` tiene módulos de lectura y escritura anteriores que no validan una sesión por petición. Instalar solo `authenticateHmsRequest_` para Personal no los protegería. Requiere una política central que cubra todas las acciones.
3. **Publicación del Web App de Apps Script:** confirmar que no permita acciones privadas a usuarios anónimos. Si el frontend y Web App tienen orígenes distintos, diseñar el mecanismo de sesión sin exponer secretos a JavaScript, URL, repositorio ni variables Vite.
4. **Conciliación crítica:** pagos de Reservas/Caja/Tours e inventario deben comprobar que el registro fuente, saldos y movimientos monetarios coincidan y que reintentos no creen duplicados.
5. **Operación de hotel vs Cloudbeds:** los cambios locales en Sheets no son necesariamente una modificación del PMS; verificar qué es fuente de verdad y qué sincronización es realmente disponible.

**Mitigación puesta en GitHub:** `src/services/apiClient.ts` tiene `serverAuthenticated = false`, y bloquea **todas** las llamadas privadas. `hotelService.isConfigured` permanece falso. El frontend muestra claramente **ENTORNO DE DEMOSTRACIÓN** y no presume actualización real. No cambiar a `true` sin implementar y probar el sistema autenticado completo.

### P1 — Calidad funcional

- Personal: almacenaje de horas habituales y descanso habitual individual pendiente; actualizar tipología de pago (por hora, diario, semanal, quincenal, mensual).
- Personal: `staff.get` devuelve un rango temporal, no todo el historial; el planificador semanal y mensual se consulta por periodo.
- Personal: aprobar solicitudes escribe en varias hojas sin transacción atómica; añadir conciliación o mecanismo de recuperación en caso de fallo parcial.
- Personal: `StaffManagement` está conectado a contrato de persistencia, pero el modo permanece de vista previa. `SettingsView` es local y no debe ser el origen de verdad de permisos.
- Personal: el modo de vista previa **no conserva** altas, horarios y solicitudes tras recargar. No usarlo para planificar realmente turnos.
- Reservas: el conector actual limita -30/+180 días y máximo 500 registros; disponer de búsqueda histórica/paginación antes de confiar en el archivo completo.
- RMS: no mostrar tarifas recomendadas como publicadas. Cloudbeds no conectado y acciones de publicación simuladas deben seguir etiquetadas.
- Operación: comprobar turnos, incidencias, limpieza y permisos de acceso para personal real.
- UI: revisar navegadores Safari/iOS y Chrome/Android, tablets y pantallas angostas; probar por separado los diálogos y selecciones del calendario.
- Datos: definir errores, vacíos, fechas `America/Cancun`, nombres y límites de columnas según HMS_IW; no inventar métricas faltantes.
- Rendimiento: monitorear tiempos en Web App y puntos donde scripts sobre Sheets ejecutan múltiples escrituras; la compilación rápida no demuestra tiempo de respuesta real.

### P2 — Refinamientos posteriores

- Configurar Google Hotel / Cloudbeds y estrategia de distribución de tarifas cuando estén disponibles.
- Crear respaldo periódico, bitácora de cambios con quién/cuándo/qué, y procedimiento de recuperación.
- Hacer revisión de accesibilidad con teclado/lector de pantalla, foco de diálogos, contraste y navegación móvil.
- Documentar manuales cortos por puesto: Recepción, Limpieza, Gerencia y Dueño.
- Separar claramente entorno de pruebas y producción con dos Sheets y dos despliegues Apps Script.

## Pruebas automáticas añadidas

- `tests/staff-api.test.mjs`: simulador de Sheets aislado (sin red), autorización, horarios, fórmulas, solicitudes y fichajes.
- `tests/launch-safety.test.mjs`: contrato de acciones API, seguridad demostración y pasos de compilación.
- `npm test`: ejecuta todas las pruebas.
- `npm run build`: TypeScript y Vite.
- `.github/workflows/deploy.yml`: antes de publicar corre pruebas y build; si fallan, no se despliega.

Estas pruebas **no escriben en Google Sheets**, no ejecutan el entorno real Apps Script ni reemplazan una prueba end-to-end de operación.

## Instrucciones de retomarlo cuando el dueño tenga tiempo

1. Crear cuentas del dueño y gerente a través de un servicio de autenticación seguro; nunca usar correo, rol o `localStorage` como verificación suficiente.
2. Diseñar la autenticación Apps Script y proteger **todas** las acciones `Code.gs`, con roles por módulo, por empleado y por acción.
3. Copiar los archivos `.gs` completos del repositorio a un proyecto Apps Script **de pruebas**, asociado a una copia de HMS_IW. Revisar permisos y no poner secretos en GitHub.
4. Habilitar conexión de pruebas, revisar todos los módulos y concurrencia (dos usuarios editando, pago repetido, sesión expirada, error a mitad de proceso).
5. Hacer respaldo de HMS_IW antes de operar y comparar saldos/registros tras cada prueba; mover a producción solo cuando todo haya sido confirmado.
6. Activar conexión real en el frontend tras verificar la identidad y reemplazar explícitamente el bloqueo actual. No basta cambiar una constante a true.

## Acciones realizadas en este pase

- Inspección estática de componentes de Resumen, Indicadores, RMS, Reservas, Operación diaria, Caja, Inventario, Personal, Configuración y Tours.
- Inventario de rutas Google Apps Script y pruebas sintéticas existentes.
- Protección global de API para **no leer ni escribir datos reales desde la identidad demo**.
- Etiqueta global de demostración con estilo responsive, y mensaje de refresco coherente cuando no hay conexión.
- Pipeline con pruebas `npm test` previas al build y publicación.

**No se ha cambiado ninguna hoja Google Sheets ni se ha desplegado Apps Script.**
