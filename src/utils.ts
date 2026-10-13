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

const divide = (numerator: number, denominator: number) => denominator ? numerator / denominator : 0

export const monthlyMetrics = (row: MonthlySummary) => ({
  occupancy: divide(row.soldNights, row.availableNights) * 100,
  adr: divide(row.revenue, row.soldNights),
  revpar: divide(row.revenue, row.availableNights),
  stay: divide(row.soldNights, row.bookings),
  cancellationRate: divide(row.cancellations, row.bookings + row.cancellations) * 100,
  operatingResult: row.revenue - row.costs,
  margin: divide(row.revenue - row.costs, row.revenue) * 100,
})

export const toneForOccupancy = (occupancy: number) => occupancy >= 90
  ? 'hot' : occupancy >= 76 ? 'high' : occupancy < 45 ? 'low' : 'normal'
