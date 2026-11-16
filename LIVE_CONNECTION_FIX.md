# Corregir lectura de Google Sheets en navegador (16 nov 2026)

## Qué fallaba

El navegador de GitHub Pages enviaba un POST a Apps Script `/exec`.
`ContentService` devuelve una redirección hacia `script.googleusercontent.com`;
la respuesta no siempre permite lecturas `fetch` de un origen distinto (CORS).
Por eso una API puede estar instalada y aun así mostrar un tablero vacío.

También antes se ocultaba el error real y se mostraba un estado vacío sin indicar
qué falló.

## Solución preparada en GitHub

- `google-apps-script/Code.gs`: `doGet(event)` nuevo, retorna los **reportes agregados**
  mediante JSONP (solo `summary.get`, `indicators.get`, `rms.get`).
  Para otras acciones devuelve `FORBIDDEN`. `doPost` ahora deniega
  **todo lo que no sea uno de esos tres reportes**, hasta instalar autenticación
  de servidor para el resto de módulos.
- `src/services/apiClient.ts`: las tres lecturas agregadas usan una etiqueta
  `<script>` con callback validado, timeout y limpieza. Las acciones privadas
  y todos los cambios siguen bloqueados.
- `src/App.tsx`: muestra errores reales del conector en la banda de conexión.
- El proyecto frontend en GitHub Pages **se despliega automáticamente** al
  completarse las pruebas de GitHub Actions.

**No se ha cambiado ningún archivo en el proyecto remoto HMS_INTERNO.**
Instalar en GitHub no actualiza automáticamente Apps Script.

## Paso necesario en el editor de Apps Script

1. Abre el archivo actualizado
   https://github.com/AnveraBusinesssystems/HOTEL_MIS_SUENOS/blob/main/google-apps-script/Code.gs
2. En el proyecto de Apps Script **HMS_INTERNO**, abre `Code.gs`, sustituye
   el archivo **completo** por esta versión de GitHub y guarda.
   No cambies `Config.gs` ni hojas de cálculo.
3. En Apps Script: **Deploy > Manage deployments > Edit (lápiz) >
   Version > New version > Deploy**.
   Guardar el código **no** actualiza un despliegue versionado.
4. Conserva el despliegue `/exec` original. Verifica qué usuarios pueden
   ejecutarlo. Si está abierto a `Anyone`, **cualquier persona** podrá
   consultar los reportes agregados; a cambio el nuevo `doPost` deniega
   acciones privadas y escrituras sin autenticación.
5. Abre el sitio de GitHub Pages y refresca. Si la conexión responde
   correctamente, mostrará **DATOS AGREGADOS EN VIVO**. Si falla, la banda
   debe mostrar un error explicativo; inspecciona `Executions` en Apps Script.

## Importante

- Esto solo comprueba lectura: **Resumen, Indicadores y RMS**.
  No concede acceso a huéspedes, movimientos de caja, inventario ni nómina.
- Esta vía JSONP ejecuta JavaScript servido por Apps Script. Úsala solamente
  con el despliegue de Apps Script de tu confianza. No es una arquitectura
  definitiva para información empresarial confidencial.
- Las cifras mensuales del libro `HMS_IW` existen. Si la conexión falla,
  comprueba el acceso del despliegue, su versión y los errores de
  `getSummary_`, incluidos encabezados y autorizaciones para abrir el Sheet.
- Si se ven cifras en blanco pero el estado dice conectado, revisar los tipos
  de celda y el mapeo de `INDICADORES` en `Summary.gs`.
- Después de la prueba, implementar inicio de sesión verdadero en servidor y
  reemplazar el acceso público por lectura autorizada.
