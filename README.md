# Hotel Mis Sueños Holbox — RMS Frontend

Frontend profesional para el sistema interno de Hotel Mis Sueños Holbox.

## Alcance actual · Build 0.3

- React + TypeScript + Vite
- Resumen ejecutivo orientado a decisiones
- KPIs derivados de una sola fuente de datos mock
- Vista de indicadores mensual y anual
- Comparación contra mes y año anterior
- Calendario RMS para 14, 30, 90 o 180 días
- Recomendación simulada por fecha y tipo de habitación
- Detalle simple de tarifa, ocupación, disponibilidad y pickup
- Datos y servicios mock desacoplados de la interfaz
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
  data/       datos simulados
  services/   capa desacoplada para futuras APIs
  types.ts    contratos TypeScript
  components/ vistas de Resumen, Indicadores y RMS
  App.tsx     navegación y estado principal
  styles.css  sistema visual
```

## Conexión futura

La interfaz consume `hotelService`. En la siguiente fase se puede sustituir su implementación mock por Google Apps Script y Google Sheets sin reconstruir las pantallas. El algoritmo real de precios se conectará después desde el RMS desarrollado en Python.
