import { apiClient } from './apiClient'
import type { RMSCalendarEntry } from '../types'

export type RmsPayload = {
  calendar: RMSCalendarEntry[]
  reservationsWithoutCategory: number
  generatedAt: string
}

export const rmsService = {
  get: (refresh = false) => apiClient.post<RmsPayload>('rms.get', { refresh }),
}
