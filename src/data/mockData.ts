import type {
  Alert, CostSummary, DailyPerformance, HotelSnapshot, MonthlySummary,
  ExpenseCategory, ExpenseRecord, OperationDay, OperationTask, Reservation,
  RMSRecommendation, RateDay, RoomMonthlyPerformance, RoomPerformance, RoomState,
  RoomTypeConfig,
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

const expenseShares: Record<ExpenseCategory, number> = {
  Personal: 0.35,
  Lavandería: 0.09,
  Cocina: 0.14,
  Mantenimiento: 0.1,
  Servicios: 0.13,
  Comisiones: 0.12,
  Otros: 0.07,
}

export const expenses: ExpenseRecord[] = monthly.flatMap(row => {
  const categories = Object.entries(expenseShares) as [ExpenseCategory, number][]
  const weighted = categories.map(([category, share], index) => ({
    category,
    weight: share * (1 + Math.sin((row.month + index * 2) * 0.83) * 0.06),
  }))
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)
  let assigned = 0
  return weighted.map((item, index) => {
    const amount = index === weighted.length - 1
      ? row.costs - assigned
      : Math.round(row.costs * item.weight / totalWeight)
    assigned += amount
    return { key: `${row.key}-${item.category}`, year: row.year, month: row.month, category: item.category, amount }
  })
})

const roomRevenueShares = [0.11, 0.2, 0.31, 0.09, 0.29]
const roomDemandBias = [1.04, 1.09, 1.01, 0.88, 1.02]

export const roomMonthly: RoomMonthlyPerformance[] = monthly.flatMap(row => {
  const days = new Date(row.year, row.month, 0).getDate()
  return roomTypes.map((room, index) => {
    const availableNights = room.rooms * days
    const hotelOccupancy = row.soldNights / row.availableNights
    const occupancy = clamp(hotelOccupancy * roomDemandBias[index] + Math.sin((row.month + index) * 1.3) * 0.025, 0.25, 0.96)
    return {
      key: `${row.key}-${room.code}`,
      year: row.year,
      month: row.month,
      code: room.code,
      soldNights: Math.round(availableNights * occupancy),
      availableNights,
      revenue: Math.round(row.revenue * roomRevenueShares[index]),
    }
  })
})

const reservationNights = (start: string, rates: number[]) => rates.map((rate, index) => {
  const date = new Date(`${start}T12:00:00`)
  date.setDate(date.getDate() + index)
  return { date: iso(date), rate }
})

export const reservations: Reservation[] = [
  { id: 'CB-84621', subReservationId: 'CB-84621-1', guestName: 'Ana Torres', email: 'ana.torres@email.com', phone: '+52 998 241 3078', checkIn: '2026-10-06', checkOut: '2026-10-09', adults: 2, children: 0, roomType: 'CHA', roomNumber: 'CHA-03', status: 'Confirmada', channel: 'Booking.com', total: 5940, paid: 3000, createdAt: '2026-08-18', notes: 'Llegada aproximada a las 16:30.', cleaningRequested: false, nights: reservationNights('2026-10-06', [1880, 1880, 2180]) },
  { id: 'CB-84644', subReservationId: 'CB-84644-1', guestName: 'Diego Ramírez', email: 'diego.r@email.com', phone: '+52 55 9081 2260', checkIn: '2026-10-06', checkOut: '2026-10-08', adults: 2, children: 0, roomType: 'MUU', status: 'Confirmada', channel: 'Directa', total: 4100, paid: 4100, createdAt: '2026-09-12', notes: 'Habitación tranquila si es posible.', cleaningRequested: false, nights: reservationNights('2026-10-06', [1950, 2150]) },
  { id: 'CB-84492', subReservationId: 'CB-84492-1', guestName: 'Marta Ruiz', email: 'marta.ruiz@email.com', phone: '+34 611 204 388', checkIn: '2026-10-04', checkOut: '2026-10-08', adults: 2, children: 1, roomType: "NA'", roomNumber: "NA'-02", status: 'Hospedado', channel: 'Expedia', total: 8920, paid: 8920, createdAt: '2026-07-25', notes: 'Cuna solicitada y confirmada.', cleaningRequested: true, nights: reservationNights('2026-10-04', [2150, 2150, 2210, 2410]) },
  { id: 'CB-84351', subReservationId: 'CB-84351-1', guestName: 'Carlos Medina', email: 'carlos.m@email.com', phone: '+52 984 178 6601', checkIn: '2026-10-02', checkOut: '2026-10-06', adults: 2, children: 0, roomType: 'NAY', roomNumber: 'NAY-01', status: 'Hospedado', channel: 'Cloudbeds', total: 9360, paid: 7000, createdAt: '2026-06-04', notes: 'Salida confirmada para las 10:30.', cleaningRequested: false, nights: reservationNights('2026-10-02', [2180, 2390, 2390, 2400]) },
  { id: 'CB-84287', subReservationId: 'CB-84287-1', guestName: 'Alicia Fernández', email: 'alicia.f@email.com', phone: '+52 81 2250 7301', checkIn: '2026-10-01', checkOut: '2026-10-06', adults: 1, children: 0, roomType: 'KAA', roomNumber: 'KAA-01', status: 'Salida', channel: 'Walk-in', total: 6550, paid: 6550, createdAt: '2026-10-01', notes: '', cleaningRequested: false, nights: reservationNights('2026-10-01', [1250, 1250, 1350, 1350, 1350]) },
  { id: 'CB-84703', subReservationId: 'CB-84703-1', guestName: 'Lucía Campos', email: 'lucia.campos@email.com', phone: '+52 998 540 1182', checkIn: '2026-10-08', checkOut: '2026-10-12', adults: 2, children: 0, roomType: 'MUU', roomNumber: 'MUU-04', status: 'Confirmada', channel: 'Booking.com', total: 8260, paid: 2000, createdAt: '2026-09-28', notes: 'Aniversario. Preparar detalle sencillo.', cleaningRequested: false, nights: reservationNights('2026-10-08', [1850, 2130, 2130, 2150]) },
  { id: 'CB-84719', subReservationId: 'CB-84719-1', guestName: 'John Miller', email: 'john.miller@email.com', phone: '+1 512 555 0184', checkIn: '2026-10-10', checkOut: '2026-10-15', adults: 2, children: 2, roomType: "NA'", roomNumber: "NA'-01", status: 'Confirmada', channel: 'Expedia', total: 11850, paid: 0, createdAt: '2026-09-30', notes: 'Requiere factura al finalizar.', cleaningRequested: false, nights: reservationNights('2026-10-10', [2470, 2470, 2250, 2250, 2410]) },
  { id: 'CB-84742', subReservationId: 'CB-84742-1', guestName: 'Sofía Herrera', email: 'sofia.h@email.com', phone: '+52 998 772 3409', checkIn: '2026-10-12', checkOut: '2026-10-14', adults: 2, children: 0, roomType: 'CHA', roomNumber: 'CHA-05', status: 'Confirmada', channel: 'Directa', total: 3920, paid: 3920, createdAt: '2026-10-02', notes: '', cleaningRequested: false, nights: reservationNights('2026-10-12', [1880, 2040]) },
  { id: 'CB-84588', subReservationId: 'CB-84588-1', guestName: 'Roberto Silva', email: 'roberto.s@email.com', phone: '+52 33 1820 4901', checkIn: '2026-10-07', checkOut: '2026-10-10', adults: 2, children: 0, roomType: 'CHA', roomNumber: 'CHA-01', status: 'Cancelada', channel: 'Booking.com', total: 5790, paid: 0, createdAt: '2026-08-29', notes: 'Cancelación recibida por el canal.', cleaningRequested: false, nights: reservationNights('2026-10-07', [1830, 1830, 2130]) },
]

