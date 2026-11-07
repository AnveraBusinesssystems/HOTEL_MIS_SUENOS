# Puente Google Apps Script

Este directorio contiene el código que se copiará manualmente al proyecto de Apps Script. `Resumen` usa una sola petición del navegador (`summary.get`), abre el spreadsheet una vez y solo lee las hojas pequeñas `INDICADORES` y `OPERACION_DIARIA`. El resultado se guarda 60 segundos en caché para evitar lecturas repetidas.

## Instalación manual

1. Crea un proyecto de Apps Script ligado a la cuenta propietaria del hotel.
2. Crea y copia todos los archivos ejecutables `.gs` desde esta carpeta: `Config.gs`, `Code.gs`, `Utils.gs`, `Summary.gs`, `Indicators.gs`, `RMS.gs`, `Reservations.gs`, `Operation.gs`, `FinanceReaders.gs`, `Cash.gs`, `TourPayments.gs`, `Inventory.gs` y `InventoryPurchases.gs`. No copies los archivos `.md` como scripts.
3. En **Configuración del proyecto**, activa la visualización del archivo de manifiesto y reemplaza `appsscript.json`.
4. Implementa como **Aplicación web**, ejecutando como el propietario. Copia la URL que termina en `/exec`.
5. Antes de activar datos reales en GitHub Pages, completa el módulo de autenticación. No uses la URL pública como si fuera una contraseña.
6. Para una prueba controlada, configura la variable de repositorio `VITE_APPS_SCRIPT_URL` con la URL `/exec` y vuelve a ejecutar el deploy de GitHub Pages.

## Contrato actual

```json
{
  "action": "summary.get"
}
```

La respuesta contiene `monthly`, `performance`, `rateDays` y `generatedAt`. Costos y resultado operativo se mantienen sin datos hasta conectar una fuente real de costos.

`Indicadores` usa una segunda acción únicamente cuando se abre esa pestaña:

```json
{
  "action": "indicators.get",
  "includeMonthly": false
}
```

La entrada normal trae solamente `roomPerformance` y `roomMonthly`; reutiliza en el navegador los datos mensuales recibidos por `summary.get`. En una actualización manual, `includeMonthly: true` refresca todo lo necesario para Indicadores dentro de esa única petición.

`Reservas` utiliza `reservations.get` y `reservations.update` para cambiar estado o habitación. `reservations.payment` registra un pago en RESERVAS y MOVIMIENTOS_CAJA con identificador de idempotencia, sin asumir que un monto pagado vacío equivale a cero. La lectura cubre desde 30 días antes hasta 180 días después con límite de 500 reservas. Los pagos requieren conciliación de V si no hay importe histórico conocido.

`RMS / Tarifas` utiliza `rms.get` para ocupación y disponibilidad por categoría durante 180 días. Las tarifas actuales y recomendadas, pickup y demanda predictiva permanecen sin fuente. `operation.get` carga habitaciones, limpieza, datos diarios, Tours y movimientos de caja reutilizando `FinanceReaders.gs`. `operation.event` registra cambios de limpieza e incidencias. Los cobros y liquidaciones de tours existentes usan `tour.payment` (PAGOS_TOURS + MOVIMIENTOS_CAJA), y su estado usa `tour.update` sobre TOURS. Crear nuevos tours sigue bloqueado por falta de campos de proveedor, horario y participantes.

## Seguridad

La web app todavía no incluye autenticación de servidor. El código puede copiarse y probarse, pero no debe exponerse como implementación pública definitiva hasta añadir sesiones y permisos. La siguiente fase de conexión debe implementar el inicio de sesión en Apps Script y validar el token en cada acción.

## Consolidación y límites (noviembre 2026)

- Antes de cualquier despliegue público, implementar autenticación y autorización **en Apps Script**. El login de demostración del frontend **no** autentica peticiones al servidor.
- Las operaciones de reservas y limpieza escriben en Sheets; ninguna tiene garantía de transacción atómica entre varias hojas. La conciliación de pagos debe verificarse antes de uso real.
- Las entradas de caché grandes (> 90.000 caracteres) se omiten sin impedir que el servidor responda; no es necesario cachear calendarios grandes.
- `INDICADORES` y `INDICADORES_HABITACIONES` contienen ADR histórico; no equivale a tarifa publicada. `OPERACION_DIARIA` estima ingresos por noche proporcionalmente.
- Columnas `RESERVAS!AA:AI` contienen fórmulas y no deben sobrescribirse. `ESTADO_HABITACIONES!B:F` también se considera calculado y de solo lectura.
- El registro de datos pendientes está en `REGISTRO_DATOS_FALTANTES.md`; detalles por módulo en `*_MAPEO.md`.
- **Caja** cuenta con lectura, escritura de movimientos independientes, cobros de reservas y tours existentes, apertura, conteo, cierre y anulación controlada. Las compras de inventario y los reembolsos especializados siguen pendientes por depender de otros módulos. **Inventario** ya tiene lectura de productos y existencias, registro de conteos y compras reales conectadas con Caja. Sus solicitudes de compra y el ajuste estadístico de PAR requieren una estructura/fórmula adicional. **Personal y Configuración** siguen pendientes. La presencia de interfaz no significa persistencia real.
- No se han ejecutado pruebas de integración ni se ha desplegado el conjunto actual de archivos.

## Caja (conexiones nuevas)

- `cash.get`: lectura de `MOVIMIENTOS_CAJA` y `CIERRES_CAJA`.
- `cash.movement.create`: solo movimientos independientes no vinculados a una reserva, tour o compra de inventario.
- `cash.movement.annul`: anulación con motivo de movimientos independientes; no modifica el original, conserva registro.
- `cash.day.save`: apertura y conteo; `cash.day.close`: cierre formal, diferencias justificadas y día cerrado sin nuevas escrituras financieras.
- `reservations.payment`: pago y anticipo de huéspedes en Reservas + Caja.
- `tour.payment`: cobro huésped / proveedor / recepción / hotel desde Tours existentes, registrado en `PAGOS_TOURS` y `MOVIMIENTOS_CAJA`.
- `tour.update`: estado de tour, sin sobrescribir las fórmulas de TOURS.
- Detalle y campos pendientes en [`CAJA_MAPEO.md`](CAJA_MAPEO.md). Se requiere control de acceso **en el servidor** antes del despliegue de operaciones reales.

## Inventario

- El segundo spreadsheet se configura en `HMS_CONFIG.INVENTORY_SPREADSHEET_ID`.
- `inventory.get`: leer existencias, nivel PAR y últimos precios de la hoja calculada Inventario.
- `inventory.count`: registrar diferencias del conteo como eventos en Transacciones, sin sobrescribir el stock calculado.
- `inventory.purchase`: comprar productos oficiales en Transacciones y crear una única salida coordinada en MOVIMIENTOS_CAJA; la factura usa identificador compartido.
- Los scripts nuevos deben copiarse **junto con** Cash.gs y sus dependencias al mismo proyecto Apps Script.
- Solicitudes de compra siguen sin fuente persistente; crear/aprobar queda deshabilitado. Los ajustes por conteo negativo pueden modificar el PAR ponderado porque las fórmulas actuales cuentan filas uso.
- Ver INVENTARIO_MAPEO.md para columnas, advertencias y datos que faltan.
