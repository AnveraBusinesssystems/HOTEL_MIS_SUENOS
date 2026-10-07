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
export type OperationTaskStatus = 'Pendiente' | 'En proceso' | 'Pausada' | 'Terminada'
export type OperationTaskType = 'Limpieza de salida' | 'Limpieza de estancia' | 'Revisión' | 'Mantenimiento'

export interface RoomState {
  roomNumber: string
  roomType: RoomCode
  occupancy: OccupancyStatus
  cleaning: CleaningStatus
  currentReservationId?: string
  nextReservationId?: string
  blockReason?: string
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
  costs: CostSummary
  alerts: Alert[]
  generatedAt: string
}