export const roomStates: RoomState[] = [
  { roomNumber: 'NAY-01', roomType: 'NAY', occupancy: 'Salida prevista', cleaning: 'Limpia', currentReservationId: 'CB-84351' },
  { roomNumber: "NA'-01", roomType: "NA'", occupancy: 'Libre', cleaning: 'Limpia', nextReservationId: 'CB-84719' },
  { roomNumber: "NA'-02", roomType: "NA'", occupancy: 'Ocupada', cleaning: 'Limpia', currentReservationId: 'CB-84492' },
  { roomNumber: "NA'-03", roomType: "NA'", occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'CHA-01', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'CHA-02', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'CHA-03', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Por revisar', nextReservationId: 'CB-84621' },
  { roomNumber: 'CHA-04', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'CHA-05', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Limpia', nextReservationId: 'CB-84742' },
  { roomNumber: 'CHA-06', roomType: 'CHA', occupancy: 'Bloqueada', cleaning: 'Sucia', blockReason: 'Revisión de aire acondicionado' },
  { roomNumber: 'KAA-01', roomType: 'KAA', occupancy: 'Libre', cleaning: 'Sucia', currentReservationId: 'CB-84287' },
  { roomNumber: 'KAA-02', roomType: 'KAA', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'MUU-01', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'MUU-02', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'MUU-03', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'MUU-04', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia', nextReservationId: 'CB-84703' },
  { roomNumber: 'MUU-05', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia' },
]

export const operationTasks: OperationTask[] = [
  { id: 'OP-1001', date: '2026-10-06', roomNumber: 'CHA-03', roomType: 'CHA', type: 'Revisión', status: 'Pendiente', priority: 'Crítica', assignedTo: 'Recepción', requestedAt: '08:04', deadline: '14:30', note: 'Validar amenidades antes de la llegada.', reservationId: 'CB-84621' },
  { id: 'OP-1002', date: '2026-10-06', roomNumber: 'KAA-01', roomType: 'KAA', type: 'Limpieza de salida', status: 'Pendiente', priority: 'Alta', assignedTo: 'María', requestedAt: '08:05', deadline: '13:30', note: 'Salida confirmada temprano.', reservationId: 'CB-84287' },
  { id: 'OP-1003', date: '2026-10-06', roomNumber: "NA'-02", roomType: "NA'", type: 'Limpieza de estancia', status: 'Pendiente', priority: 'Normal', assignedTo: 'Elena', requestedAt: '09:15', deadline: '15:00', note: 'Solicitada por la huésped.', reservationId: 'CB-84492' },
  { id: 'OP-1004', date: '2026-10-06', roomNumber: 'CHA-06', roomType: 'CHA', type: 'Mantenimiento', status: 'En proceso', priority: 'Alta', assignedTo: 'Gerencia', requestedAt: '07:50', startedAt: '08:20', note: 'Aire acondicionado no enfría correctamente.' },
]

export const operationDays: OperationDay[] = Array.from({ length: 21 }, (_, index) => {
  const date = new Date('2026-10-06T12:00:00')
  date.setDate(date.getDate() + index - 10)
  const key = iso(date)
  return {
    date: key,
    status: key < '2026-10-06' ? 'Cerrado' : 'No iniciado',
    openedBy: key < '2026-10-06' ? 'Recepción' : undefined,
    openedAt: key < '2026-10-06' ? '08:00' : undefined,
    handoffNote: key === '2026-10-05' ? 'Pendiente revisar aire acondicionado de CHA-06.' : undefined,
  }
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
