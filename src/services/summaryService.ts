import type { DailyPerformance, MonthlySummary, RateDay } from '../types'
import { apiClient } from './apiClient'

export type SummaryPayload = {
  monthly: MonthlySummary[]
  performance: DailyPerformance[]
  rateDays: RateDay[]
  generatedAt: string
}

export const summaryService = {
  isConfigured: apiClient.isConfigured,
  get: () => apiClient.post<SummaryPayload>('summary.get'),
}
