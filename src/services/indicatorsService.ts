import type { MonthlySummary, RoomMonthlyPerformance, RoomPerformance } from '../types'
import { apiClient } from './apiClient'

export type IndicatorsPayload = {
  roomPerformance: RoomPerformance[]
  roomMonthly: RoomMonthlyPerformance[]
  monthly?: MonthlySummary[]
  generatedAt: string
}

export const indicatorsService = {
  isConfigured: apiClient.isConfigured,
  get: (includeMonthly = false) => apiClient.post<IndicatorsPayload>('indicators.get', { includeMonthly }),
}
