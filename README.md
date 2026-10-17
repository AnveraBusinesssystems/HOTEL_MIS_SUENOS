# Hotel Mis Sueños Holbox — RMS Frontend

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

## Compilar

```bash
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

## Conexión Google Sheets

La interfaz consume `hotelService`. Si `VITE_APPS_SCRIPT_URL` está vacía o la API no responde, conserva el estado visual vacío. Cuando la variable apunta a una implementación `/exec`, `Resumen` carga todo su paquete con una sola petición.

`Indicadores` reutiliza la información mensual ya cargada y solicita el desglose por habitación una sola vez al abrir la pestaña. Una actualización manual de esa pantalla refresca sus datos completos en una petición.

`Reservas` se carga únicamente al abrir su pestaña. Apps Script limita la respuesta a la ventana operativa, normaliza estados, canales y habitaciones, y permite registrar check-in, check-out, asignación y pagos sin descargar el historial completo.

El código del puente está en `google-apps-script/` y se copia manualmente al proyecto de Apps Script. Consulta su README antes de publicar datos: la autenticación de servidor debe completarse antes del uso definitivo.
