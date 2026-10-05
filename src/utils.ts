import type { KPI, MonthlySummary } from './types'

export const money = (value: number) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(value)

export const number = (value: number, digits = 2) => new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: digits,
}).format(value)

export const percent = (value: number, digits = 1) => `${number(value, digits)}%`

export const shortDate = (date: string) => new Intl.DateTimeFormat('es-MX', {
  day: '2-digit', month: 'short',
}).format(new Date(`${date}T12:00:00`)).replace('.', '').toUpperCase()

export const longDate = (date: string) => new Intl.DateTimeFormat('es-MX', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${date}T12:00:00`))

export const kpiValue = (kpi: KPI, value = kpi.value) => {
  if (kpi.format === 'mxn') return money(value)
  if (kpi.format === 'percent') return percent(value)
  return number(value)
}

export const monthlyMetrics = (row: MonthlySummary) => ({
  occupancy: row.soldNights / row.availableNights * 100,
  adr: row.revenue / row.soldNights,
  revpar: row.revenue / row.availableNights,
  stay: row.soldNights / row.bookings,
  cancellationRate: row.cancellations / (row.bookings + row.cancellations) * 100,
  operatingResult: row.revenue - row.costs,
  margin: (row.revenue - row.costs) / row.revenue * 100,
})

export const toneForOccupancy = (occupancy: number) => occupancy >= 90
  ? 'hot' : occupancy >= 76 ? 'high' : occupancy < 45 ? 'low' : 'normal'
