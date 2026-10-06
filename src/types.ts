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
  costs: CostSummary
  alerts: Alert[]
  generatedAt: string
}
