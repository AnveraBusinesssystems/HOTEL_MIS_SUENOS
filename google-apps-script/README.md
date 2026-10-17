# Puente Google Apps Script

Este directorio contiene el código que se copiará manualmente al proyecto de Apps Script. `Resumen` usa una sola petición del navegador (`summary.get`), abre el spreadsheet una vez y solo lee las hojas pequeñas `INDICADORES` y `OPERACION_DIARIA`. El resultado se guarda 60 segundos en caché para evitar lecturas repetidas.

## Instalación manual

1. Crea un proyecto de Apps Script ligado a la cuenta propietaria del hotel.
2. Crea los archivos `Config.gs`, `Code.gs`, `Utils.gs` y `Summary.gs`; copia su contenido desde esta carpeta.
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

## Seguridad

La web app todavía no incluye autenticación de servidor. El código puede copiarse y probarse, pero no debe exponerse como implementación pública definitiva hasta añadir sesiones y permisos. La siguiente fase de conexión debe implementar el inicio de sesión en Apps Script y validar el token en cada acción.
