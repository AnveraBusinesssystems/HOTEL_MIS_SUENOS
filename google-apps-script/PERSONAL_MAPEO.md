# PERSONAL — Google Apps Script (HMS_IW)

**Estado:** código preparado en GitHub para copiar manualmente al **mismo proyecto** de Apps Script que los demás módulos HMS. No se ha copiado, desplegado ni ejecutado contra datos reales. Las rutas de Personal se bloquean hasta instalar autenticación **real en el servidor**.

## Archivos

- `google-apps-script/Staff.gs`: operaciones de Personal.
- `google-apps-script/Code.gs`: router actualizado con `staff.*`.
- `src/services/staffService.ts`: cliente frontend tipado, **aún no conectado a las pantallas**.
- `google-apps-script/Config.gs`: ya apunta a `HMS_IW`; no cambiar IDs.

## Hojas usadas (mismo spreadsheet HMS_IW)

Todas las hojas tienen encabezados en fila 5 y registros a partir de fila 6; se comprueba el encabezado antes de leer o escribir.

| Hoja | Escrituras exclusivas |
|---|---|
| PERSONAL | A:M: identificación, rol, departamento, pago, estado |
| TURNOS_PERSONAL | A, C:D, G:J, L:O. Se respetan las fórmulas B/E/F/K de cada fila |
| SOLICITUDES_PERSONAL | A:C, E:M. Se conserva la fórmula D (nombre) |
| ASISTENCIA_PERSONAL | A:L: fichajes reales, duración, auditoría |

## Acciones

| Acción | Función | Resultado |
|---|---|---|
| `staff.get` | `getStaff_` | En una sola petición: empleados, turnos del periodo, solicitudes, asistencia |
| `staff.employee.save` | `saveStaffEmployee_` | Crear/editar empleado |
| `staff.employee.status` | `setStaffStatus_` | Desactivar o reactivar; no borra historial |
| `staff.schedule.save` | `saveStaffSchedules_` | Crear/actualizar de 1 a 700 turnos, conservando fórmulas |
| `staff.schedule.delete` | `deleteStaffSchedule_` | Marcar Cancelado, sin borrar físicamente |
| `staff.request.create` | `createStaffRequest_` | Solicitar descanso o día sin goce |
| `staff.request.review` | `reviewStaffRequest_` | Aprobar/rechazar y actualizar turnos relacionados |
| `staff.attendance.punch` | `punchStaff_` | Fichaje de entrada/salida según hora real del servidor |

Ejemplo de lectura: `{"action":"staff.get","startDate":"2026-11-01","endDate":"2026-11-30","refresh":false}`. El máximo es **94 días**. La respuesta se cachea **30 segundos** por usuario y periodo cuando el JSON mide menos de 90.000 caracteres. Cada escritura incrementa la versión del caché y evita lecturas obsoletas.

Ejemplo de lote:
```json
{
  "action":"staff.schedule.save",
  "entries":[
    {"employeeId":"EMP-001","date":"2026-11-18","isRest":false,"shiftStart":"08:00","shiftEnd":"16:00"},
    {"employeeId":"EMP-001","date":"2026-11-19","isRest":true}
  ]
}
```

## Seguridad — **bloqueo deliberado antes de producción**

Todas las acciones llaman a `staffAuth_`, que a su vez requiere implementar `authenticateHmsRequest_(request)` para devolver **solo una identidad verificada en el servidor**: `{id, employeeId, role}`. NO confiar en un campo `role`, `employeeId`, `username` o token fabricado por React. Ningún endpoint de Personal debe abrirse al público hasta completar la autenticación y la autorización. `staff.attendance.punch` exige que el trabajador sea la cuenta autenticada: ni la gerencia puede fichar fingiendo ser otro.

**Actualmente no existe `authenticateHmsRequest_`: las ocho rutas de Personal rechazarán solicitudes.** Esto es intencional. El frontend todavía usa un login de demostración, por lo que conectar `staffService` directamente a los botones sería inseguro. Cuando implementemos la identidad real debemos adaptar el login, fijar políticas de lectura por rol, restringir salarios y datos personales a dueños/gerentes autorizados, y solo entonces conectar la UI con confirmación del servidor antes de mostrar éxito.

## Detalles de rendimiento y calidad

1. Una apertura de spreadsheet por petición; cuatro lecturas rectangulares para `staff.get`, sin consultar individualmente cada turno.
2. Lote de turnos agrupado en rangos contiguos, protegido por `LockService`; IDs aleatorios para evitar choques.
3. Escritura sobre filas existentes (primera A vacía), sin `appendRow`, sin sobrepasar fila 1000 ni reemplazar fórmulas.
4. Validación de fechas `yyyy-MM-dd`, horas `HH:mm`, ID de empleado y encabezados de cada hoja.
5. Las altas de empleado usan tipo de pago de Sheets: por hora/día/semana/quincena/mes. El modelo actual de React solo representa bien el sueldo semanal; antes de usar nómina hay que ampliar tipos y cálculos.
6. Bajas no eliminan el historial. Eliminación física de empleados **no está expuesta** en la API.
7. Solicitudes aprobadas actualizan los turnos solo si sus estados siguen siendo válidos.

## Limitaciones que deben resolverse antes de habilitar el módulo

- **Autenticación:** habilitar login real, permisos por operación y asociación cuenta→empleado. La hoja PERSONAL tiene un correo, pero no es una base segura de credenciales.
- **Datos que no tienen columnas:** turno habitual de entrada/salida y día de descanso por empleado; no se persisten aún en PERSONAL. Se podrían derivar de turnos publicados o incorporar columnas nuevas **solo tras aprobación**. No inventamos persistencia.
- **Capacidad:** turno mensual para 17–30 trabajadores cabe; con gran crecimiento, el límite de 1000 registros de TURNOS_PERSONAL se agota pronto. El código devuelve error en lugar de sobrescribir.
- **Pagos/horas:** los turnos de noche y cálculos de nómina final necesitan reglas específicas. Actualmente los horarios de trabajo requieren salida posterior a entrada (mismo día).
- **Transacciones:** Sheets no da atomicidad entre hojas; si falla la segunda escritura en la aprobación, se necesita conciliación manual. Añadir log de auditoría y recuperación antes del uso operativo.
- **Frontend:** no afirmar éxito antes de respuesta confirmada del servidor. Los cambios visuales actuales siguen siendo locales.
- **Pruebas:** validar en una copia de HMS_IW con casos de turnos, solicitudes, fichajes, permisos, fechas, límites, roles y reintentos antes de copiar a producción.

## Orden de instalación posterior

1. Implementar primero la autenticación real compartida para TODOS los endpoints del sistema, no solo Personal.
2. Copiar `Staff.gs` en el proyecto de Apps Script y actualizar `Code.gs` completo sin borrar las otras rutas.
3. Comprobar encabezados, zona `America/Cancun`, permisos y pruebas en copia de HMS_IW.
4. Conectar `staffService.ts` a Personal (carga por demanda, mutación tras confirmación, estados de error/espera), y autenticar al usuario.
5. Ejecutar pruebas; publicar solo cuando el servidor haga cumplir autorización de todas las acciones de lectura y escritura.
