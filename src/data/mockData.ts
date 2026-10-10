import type {
  Alert, CostSummary, DailyPerformance, HotelSnapshot, MonthlySummary,
  CashDay, CashMovement, ExpenseCategory, ExpenseRecord, OperationDay, OperationTask, Reservation,
  RMSRecommendation, RateDay, RoomMonthlyPerformance, RoomPerformance, RoomState,
  RoomTypeConfig, StaffMember, StaffRequest, StaffScheduleEntry, StaffTimeEntry, TourBooking, UserAccount,
} from '../types'

export const roomTypes: RoomTypeConfig[] = [
  { code: 'NAY', name: 'Suite', rooms: 1, baseRate: 2350, minRate: 1900, maxRate: 3300 },
  { code: "NA'", name: 'Familiar', rooms: 3, baseRate: 2250, minRate: 1800, maxRate: 3100 },
  { code: 'CHA', name: 'King', rooms: 6, baseRate: 1750, minRate: 1350, maxRate: 2550 },
  { code: 'KAA', name: 'Queen económica', rooms: 2, baseRate: 1390, minRate: 1050, maxRate: 1950 },
  { code: 'MUU', name: 'Queen balcón', rooms: 5, baseRate: 1850, minRate: 1450, maxRate: 2700 },
]

export const roomNumbers = {
  NAY: ['NAY17'],
  "NA'": ['NA1', 'NA2', 'NA3'],
  CHA: ['CHA4', 'CHA5', 'CHA6', 'CHA7', 'CHA8', 'CHA9'],
  KAA: ['KA10', 'KA11'],
  MUU: ['MUU12', 'MUU13', 'MUU14', 'MUU15', 'MUU16'],
} satisfies Record<RoomTypeConfig['code'], string[]>

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
  { id: 'CB-84621', subReservationId: 'CB-84621-1', guestName: 'Ana Torres', email: 'ana.torres@email.com', phone: '+52 998 241 3078', checkIn: '2026-10-06', checkOut: '2026-10-09', adults: 2, children: 0, roomType: 'CHA', roomNumber: 'CHA6', status: 'Confirmada', channel: 'Booking.com', total: 5940, paid: 3000, createdAt: '2026-08-18', notes: 'Llegada aproximada a las 16:30.', cleaningRequested: false, nights: reservationNights('2026-10-06', [1880, 1880, 2180]) },
  { id: 'CB-84644', subReservationId: 'CB-84644-1', guestName: 'Diego Ramírez', email: 'diego.r@email.com', phone: '+52 55 9081 2260', checkIn: '2026-10-06', checkOut: '2026-10-08', adults: 2, children: 0, roomType: 'MUU', status: 'Confirmada', channel: 'Directa', total: 4100, paid: 4100, createdAt: '2026-09-12', notes: 'Habitación tranquila si es posible.', cleaningRequested: false, nights: reservationNights('2026-10-06', [1950, 2150]) },
  { id: 'CB-84492', subReservationId: 'CB-84492-1', guestName: 'Marta Ruiz', email: 'marta.ruiz@email.com', phone: '+34 611 204 388', checkIn: '2026-10-04', checkOut: '2026-10-08', adults: 2, children: 1, roomType: "NA'", roomNumber: 'NA2', status: 'Hospedado', channel: 'Expedia', total: 8920, paid: 8920, createdAt: '2026-07-25', notes: 'Cuna solicitada y confirmada.', cleaningRequested: true, nights: reservationNights('2026-10-04', [2150, 2150, 2210, 2410]) },
  { id: 'CB-84351', subReservationId: 'CB-84351-1', guestName: 'Carlos Medina', email: 'carlos.m@email.com', phone: '+52 984 178 6601', checkIn: '2026-10-02', checkOut: '2026-10-06', adults: 2, children: 0, roomType: 'NAY', roomNumber: 'NAY17', status: 'Hospedado', channel: 'Cloudbeds', total: 9360, paid: 7000, createdAt: '2026-06-04', notes: 'Salida confirmada para las 10:30.', cleaningRequested: false, nights: reservationNights('2026-10-02', [2180, 2390, 2390, 2400]) },
  { id: 'CB-84287', subReservationId: 'CB-84287-1', guestName: 'Alicia Fernández', email: 'alicia.f@email.com', phone: '+52 81 2250 7301', checkIn: '2026-10-01', checkOut: '2026-10-06', adults: 1, children: 0, roomType: 'KAA', roomNumber: 'KA10', status: 'Salida', channel: 'Walk-in', total: 6550, paid: 6550, createdAt: '2026-10-01', notes: '', cleaningRequested: false, nights: reservationNights('2026-10-01', [1250, 1250, 1350, 1350, 1350]) },
  { id: 'CB-84703', subReservationId: 'CB-84703-1', guestName: 'Lucía Campos', email: 'lucia.campos@email.com', phone: '+52 998 540 1182', checkIn: '2026-10-08', checkOut: '2026-10-12', adults: 2, children: 0, roomType: 'MUU', roomNumber: 'MUU15', status: 'Confirmada', channel: 'Booking.com', total: 8260, paid: 2000, createdAt: '2026-09-28', notes: 'Aniversario. Preparar detalle sencillo.', cleaningRequested: false, nights: reservationNights('2026-10-08', [1850, 2130, 2130, 2150]) },
  { id: 'CB-84719', subReservationId: 'CB-84719-1', guestName: 'John Miller', email: 'john.miller@email.com', phone: '+1 512 555 0184', checkIn: '2026-10-10', checkOut: '2026-10-15', adults: 2, children: 2, roomType: "NA'", roomNumber: 'NA1', status: 'Confirmada', channel: 'Expedia', total: 11850, paid: 0, createdAt: '2026-09-30', notes: 'Requiere factura al finalizar.', cleaningRequested: false, nights: reservationNights('2026-10-10', [2470, 2470, 2250, 2250, 2410]) },
  { id: 'CB-84742', subReservationId: 'CB-84742-1', guestName: 'Sofía Herrera', email: 'sofia.h@email.com', phone: '+52 998 772 3409', checkIn: '2026-10-12', checkOut: '2026-10-14', adults: 2, children: 0, roomType: 'CHA', roomNumber: 'CHA8', status: 'Confirmada', channel: 'Directa', total: 3920, paid: 3920, createdAt: '2026-10-02', notes: '', cleaningRequested: false, nights: reservationNights('2026-10-12', [1880, 2040]) },
  { id: 'CB-84588', subReservationId: 'CB-84588-1', guestName: 'Roberto Silva', email: 'roberto.s@email.com', phone: '+52 33 1820 4901', checkIn: '2026-10-07', checkOut: '2026-10-10', adults: 2, children: 0, roomType: 'CHA', roomNumber: 'CHA4', status: 'Cancelada', channel: 'Booking.com', total: 5790, paid: 0, createdAt: '2026-08-29', notes: 'Cancelación recibida por el canal.', cleaningRequested: false, nights: reservationNights('2026-10-07', [1830, 1830, 2130]) },
]

