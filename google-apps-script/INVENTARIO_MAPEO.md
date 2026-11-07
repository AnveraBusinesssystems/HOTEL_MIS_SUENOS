# INVENTARIO — Mapeo del dashboard

**Fuentes:** Inventory (ID 1zNiCArC7sYnOVeoCDEOR2Xf0PV6x9GJJh6PlafLDGhs) y HMS_IW (ID 1CY7eP3AU7MmHUOx2kySKSrONObgstneBUxaPZMHYabc). No se editó ninguna hoja.

## Mapeo exacto

| Vista / dato | Origen | Columnas y filas |
| --- | --- | --- |
| Catálogo, categorías y unidades | Master products | A:C, STATUS F; encabezado 2, datos 3+ |
| Existencias, PAR y último precio | Inventario | A:G; encabezado 2, datos 3+; fórmulas de solo lectura |
| Stock | Inventario | D = compras − uso desde Transacciones |
| PAR | Inventario / Par Calc | Inventario E = Par Calc H (activo); encabezado Par Calc fila 3, datos 4+ |
| Valor estimado | Inventario | D × G solo con precio conocido |
| Compra sugerida | Inventario | max(0, ceil(E−D)), sin columna nueva |
| Ajuste de conteo físico | Transacciones | A:D y G:J; encabezado 2, datos 3+ |
| Compra registrada desde Caja | Transacciones + MOVIMIENTOS_CAJA | Inventory A:D,G:J y HMS_IW A:U; un mismo purchaseId |
| Unidad y precio unitario de la transacción | Transacciones | E:F son fórmulas; se preservan y se generan solo para filas nuevas sin fórmula |
| Recetas y uso de desayunos | Recetas + Transacciones | Recetas encabezado fila 3, productos 4+; el script preexistente ya genera filas uso |
| Lista de mantenimiento | Maintenance Items | A:E, encabezado 2, datos 3+; disponible para módulos futuros |
| Historial de mantenimiento | Maintenance Log | A:G, encabezado 2, datos 3+; no solicitado por InventoryView |
| Solicitudes de compra | Sin tabla adecuada | Pendiente; NO utilizar Pending Review, que sirve para nombres desconocidos |

## API preparada

- inventory.get → getInventory_: catálogo, stock, PAR y precios calculados; caché 120 s.
- inventory.count → saveInventoryCount_: diferencias contra stock actual, con countId y estado anterior verificado; registra las diferencias en Transacciones.
- inventory.purchase → recordInventoryPurchase_: líneas de compra y factura en Transacciones, salida en Caja, identificador común, validación de productos y cantidades.
- Caja recupera los artículos de la factura desde notas de Transacciones con readInventoryPurchaseDetails_.
- En React, inventoryService y hotelService exponen la misma conexión y App carga Inventario al abrir Inventario o Caja. InventoryView espera la confirmación del servidor.
- Dependencias: Config.gs, Code.gs, Utils.gs, Cash.gs, FinanceReaders.gs, Inventory.gs, InventoryPurchases.gs.

## Restricciones de datos

1. Inventario A:G y Par Calc tienen fórmulas: nunca escribir en ellas para cambiar stock.
2. La fórmula existente de Par Calc suma cualquier tipo de Transacciones!B igual a uso. Un ajuste negativo de conteo registrado como uso **altera la estimación PAR** durante el período de cálculo. Para evitarlo, el futuro algoritmo/formula deberá excluir notas AJUSTE CONTEO; no se modificó la hoja en esta fase.
3. Las fórmulas actuales cubren Transacciones filas 3:1000; los endpoints impiden añadir más allá de ese límite.
4. Master products determina nombres canónicos y unidades. Los productos de tipo desayuno no se duplican como uso en esta conexión.
5. La hoja Inventory usa huso America/Toronto, mientras HMS_IW usa America/Cancun. El backend escribe la fecha operativa de Cancún.
6. No existe una tabla de solicitudes persistentes con identificadores, usuarios y aprobaciones. Crear/aprobar solicitudes queda deshabilitado.
7. Los últimos precios marcados VACIO se consideran desconocidos, no MXN 0.
8. La escritura de compra interviene en dos spreadsheets, con idempotencia y rollback de mejor esfuerzo, **no atomicidad garantizada**. Antes del uso real deben existir controles de acceso y conciliación.
9. Mantenimiento tiene hojas existentes, pero no una subvista propia en la pantalla Inventario.
10. No se ejecutaron pruebas, despliegue ni modificaciones en las hojas.

**Siguiente:** Personal y Configuración.
