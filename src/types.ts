export type Role = 'Dueño' | 'Gerencia' | 'Administración' | 'Recepción' | 'Cocina' | 'Limpieza' | 'Alberca'

export type RoomCode = 'NAY' | "NA'" | 'CHA' | 'KAA' | 'MUU'
export type RateMetric = 'recommendedRate' | 'currentRate' | 'difference' | 'occupancy'

export interface HotelSnapshot {
  revenue: number
  soldNights: number
  availableNights: number
  bookings: number
}

export interface KPI {
  id: string
  label: string
  value: number
  previous: number
  format: 'mxn' | 'percent' | 'integer' | 'decimal'
  helper: string
  comparisonMode?: 'relative' | 'points'
}

export interface DailyPerformance {
  date: string
  ingresos: number
  ocupacion: number
}

export interface RoomPerformance {
  code: RoomCode
  name: string
  rooms: number
  occupancy: number
  adr: number
  revpar: number
  currentRate: number
}

export interface RoomTypeConfig {
  code: RoomCode
  name: string
  rooms: number
  baseRate: number
  minRate: number
  maxRate: number
}

export interface RMSRecommendation {
  id: string
  date: string
  roomCode: RoomCode
  roomName: string
  capacity: number
  occupied: number
  available: number
  occupancy: number
  currentRate: number
  recommendedRate: number
  pickup7: number
  demand: 'Baja' | 'Normal' | 'Alta' | 'Muy alta'
  reason: string
}

export interface RateDay {
  date: string
  occupancy: number
  occupied: number
  available: number
}

export interface MonthlySummary {
  key: string
  year: number
  month: number
  label: string
  revenue: number
  soldNights: number
  availableNights: number
  bookings: number
  cancellations: number
  costs: number
  forecastRevenue: number
  forecastOccupancy: number
}

export type ExpenseCategory = 'Personal' | 'Lavandería' | 'Cocina' | 'Mantenimiento' | 'Servicios' | 'Comisiones' | 'Otros'

export interface ExpenseRecord {
  key: string
  year: number
  month: number
  category: ExpenseCategory
  amount: number
}

export interface RoomMonthlyPerformance {
  key: string
  year: number
  month: number
  code: RoomCode
  soldNights: number
  availableNights: number
  revenue: number
}

export type ReservationStatus = 'Confirmada' | 'Hospedado' | 'Salida' | 'Cancelada' | 'No show'
export type ReservationChannel = 'Directa' | 'Booking.com' | 'Expedia' | 'Cloudbeds' | 'Walk-in'

export interface ReservationNight {
  date: string
  rate: number
}

export interface Reservation {
  id: string
  subReservationId: string
  guestName: string
  email: string
  phone: string
  checkIn: string
  checkOut: string
  adults: number
  children: number
  roomType: RoomCode
  roomNumber?: string
  status: ReservationStatus
  channel: ReservationChannel
  total: number
  paid: number
  createdAt: string
  notes: string
  cleaningRequested: boolean
  nights: ReservationNight[]
}

export type OccupancyStatus = 'Libre' | 'Ocupada' | 'Salida prevista' | 'Bloqueada'
export type CleaningStatus = 'Limpia' | 'Sucia' | 'En limpieza' | 'Por revisar'
export type RoomAccessStatus = 'Normal' | 'No molestar' | 'Limpieza solicitada' | 'Acceso autorizado' | 'Intentar más tarde'
export type OperationTaskStatus = 'Pendiente' | 'En proceso' | 'Pausada' | 'Terminada'
export type OperationTaskType = 'Limpieza de salida' | 'Limpieza de estancia' | 'Limpieza general' | 'Reposición' | 'Revisión' | 'Mantenimiento'
export type RoomIssueType = 'Falta control de TV' | 'Falta control de A/C' | 'Luces no funcionan' | 'A/C no funciona bien' | 'No hay llaves' | 'Falta papel higiénico' | 'Faltan toallas' | 'Otro faltante o falla'

export interface RoomIssue {
  id: string
  type: RoomIssueType
  status: 'Pendiente' | 'Resuelto'
  reportedAt: string
  reportedBy: string
  taskId?: string
}

export interface RoomState {
  roomNumber: string
  roomType: RoomCode
  occupancy: OccupancyStatus
  cleaning: CleaningStatus
  currentReservationId?: string
  nextReservationId?: string
  blockReason?: string
  issues?: RoomIssue[]
  accessStatus?: RoomAccessStatus
  activityLog?: Array<{ id: string; action: string; by: string; at: string }>
}

export interface OperationTask {
  id: string
  date: string
  roomNumber: string
  roomType: RoomCode
  type: OperationTaskType
  status: OperationTaskStatus
  priority: 'Crítica' | 'Alta' | 'Normal'
  assignedTo?: string
  requestedAt: string
  startedAt?: string
  completedAt?: string
  deadline?: string
  note: string
  reservationId?: string
}

export interface OperationDay {
  date: string
  status: 'No iniciado' | 'Abierto' | 'Registrado'
  openedBy?: string
  openedAt?: string
}

export type CashMovementType = 'Entrada' | 'Salida'
export type CashPaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia'
export type CashArea = 'Reservas' | 'Recepción' | 'Restaurante' | 'Lavandería' | 'Limpieza' | 'Mantenimiento' | 'Administración' | 'Otros'
export type CashMovementCategory =
  | 'Pago de reserva' | 'Anticipo de reserva' | 'Venta de restaurante' | 'Otro ingreso'
  | 'Compra de inventario' | 'Mantenimiento' | 'Lavandería' | 'Servicios'
  | 'Reembolso' | 'Retiro de efectivo' | 'Gastos externos' | 'Otro gasto'

export interface CashPurchaseItem {
  product: string
  quantity: number
  total: number
}

export interface CashMovement {
  id: string
  date: string
  time: string
  type: CashMovementType
  amount: number
  paymentMethod: CashPaymentMethod
  area: CashArea
  category: CashMovementCategory
  description: string
  status: 'Registrado' | 'Anulado'
  createdBy: string
  reservationId?: string
  purchaseId?: string
  purchaseItems?: CashPurchaseItem[]
  annulledBy?: string
  annulledAt?: string
}

export interface CashDay {
  date: string
  openingCash: number
  countedCash?: number
}

export interface CostSummary {
  registered: number
  estimated: number
}

export interface Alert {
  id: string
  level: 'Informativa' | 'Advertencia' | 'Crítica'
  title: string
  date: string
  message: string
  recommendationId?: string
  estimatedImpact?: number
}

export interface DashboardData {
  performance: DailyPerformance[]
  roomPerformance: RoomPerformance[]
  rateDays: RateDay[]
  recommendations: RMSRecommendation[]
  monthly: MonthlySummary[]
  expenses: ExpenseRecord[]
  roomMonthly: RoomMonthlyPerformance[]
  reservations: Reservation[]
  roomStates: RoomState[]
  operationTasks: OperationTask[]
  operationDays: OperationDay[]
  cashMovements: CashMovement[]
  cashDays: CashDay[]
  costs: CostSummary
  alerts: Alert[]
  generatedAt: string
}