export const roomStates: RoomState[] = [
  { roomNumber: 'NA1', roomType: "NA'", occupancy: 'Libre', cleaning: 'Limpia', nextReservationId: 'CB-84719' },
  { roomNumber: 'NA2', roomType: "NA'", occupancy: 'Ocupada', cleaning: 'Limpia', accessStatus: 'Limpieza solicitada', currentReservationId: 'CB-84492', issues: [{ id: 'INC-1001', type: 'Falta papel higiénico', status: 'Pendiente', reportedAt: '09:15', reportedBy: 'Recepción', taskId: 'OP-1003R' }] },
  { roomNumber: 'NA3', roomType: "NA'", occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'CHA4', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'CHA5', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'CHA6', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Por revisar', nextReservationId: 'CB-84621' },
  { roomNumber: 'CHA7', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'CHA8', roomType: 'CHA', occupancy: 'Libre', cleaning: 'Limpia', nextReservationId: 'CB-84742' },
  { roomNumber: 'CHA9', roomType: 'CHA', occupancy: 'Bloqueada', cleaning: 'Sucia', blockReason: 'Revisión de aire acondicionado' },
  { roomNumber: 'KA10', roomType: 'KAA', occupancy: 'Libre', cleaning: 'Sucia', currentReservationId: 'CB-84287' },
  { roomNumber: 'KA11', roomType: 'KAA', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'MUU12', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'MUU13', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'MUU14', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'MUU15', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia', nextReservationId: 'CB-84703' },
  { roomNumber: 'MUU16', roomType: 'MUU', occupancy: 'Libre', cleaning: 'Limpia' },
  { roomNumber: 'NAY17', roomType: 'NAY', occupancy: 'Salida prevista', cleaning: 'Limpia', currentReservationId: 'CB-84351' },
]

export const operationTasks: OperationTask[] = [
  { id: 'OP-1001', date: '2026-10-06', roomNumber: 'CHA6', roomType: 'CHA', type: 'Revisión', status: 'Pendiente', priority: 'Crítica', assignedTo: 'Recepción', requestedAt: '08:04', deadline: '14:30', note: 'Validar amenidades antes de la llegada.', reservationId: 'CB-84621' },
  { id: 'OP-1002', date: '2026-10-06', roomNumber: 'KA10', roomType: 'KAA', type: 'Limpieza de salida', status: 'Pendiente', priority: 'Alta', assignedTo: 'María', requestedAt: '08:05', deadline: '13:30', note: 'Salida confirmada temprano.', reservationId: 'CB-84287' },
  { id: 'OP-1003', date: '2026-10-06', roomNumber: 'NA2', roomType: "NA'", type: 'Limpieza de estancia', status: 'Pendiente', priority: 'Normal', assignedTo: 'Elena', requestedAt: '09:15', deadline: '15:00', note: 'Solicitada por la huésped.', reservationId: 'CB-84492' },
  { id: 'OP-1003R', date: '2026-10-06', roomNumber: 'NA2', roomType: "NA'", type: 'Reposición', status: 'Pendiente', priority: 'Normal', assignedTo: 'Limpieza', requestedAt: '09:15', deadline: '15:00', note: 'Falta papel higiénico.' },
  { id: 'OP-1004', date: '2026-10-06', roomNumber: 'CHA9', roomType: 'CHA', type: 'Mantenimiento', status: 'En proceso', priority: 'Alta', assignedTo: 'Gerencia', requestedAt: '07:50', startedAt: '08:20', note: 'Aire acondicionado no enfría correctamente.' },
]

export const operationDays: OperationDay[] = Array.from({ length: 21 }, (_, index) => {
  const date = new Date('2026-10-06T12:00:00')
  date.setDate(date.getDate() + index - 10)
  const key = iso(date)
  return {
    date: key,
    status: key < '2026-10-06' ? 'Registrado' : 'No iniciado',
    openedBy: key < '2026-10-06' ? 'Recepción' : undefined,
    openedAt: key < '2026-10-06' ? '08:00' : undefined,
  }
})

export const tours: TourBooking[] = [
  {
    id: 'TOUR-20261009-001', reservationId: 'CB-84621', guestName: 'Ana Torres',
    tourType: 'Tiburón ballena', provider: 'Holbox Tours', serviceDate: '2026-10-09', serviceTime: '07:30', people: 2,
    salePrice: 2800, providerAmount: 2000, status: 'Agendado', paymentStatus: 'Pendiente',
    providerSettlementStatus: 'Pendiente', receptionCommissionStatus: 'Pendiente', settlementDueDate: '2026-10-13',
    createdAt: '2026-10-08 18:20', createdBy: 'Recepción', notes: 'Recoger en recepción 15 minutos antes.',
  },
  {
    id: 'TOUR-20261009-002', guestName: 'Emma García',
    tourType: 'Bioluminiscencia', provider: 'VIP Holbox', serviceDate: '2026-10-09', serviceTime: '20:00', people: 2,
    salePrice: 1600, providerAmount: 1100, status: 'Agendado', paymentStatus: 'Pagado', paymentMethod: 'Efectivo', paidAt: '2026-10-08 17:10',
    providerSettlementStatus: 'Pendiente', receptionCommissionStatus: 'Pendiente', settlementDueDate: '2026-10-13',
    createdAt: '2026-10-08 16:55', createdBy: 'Recepción', notes: 'Cliente externo; llega directo al hotel.',
  },
  {
    id: 'TOUR-20261005-001', reservationId: 'CB-84351', guestName: 'Carlos Medina',
    tourType: 'Tres Islas', provider: 'Holbox Tours', serviceDate: '2026-10-05', serviceTime: '09:00', people: 2,
    salePrice: 1000, providerAmount: 700, status: 'Realizado', paymentStatus: 'Pagado', paymentMethod: 'Tarjeta', paidAt: '2026-10-05 08:30',
    providerSettlementStatus: 'Pendiente', receptionCommissionStatus: 'Pendiente', settlementDueDate: '2026-10-09',
    createdAt: '2026-10-04 19:10', createdBy: 'Recepción',
  },
  {
    id: 'TOUR-20261003-001', reservationId: 'CB-84492', guestName: 'Marta Ruiz',
    tourType: 'Pesca', provider: 'Tours El Chino', serviceDate: '2026-10-03', serviceTime: '06:30', people: 3,
    salePrice: 3000, providerAmount: 2200, status: 'Realizado', paymentStatus: 'Pagado', paymentMethod: 'Efectivo', paidAt: '2026-10-03 06:15',
    providerSettlementStatus: 'Liquidado', providerSettlementMethod: 'Efectivo', settledAt: '2026-10-07 12:10',
    receptionCommissionStatus: 'Pagada', receptionCommissionMethod: 'Efectivo', receptionCommissionPaidAt: '2026-10-07 12:12',
    settlementDueDate: '2026-10-07', createdAt: '2026-10-02 16:40', createdBy: 'Recepción',
  },
]

export const staff: StaffMember[] = [
  { id: 'EMP-001', name: 'María López', role: 'Limpieza', weeklySalary: 2800, defaultShiftStart: '08:00', defaultShiftEnd: '16:00', defaultRestDay: 0, status: 'Activo' },
  { id: 'EMP-002', name: 'Elena Pérez', role: 'Limpieza', weeklySalary: 2800, defaultShiftStart: '09:00', defaultShiftEnd: '17:00', defaultRestDay: 3, status: 'Activo' },
  { id: 'EMP-003', name: 'Diego Santos', role: 'Recepción', weeklySalary: 3200, defaultShiftStart: '08:00', defaultShiftEnd: '16:00', defaultRestDay: 2, status: 'Activo' },
  { id: 'EMP-004', name: 'Karla Méndez', role: 'Cocina', weeklySalary: 3000, defaultShiftStart: '06:30', defaultShiftEnd: '14:30', defaultRestDay: 3, status: 'Activo' },
  { id: 'EMP-005', name: 'Luis Tun', role: 'Alberca', weeklySalary: 2600, defaultShiftStart: '07:00', defaultShiftEnd: '15:00', defaultRestDay: 1, status: 'Activo' },
  { id: 'EMP-006', name: 'Laura Gómez', role: 'Administración', weeklySalary: 4200, defaultShiftStart: '09:00', defaultShiftEnd: '17:00', defaultRestDay: 0, status: 'Activo' },
]

export const staffSchedules: StaffScheduleEntry[] = staff.flatMap(employee => Array.from({ length: 28 }, (_, index) => {
  const date = new Date('2026-09-28T12:00:00')
  date.setDate(date.getDate() + index)
  const isRest = date.getDay() === employee.defaultRestDay
  return { employeeId: employee.id, date: iso(date), isRest, shiftStart: isRest ? undefined : employee.defaultShiftStart, shiftEnd: isRest ? undefined : employee.defaultShiftEnd }
}))

const permissions = (values: Partial<UserAccount['permissions']>): UserAccount['permissions'] => ({
  Resumen: 'Ver', Indicadores: 'Sin acceso', 'RMS / Tarifas': 'Sin acceso', Reservas: 'Sin acceso',
  'Operación diaria': 'Sin acceso', Caja: 'Sin acceso', Personal: 'Ver', ...values,
})

export const userAccounts: UserAccount[] = [
  { id: 'USR-001', employeeId: 'EMP-001', username: 'maria.lopez', role: 'Limpieza', status: 'Activo', permissions: permissions({ 'Operación diaria': 'Editar' }) },
  { id: 'USR-002', employeeId: 'EMP-002', username: 'elena.perez', role: 'Limpieza', status: 'Activo', permissions: permissions({ 'Operación diaria': 'Editar' }) },
  { id: 'USR-003', employeeId: 'EMP-003', username: 'diego.santos', role: 'Recepción', status: 'Activo', permissions: permissions({ Reservas: 'Editar', 'Operación diaria': 'Editar', Caja: 'Editar' }) },
  { id: 'USR-004', employeeId: 'EMP-004', username: 'karla.mendez', role: 'Cocina', status: 'Activo', permissions: permissions({ 'Operación diaria': 'Ver' }) },
  { id: 'USR-005', employeeId: 'EMP-005', username: 'luis.tun', role: 'Alberca', status: 'Activo', permissions: permissions({ 'Operación diaria': 'Ver' }) },
  { id: 'USR-006', employeeId: 'EMP-006', username: 'laura.gomez', role: 'Administración', status: 'Activo', permissions: permissions({ Indicadores: 'Ver', Reservas: 'Ver', 'Operación diaria': 'Editar', Caja: 'Editar', Personal: 'Editar' }) },
]

export const staffTimeEntries: StaffTimeEntry[] = [
  { id: 'ASIS-001', employeeId: 'EMP-001', date: '2026-10-05', clockIn: '07:58', clockOut: '16:03' },
  { id: 'ASIS-002', employeeId: 'EMP-001', date: '2026-10-06', clockIn: '08:04', clockOut: '16:08' },
  { id: 'ASIS-003', employeeId: 'EMP-001', date: '2026-10-07', clockIn: '07:55', clockOut: '15:57' },
  { id: 'ASIS-004', employeeId: 'EMP-001', date: '2026-10-08', clockIn: '08:01', clockOut: '16:00' },
  { id: 'ASIS-005', employeeId: 'EMP-002', date: '2026-10-05', clockIn: '09:03', clockOut: '17:02' },
  { id: 'ASIS-006', employeeId: 'EMP-002', date: '2026-10-06', clockIn: '08:57', clockOut: '17:06' },
  { id: 'ASIS-007', employeeId: 'EMP-002', date: '2026-10-08', clockIn: '09:00', clockOut: '17:01' },
  { id: 'ASIS-008', employeeId: 'EMP-002', date: '2026-10-09', clockIn: '09:06' },
  { id: 'ASIS-009', employeeId: 'EMP-003', date: '2026-10-05', clockIn: '07:52', clockOut: '16:00' },
  { id: 'ASIS-010', employeeId: 'EMP-003', date: '2026-10-07', clockIn: '08:01', clockOut: '16:04' },
  { id: 'ASIS-011', employeeId: 'EMP-003', date: '2026-10-08', clockIn: '07:59', clockOut: '16:02' },
  { id: 'ASIS-012', employeeId: 'EMP-003', date: '2026-10-09', clockIn: '08:03' },
  { id: 'ASIS-013', employeeId: 'EMP-004', date: '2026-10-05', clockIn: '06:27', clockOut: '14:31' },
  { id: 'ASIS-014', employeeId: 'EMP-004', date: '2026-10-06', clockIn: '06:35', clockOut: '14:28' },
  { id: 'ASIS-015', employeeId: 'EMP-004', date: '2026-10-08', clockIn: '06:29', clockOut: '14:34' },
  { id: 'ASIS-016', employeeId: 'EMP-005', date: '2026-10-06', clockIn: '06:58', clockOut: '15:03' },
  { id: 'ASIS-017', employeeId: 'EMP-005', date: '2026-10-07', clockIn: '07:04', clockOut: '15:01' },
  { id: 'ASIS-018', employeeId: 'EMP-005', date: '2026-10-08', clockIn: '06:56', clockOut: '15:00' },
  { id: 'ASIS-019', employeeId: 'EMP-006', date: '2026-10-05', clockIn: '08:56', clockOut: '17:04' },
  { id: 'ASIS-020', employeeId: 'EMP-006', date: '2026-10-06', clockIn: '09:02', clockOut: '17:00' },
  { id: 'ASIS-021', employeeId: 'EMP-006', date: '2026-10-07', clockIn: '08:59', clockOut: '17:03' },
  { id: 'ASIS-022', employeeId: 'EMP-006', date: '2026-10-08', clockIn: '09:01', clockOut: '17:02' },
]

export const staffRequests: StaffRequest[] = [
  { id: 'SOL-001', employeeId: 'EMP-001', type: 'Cambio de descanso', requestedDate: '2026-10-11', proposedDate: '2026-10-10', reason: 'Compromiso familiar el sábado.', status: 'Pendiente', createdAt: '2026-10-08 16:20' },
  { id: 'SOL-002', employeeId: 'EMP-004', type: 'Día libre sin goce', requestedDate: '2026-10-12', reason: 'Trámite personal fuera de la isla.', status: 'Pendiente', createdAt: '2026-10-09 10:15' },
  { id: 'SOL-003', employeeId: 'EMP-002', type: 'Cambio de descanso', requestedDate: '2026-10-07', proposedDate: '2026-10-11', reason: 'Cita médica.', status: 'Aprobada', createdAt: '2026-10-03 13:05', reviewedBy: 'Gerencia' },
]

export const cashMovements: CashMovement[] = [
  { id: 'MOV-20261007-001', date: '2026-10-07', time: '08:42', type: 'Entrada', amount: 1500, paymentMethod: 'Efectivo', area: 'Reservas', category: 'Pago de reserva', description: 'Abono de Ana Torres', status: 'Registrado', createdBy: 'Recepción', reservationId: 'CB-84621' },
  { id: 'MOV-20261007-002', date: '2026-10-07', time: '09:18', type: 'Salida', amount: 840, paymentMethod: 'Efectivo', area: 'Restaurante', category: 'Compra de inventario', description: 'Compra de insumos para desayunos', status: 'Registrado', createdBy: 'Recepción', purchaseId: 'COMP-20261007-001', purchaseItems: [{ product: 'Huevo', quantity: 12, unit: 'Piezas', total: 420 }, { product: 'Fruta', quantity: 8, unit: 'Kilogramos', total: 420 }] },
  { id: 'MOV-20261007-003', date: '2026-10-07', time: '10:06', type: 'Entrada', amount: 1000, paymentMethod: 'Tarjeta', area: 'Reservas', category: 'Pago de reserva', description: 'Abono de Carlos Medina', status: 'Registrado', createdBy: 'Recepción', reservationId: 'CB-84351' },
  { id: 'MOV-20261007-004', date: '2026-10-07', time: '10:31', type: 'Entrada', amount: 620, paymentMethod: 'Efectivo', area: 'Restaurante', category: 'Venta de restaurante', description: 'Consumos de huéspedes', status: 'Registrado', createdBy: 'Recepción' },
  { id: 'MOV-20261007-005', date: '2026-10-07', time: '11:24', type: 'Salida', amount: 1200, paymentMethod: 'Transferencia', area: 'Lavandería', category: 'Lavandería', description: 'Servicio semanal de blancos', status: 'Registrado', createdBy: 'Administración', purchaseId: 'COMP-20261007-002' },
  { id: 'MOV-20261006-009', date: '2026-10-06', time: '17:40', type: 'Salida', amount: 450, paymentMethod: 'Efectivo', area: 'Mantenimiento', category: 'Mantenimiento', description: 'Material para reparación de cerradura', status: 'Registrado', createdBy: 'Gerencia', purchaseId: 'COMP-20261006-003' },
]

export const cashDays: CashDay[] = [
  { date: '2026-10-06', openingCash: 3500, countedCash: 4280 },
  { date: '2026-10-07', openingCash: 4280 },
]

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
