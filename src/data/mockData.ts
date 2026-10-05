import type {
  Alert, CostSummary, DailyPerformance, HotelSnapshot, KPI, MonthlySummary,
  RMSRecommendation, RateDay, RoomPerformance, RoomTypeConfig,
} from '../types'

export const roomTypes: RoomTypeConfig[] = [
  { code: 'NAY', name: 'Suite', rooms: 1, baseRate: 2350, minRate: 1900, maxRate: 3300 },
  { code: "NA'", name: 'Familiar', rooms: 3, baseRate: 2250, minRate: 1800, maxRate: 3100 },
  { code: 'CHA', name: 'King', rooms: 6, baseRate: 1750, minRate: 1350, maxRate: 2550 },
  { code: 'KAA', name: 'Queen económica', rooms: 2, baseRate: 1390, minRate: 1050, maxRate: 1950 },
  { code: 'MUU', name: 'Queen balcón', rooms: 5, baseRate: 1850, minRate: 1450, maxRate: 2700 },
]

const current: HotelSnapshot = {
  revenue: 486240, soldNights: 295, availableNights: 413, bookings: 143,
}

const previous: HotelSnapshot = {
  revenue: 423976, soldNights: 268, availableNights: 413, bookings: 131,
}

const metrics = (snapshot: HotelSnapshot) => ({
  occupancy: snapshot.soldNights / snapshot.availableNights * 100,
  adr: snapshot.revenue / snapshot.soldNights,
  revpar: snapshot.revenue / snapshot.availableNights,
  averageStay: snapshot.soldNights / snapshot.bookings,
})

export function buildKpis(): KPI[] {
  const a = metrics(current)
  const b = metrics(previous)
  return [
    { id: 'revenue', label: 'Ingresos habitaciones', value: current.revenue, previous: previous.revenue, format: 'mxn', helper: 'Ingreso generado únicamente por hospedaje.' },
    { id: 'occupancy', label: 'Ocupación', value: a.occupancy, previous: b.occupancy, format: 'percent', helper: 'Noches vendidas / noches disponibles.', comparisonMode: 'points' },
    { id: 'adr', label: 'ADR', value: a.adr, previous: b.adr, format: 'mxn', helper: 'Ingresos habitaciones / noches vendidas.' },
    { id: 'revpar', label: 'RevPAR', value: a.revpar, previous: b.revpar, format: 'mxn', helper: 'Ingresos habitaciones / noches disponibles.' },
    { id: 'sold', label: 'Noches vendidas', value: current.soldNights, previous: previous.soldNights, format: 'integer', helper: 'Noches habitación vendidas en el periodo.' },
    { id: 'available', label: 'Noches disponibles', value: current.availableNights, previous: previous.availableNights, format: 'integer', helper: 'Habitaciones disponibles × días.' },
    { id: 'bookings', label: 'Reservas', value: current.bookings, previous: previous.bookings, format: 'integer', helper: 'Reservas confirmadas en el periodo.' },
    { id: 'stay', label: 'Estancia promedio', value: a.averageStay, previous: b.averageStay, format: 'decimal', helper: 'Noches vendidas / número de reservas.' },
  ]
}

export const performance: DailyPerformance[] = [
  { date: '01 Oct', ingresos: 13740, ocupacion: 58.8 },
  { date: '02 Oct', ingresos: 16640, ocupacion: 64.7 },
  { date: '03 Oct', ingresos: 22960, ocupacion: 82.4 },
  { date: '04 Oct', ingresos: 26880, ocupacion: 94.1 },
  { date: '05 Oct', ingresos: 20160, ocupacion: 76.5 },
  { date: '06 Oct', ingresos: 17760, ocupacion: 70.6 },
  { date: '07 Oct', ingresos: 19440, ocupacion: 70.6 },
]

