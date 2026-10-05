export type Role = 'Dueño' | 'Gerencia' | 'Administración' | 'Recepción' | 'Cocina' | 'Limpieza' | 'Alberca'

export interface KPI {
  id: string
  label: string
  value: number
  previous: number
  format: 'mxn' | 'percent' | 'integer' | 'decimal'
  helper: string
}

export interface DailyPerformance {
  date: string
  ingresos: number
  ocupacion: number
  adr: number
  revpar: number
}

export interface RoomPerformance {
  code: 'NAY' | "NA'" | 'CHA' | 'KAA' | 'MUU'
  name: string
  rooms: number
  soldNights: number
  occupancy: number
  adr: number
  revenue: number
  revpar: number
  currentRate: number
}

export interface RateDay {
  date: string
  occupancy: number
  available: number
  adr: number
  currentRate: number
  recommendedRate: number
  arrivals: number
  departures: number
  minStay: number
  status: 'Abierto' | 'Cerrado'
}

export interface Alert {
  id: string
  level: 'Informativa' | 'Advertencia' | 'Crítica'
  title: string
  date: string
  message: string
  action: string
}