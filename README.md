# Hotel Mis Sueños Holbox — RMS Frontend

Frontend profesional para el sistema interno de Hotel Mis Sueños Holbox.

## Alcance actual · Build 1.14

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

## Conexión futura

La interfaz consume `hotelService`, que actualmente entrega un estado vacío. En la siguiente fase puede conectarse con Google Apps Script, Google Sheets y Cloudbeds sin reconstruir las pantallas. El algoritmo real de precios se conectará después desde el RMS desarrollado en Python.