export const roomPerformance: RoomPerformance[] = [
  { code: 'NAY', name: 'Suite', rooms: 1, occupancy: 73.3, adr: 2180, revpar: 1599, currentRate: 2350 },
  { code: "NA'", name: 'Familiar', rooms: 3, occupancy: 76.7, adr: 2075, revpar: 1591, currentRate: 2250 },
  { code: 'CHA', name: 'King', rooms: 6, occupancy: 71.1, adr: 1610, revpar: 1145, currentRate: 1750 },
  { code: 'KAA', name: 'Queen económica', rooms: 2, occupancy: 61.7, adr: 1295, revpar: 799, currentRate: 1390 },
  { code: 'MUU', name: 'Queen balcón', rooms: 5, occupancy: 70, adr: 1715, revpar: 1201, currentRate: 1850 },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round10 = (value: number) => Math.round(value / 10) * 10
const iso = (date: Date) => date.toISOString().slice(0, 10)

export function generateRecommendations(start = new Date('2026-10-05T12:00:00')): RMSRecommendation[] {
  const rows: RMSRecommendation[] = []
  for (let day = 0; day <= 180; day += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + day)
    const weekday = date.getDay()
    const weekend = weekday === 5 || weekday === 6 ? 0.18 : weekday === 0 ? 0.09 : 0
    const seasonal = Math.sin((day + 7) / 18) * 0.13
    const event = day % 31 === 5 || day % 31 === 6 ? 0.18 : 0
    const leadPressure = Math.max(0, (32 - day) / 32) * 0.12

    roomTypes.forEach((room, roomIndex) => {
      const roomBias = [0.04, 0.08, 0.02, -0.08, 0.03][roomIndex]
      const noise = Math.sin((day + 1) * (roomIndex + 2)) * 0.06
      const occupancy = clamp(0.54 + weekend + seasonal + event + leadPressure + roomBias + noise, 0.12, 1)
      const occupied = clamp(Math.round(room.rooms * occupancy), 0, room.rooms)
      const actualOccupancy = occupied / room.rooms * 100
      const pickup7 = Math.max(0, Math.round((occupancy - 0.38) * room.rooms * 2.1))
      const demandMultiplier = 0.9 + occupancy * 0.28 + weekend * 0.3 + event * 0.45
      const currentRate = round10(clamp(room.baseRate * (0.94 + weekend + seasonal * 0.45), room.minRate, room.maxRate))
      const recommendedRate = round10(clamp(room.baseRate * demandMultiplier, room.minRate, room.maxRate))
      const demand = actualOccupancy >= 90 ? 'Muy alta' : actualOccupancy >= 75 ? 'Alta' : actualOccupancy < 45 ? 'Baja' : 'Normal'
      const direction = recommendedRate > currentRate ? 'subir' : recommendedRate < currentRate ? 'reducir' : 'mantener'
      const reason = `${actualOccupancy.toFixed(1)}% de ocupación, ${room.rooms - occupied} disponibles y pickup de ${pickup7} noches en 7 días; conviene ${direction} la tarifa.`
      rows.push({
        id: `${iso(date)}-${room.code.replace("'", '')}`,
        date: iso(date), roomCode: room.code, roomName: room.name, capacity: room.rooms,
        occupied, available: room.rooms - occupied, occupancy: actualOccupancy,
        currentRate, recommendedRate, pickup7, demand, reason,
      })
    })
  }
  return rows
}

export function aggregateRateDays(recommendations: RMSRecommendation[]): RateDay[] {
  const grouped = new Map<string, RMSRecommendation[]>()
  recommendations.forEach(row => grouped.set(row.date, [...(grouped.get(row.date) ?? []), row]))
  return [...grouped.entries()].map(([date, rows]) => {
    const capacity = rows.reduce((sum, row) => sum + row.capacity, 0)
    const occupied = rows.reduce((sum, row) => sum + row.occupied, 0)
    return {
      date, occupied, available: capacity - occupied, occupancy: occupied / capacity * 100,
    }
  })
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const generatedMonthly: MonthlySummary[] = [2025, 2026].flatMap(year => monthNames.map((label, month) => {
  const days = new Date(year, month + 1, 0).getDate()
  const availableNights = days * 17
  const seasonal = 0.60 + Math.sin((month + 1) / 1.7) * 0.12 + ([0, 1, 11].includes(month) ? 0.13 : 0)
  const improvement = year === 2026 ? 0.045 : 0
  const occupancy = clamp(seasonal + improvement, 0.38, 0.91)
  const soldNights = Math.round(availableNights * occupancy)
  const adr = 1450 + month * 34 + (year === 2026 ? 95 : 0) + ([0, 11].includes(month) ? 210 : 0)
  const revenue = Math.round(soldNights * adr)
  const costs = Math.round(revenue * (0.56 + (month % 3) * 0.018))
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`, year, month: month + 1,
    label: `${label} ${year}`, revenue, soldNights, availableNights,
    bookings: Math.round(soldNights / 2.08), cancellations: Math.round(soldNights / 34), costs,
    forecastRevenue: Math.round(revenue * (year === 2026 && month >= 9 ? 1.06 : 1)),
    forecastOccupancy: Math.min(96, occupancy * 100 + (year === 2026 && month >= 9 ? 4.2 : 0)),
  }
}))

export const monthly: MonthlySummary[] = generatedMonthly.map(row => {
  if (row.key === '2026-10') return {
    ...row, revenue: current.revenue, soldNights: current.soldNights,
    availableNights: current.availableNights, bookings: current.bookings,
    cancellations: 9, costs: 307820,
    forecastRevenue: 515000, forecastOccupancy: 76.8,
  }
  if (row.key === '2026-09') return {
    ...row, revenue: previous.revenue, soldNights: previous.soldNights,
    availableNights: previous.availableNights, bookings: previous.bookings,
    cancellations: 7, costs: 270000,
    forecastRevenue: previous.revenue, forecastOccupancy: metrics(previous).occupancy,
  }
  if (row.key === '2025-10') return {
    ...row, revenue: 421300, soldNights: 280, availableNights: 413,
    bookings: 134, cancellations: 10, costs: 256000,
    forecastRevenue: 421300, forecastOccupancy: 67.8,
  }
  return row
})

export const costs: CostSummary = {
  registered: 236800,
  estimated: 71020,
}

export function buildAlerts(recommendations: RMSRecommendation[]): Alert[] {
  const opportunities = recommendations
    .filter(row => row.date <= recommendations[69]?.date)
    .map(row => ({ row, impact: (row.recommendedRate - row.currentRate) * Math.max(1, row.available) }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 4)

  return opportunities.map(({ row, impact }, index) => ({
    id: `alert-${row.id}`,
    level: index === 0 ? 'Crítica' : Math.abs(impact) > 350 ? 'Advertencia' : 'Informativa',
    title: impact > 0 ? `Oportunidad de tarifa en ${row.roomCode}` : `Demanda débil en ${row.roomCode}`,
    date: row.date,
    message: row.reason,
    recommendationId: row.id, estimatedImpact: impact,
  }))
}
