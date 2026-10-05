import type { Alert, DailyPerformance, KPI, RateDay, RoomPerformance } from '../types'

export const kpis: KPI[] = [
  { id: 'revenue', label: 'Ingresos habitaciones', value: 486240, previous: 438900, format: 'mxn', helper: 'Ingreso generado únicamente por hospedaje.' },
  { id: 'occupancy', label: 'Ocupación', value: 71.4, previous: 64.1, format: 'percent', helper: 'Noches vendidas / noches disponibles.' },
  { id: 'adr', label: 'ADR', value: 1648, previous: 1582, format: 'mxn', helper: 'Ingresos habitaciones / noches vendidas.' },
  { id: 'revpar', label: 'RevPAR', value: 1177, previous: 1014, format: 'mxn', helper: 'Ingresos habitaciones / noches disponibles.' },
  { id: 'sold', label: 'Habitaciones vendidas', value: 295, previous: 268, format: 'integer', helper: 'Noches habitación vendidas en el periodo.' },
  { id: 'available', label: 'Noches disponibles', value: 413, previous: 413, format: 'integer', helper: 'Habitaciones disponibles × días.' },
  { id: 'bookings', label: 'Reservas', value: 143, previous: 131, format: 'integer', helper: 'Reservas confirmadas en el periodo.' },
  { id: 'stay', label: 'Estancia promedio', value: 2.06, previous: 2.05, format: 'decimal', helper: 'Noches vendidas / número de reservas.' }
]

export const performance: DailyPerformance[] = [
  { date: '01 Oct', ingresos: 13740, ocupacion: 58.8, adr: 1374, revpar: 808 },
  { date: '02 Oct', ingresos: 16640, ocupacion: 64.7, adr: 1513, revpar: 979 },
  { date: '03 Oct', ingresos: 22960, ocupacion: 82.4, adr: 1640, revpar: 1351 },
  { date: '04 Oct', ingresos: 26880, ocupacion: 94.1, adr: 1680, revpar: 1581 },
  { date: '05 Oct', ingresos: 20160, ocupacion: 76.5, adr: 1551, revpar: 1186 },
  { date: '06 Oct', ingresos: 17760, ocupacion: 70.6, adr: 1480, revpar: 1045 },
  { date: '07 Oct', ingresos: 19440, ocupacion: 70.6, adr: 1620, revpar: 1144 }
]

export const roomPerformance: RoomPerformance[] = [
  { code: 'NAY', name: 'Suite', rooms: 1, soldNights: 22, occupancy: 73.3, adr: 2180, revenue: 47960, revpar: 1599, currentRate: 2350 },
  { code: "NA'", name: 'Familiar', rooms: 3, soldNights: 69, occupancy: 76.7, adr: 2075, revenue: 143175, revpar: 1591, currentRate: 2250 },
  { code: 'CHA', name: 'King', rooms: 6, soldNights: 128, occupancy: 71.1, adr: 1610, revenue: 206080, revpar: 1145, currentRate: 1750 },
  { code: 'KAA', name: 'Queen económica', rooms: 2, soldNights: 37, occupancy: 61.7, adr: 1295, revenue: 47915, revpar: 799, currentRate: 1390 },
  { code: 'MUU', name: 'Queen balcón', rooms: 5, soldNights: 105, occupancy: 70.0, adr: 1715, revenue: 180075, revpar: 1201, currentRate: 1850 }
]

export const rateDays: RateDay[] = [
  { date: '06 OCT', occupancy: 70.6, available: 5, adr: 1480, currentRate: 1590, recommendedRate: 1640, arrivals: 4, departures: 3, minStay: 1, status: 'Abierto' },
  { date: '07 OCT', occupancy: 76.5, available: 4, adr: 1551, currentRate: 1650, recommendedRate: 1740, arrivals: 5, departures: 2, minStay: 1, status: 'Abierto' },
  { date: '08 OCT', occupancy: 82.4, available: 3, adr: 1620, currentRate: 1720, recommendedRate: 1890, arrivals: 6, departures: 4, minStay: 2, status: 'Abierto' },
  { date: '09 OCT', occupancy: 88.2, available: 2, adr: 1710, currentRate: 1850, recommendedRate: 2070, arrivals: 3, departures: 2, minStay: 2, status: 'Abierto' },
  { date: '10 OCT', occupancy: 94.1, available: 1, adr: 1830, currentRate: 1980, recommendedRate: 2290, arrivals: 4, departures: 5, minStay: 2, status: 'Abierto' },
  { date: '11 OCT', occupancy: 52.9, available: 8, adr: 1380, currentRate: 1490, recommendedRate: 1420, arrivals: 2, departures: 7, minStay: 1, status: 'Abierto' }
]

export const alerts: Alert[] = [
  { id: 'a1', level: 'Crítica', title: 'Ocupación superior al 90%', date: '10 OCT', message: 'Queda una habitación disponible. La tarifa actual está por debajo de la recomendada.', action: 'Revisar tarifa' },
  { id: 'a2', level: 'Advertencia', title: 'Demanda débil', date: '11 OCT', message: 'La ocupación prevista cae a 52.9% después del fin de semana.', action: 'Evaluar promoción' },
  { id: 'a3', level: 'Informativa', title: 'ADR en recuperación', date: '09 OCT', message: 'El ADR previsto supera el promedio de los últimos siete días.', action: 'Ver tendencia' }
]