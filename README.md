# Hotel Mis Sueños Holbox — RMS Frontend

Frontend profesional para el sistema interno de Hotel Mis Sueños Holbox.

## Alcance actual

- React + TypeScript + Vite
- Dashboard ejecutivo
- KPIs hoteleros
- ADR, RevPAR, ocupación e ingresos
- Desempeño por tipo de habitación
- Calendario operativo/tarifario
- Alertas RMS simuladas
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
  App.tsx     interfaz principal
  styles.css  sistema visual
```

## Fases futuras

La capa `services` podrá sustituirse posteriormente por Google Apps Script, Google Sheets y Cloudbeds sin reconstruir los componentes visuales.
