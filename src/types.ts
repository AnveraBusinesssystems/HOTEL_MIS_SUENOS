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

export type TourStatus = 'Agendado' | 'Realizado' | 'Cancelado'
export type TourPaymentStatus = 'Pendiente' | 'Pagado'
export type TourSettlementStatus = 'Pendiente' | 'Liquidado'
export type TourCommissionStatus = 'Pendiente' | 'Pagada'

export interface TourBooking {
  id: string
  reservationId?: string
  guestName: string
  tourType: string
  provider: string
  serviceDate: string
  serviceTime: string
  people: number
  salePrice: number
  providerAmount: number
  status: TourStatus
  paymentStatus: TourPaymentStatus
  paymentMethod?: CashPaymentMethod
  paidAt?: string
  providerSettlementStatus: TourSettlementStatus
  providerSettlementMethod?: CashPaymentMethod
  settledAt?: string
  receptionCommissionStatus: TourCommissionStatus
  receptionCommissionMethod?: CashPaymentMethod
  receptionCommissionPaidAt?: string
  settlementDueDate: string
  createdAt: string
  createdBy: string
  notes?: string
}

export type StaffRole = 'Gerencia' | 'Administración' | 'Recepción' | 'Cocina' | 'Limpieza' | 'Alberca'

export interface StaffMember {
  id: string
  name: string
  role: StaffRole
  weeklySalary: number
  defaultShiftStart: string
  defaultShiftEnd: string
  defaultRestDay: number
  status: 'Activo' | 'Inactivo'
}

export type SystemModule = 'Resumen' | 'Indicadores' | 'RMS / Tarifas' | 'Reservas' | 'Operación diaria' | 'Caja' | 'Inventario' | 'Personal'
export type AccessLevel = 'Sin acceso' | 'Ver' | 'Editar'

export interface UserAccount {
  id: string
  employeeId: string
  username: string
  role: Role
  status: 'Activo' | 'Inactivo'
  permissions: Record<SystemModule, AccessLevel>
}

export interface StaffScheduleEntry {
  employeeId: string
  date: string
  isRest: boolean
  unpaidLeave?: boolean
  shiftStart?: string
  shiftEnd?: string
}

export interface StaffTimeEntry {
  id: string
  employeeId: string
  date: string
  clockIn: string
  clockOut?: string
}

export type StaffRequestType = 'Cambio de descanso' | 'Día libre sin goce'

export interface StaffRequest {
  id: string
  employeeId: string
  type: StaffRequestType
  requestedDate: string
  proposedDate?: string
  reason: string
  status: 'Pendiente' | 'Aprobada' | 'Rechazada'
  createdAt: string
  reviewedBy?: string
}

export type CashMovementType = 'Entrada' | 'Salida'
export type CashPaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia'
export type CashArea = 'Reservas' | 'Recepción' | 'Restaurante' | 'Lavandería' | 'Limpieza' | 'Mantenimiento' | 'Administración' | 'Otros'
export type CashMovementCategory =
  | 'Pago de reserva' | 'Anticipo de reserva' | 'Venta de restaurante' | 'Otro ingreso'
  | 'Compra de inventario' | 'Mantenimiento' | 'Lavandería' | 'Servicios'
  | 'Reembolso' | 'Retiro de efectivo' | 'Gastos externos' | 'Otro gasto'
  | 'Cobro de tour' | 'Pago a proveedor de tour' | 'Comisión de tour a recepción'

export interface CashPurchaseItem {
  product: string
  quantity: number
  unit: string
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
  tourId?: string
  purchaseId?: string
  purchaseRequestId?: string
  purchaseItems?: CashPurchaseItem[]
  annulledBy?: string
  annulledAt?: string
}

export interface CashDay {
  date: string
  openingCash: number
  countedCash?: number
}

export type InventoryCategory = 'Alimentos' | 'Bebidas' | 'Limpieza' | 'Lavandería' | 'Amenidades' | 'Suministros'

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  unit: string
  stock: number
  parLevel: number
  suggestedPurchase: number
  lastUpdated: string
  lastPrice: number
}

export type PurchaseRequestStatus = 'Pendiente' | 'Tomada en cuenta' | 'Comprada' | 'Cancelada'

export interface PurchaseRequestItem {
  product: string
  quantity: number
  unit: string
  estimatedTotal: number
}

export interface PurchaseRequest {
  id: string
  createdAt: string
  createdBy: string
  status: PurchaseRequestStatus
  items: PurchaseRequestItem[]
  estimatedTotal: number
  acknowledgedBy?: string
  acknowledgedAt?: string
  purchasedBy?: string
  purchasedAt?: string
  cashMovementId?: string
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
  tours: TourBooking[]
  staff: StaffMember[]
  staffSchedules: StaffScheduleEntry[]
  staffTimeEntries: StaffTimeEntry[]
  staffRequests: StaffRequest[]
  userAccounts: UserAccount[]
  cashMovements: CashMovement[]
  cashDays: CashDay[]
  inventory: InventoryItem[]
  purchaseRequests: PurchaseRequest[]
  costs: CostSummary
  alerts: Alert[]
  generatedAt: string
}
