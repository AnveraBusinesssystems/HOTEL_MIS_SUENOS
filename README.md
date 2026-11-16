# Hotel Mis Sueños Holbox — RMS Frontend

> **Estado actual (16 noviembre 2026): ENTORNO DE DEMOSTRACIÓN, NO PRODUCCIÓN.**
> El acceso actual es local y no autentica al dueño. Para proteger los datos privados,
> `src/services/apiClient.ts` bloquea todas las lecturas y escrituras reales hasta
> que exista una sesión validada por el servidor. Las operaciones en Personal
> son demostrativas y no persisten al recargar. No desactivar el bloqueo
> sin auditar y proteger **todos** los endpoints del router Apps Script.
>
> Revisar [PRE_LAUNCH_AUDIT.md](PRE_LAUNCH_AUDIT.md) para tareas antes de abrir el hotel al sistema real.
> Pruebas: `npm test`, compilación: `npm run build`.

Frontend profesional para el sistema interno de Hotel Mis Sueños Holbox.

## Alcance actual · Build 1.17

- React + TypeScript + Vite
- Resumen ejecutivo orientado a decisiones
- KPIs preparados para una fuente de datos real
- Vista de indicadores mensual y anual
- Comparación contra mes y año anterior
- Calendario RMS para 14, 30, 90 o 180 días
- Matriz de recomendaciones por fecha y tipo de habitación
- Detalle simple de tarifa, ocupación, disponibilidad y pickup
- Preparación local de tarifas para una futura publicación en Cloudbeds
- Estado inicial vacío, sin registros operativos o financieros precargados
- Tarjetas y paneles conservan su estructura cuando todavía no hay datos
- Preparado para GitHub Pages

## Ejecutar

```bash
npm install
npm run dev
```

## Probar y compilar

```bash
npm test
npm run build
```

## Arquitectura

```
src/
  data/       configuración estructural y estado vacío
  services/   capa desacoplada para futuras APIs
  types.ts    contratos TypeScript
  components/ vistas de Resumen, Indicadores y RMS
  App.tsx     navegación y estado principal
  styles.css  sistema visual
```

## Configurar el despliegue de Google Apps Script

El build de GitHub Pages consume la variable de GitHub Actions **`VITE_APPS_SCRIPT_URL`** en `.github/workflows/deploy.yml`. Debe contener la URL `/exec` del Web App. No se necesita pegar ese valor en `App.tsx`, `apiClient.ts` ni `Config.gs`.

**Importante — no activar aún:** el proyecto HMS_INTERNO dispone de un despliegue Apps Script pero todavía hay rutas anteriores a Personal sin autenticación de servidor. Por lo tanto, **no copiar la URL real a un archivo público ni incrustarla en el bundle de GitHub Pages** hasta proteger todas las rutas. Una URL de Apps Script no es un secreto de autenticación y las variables `VITE_*` se publican en JavaScript al compilar.

Cuando esté listo el sistema de sesiones y permisos:

1. GitHub → repositorio HOTEL_MIS_SUENOS → Settings → Secrets and variables → Actions → Variables → New repository variable.
2. Nombre: `VITE_APPS_SCRIPT_URL`. Valor: la URL de despliegue Apps Script que termina en `/exec`.
3. Volver a Actions y ejecutar el workflow de GitHub Pages para recompilar con la variable.
4. Verificar lectura autorizada, rechazo anónimo, rol de dueño/gerencia, protección de escrituras y expiración de sesión.

**No basta colocar la variable:** `src/services/apiClient.ts` bloquea todas las llamadas hasta que exista autenticación real del servidor. No cambiar `serverAuthenticated` a `true` como atajo. El enlace del deployment actual se mantiene fuera de GitHub por seguridad.

## Conexión Google Sheets

La interfaz consume `hotelService`. Si `VITE_APPS_SCRIPT_URL` está vacía o la API no responde, conserva el estado visual vacío. Cuando la variable apunta a una implementación `/exec`, `Resumen` carga todo su paquete con una sola petición.

`Indicadores` reutiliza la información mensual ya cargada y solicita el desglose por habitación una sola vez al abrir la pestaña. Una actualización manual de esa pantalla refresca sus datos completos en una petición.

`Reservas` se carga únicamente al abrir su pestaña. Apps Script limita la respuesta a la ventana operativa, normaliza estados, canales y habitaciones, y permite registrar check-in, check-out, asignación y pagos sin descargar el historial completo.

El código del puente está en `google-apps-script/` y se copia manualmente al proyecto de Apps Script. Consulta su README antes de publicar datos: la autenticación de servidor debe completarse antes del uso definitivo.
