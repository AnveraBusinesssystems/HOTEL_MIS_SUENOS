import { apiClient } from './apiClient'
import type { CashDay, CashMovement, CashMovementCategory, CashMovementType, CashPaymentMethod } from '../types'

export type CashPayload = {
  cashMovements: CashMovement[]
  cashDays: CashDay[]
  generatedAt: string
}

export type CashNewMovement = {
  type: CashMovementType
  date: string
  amount: number
  paymentMethod: CashPaymentMethod
  category: CashMovementCategory
  description: string
}

export const cashService = {
  get: (refresh = false) => apiClient.post<CashPayload>('cash.get', { refresh }),
  create: (movement: CashNewMovement, movementId: string) =>
    apiClient.post<{ movementId: string; duplicate: boolean }>('cash.movement.create', { movement, movementId }),
  annul: (movementId: string, reason: string) =>
    apiClient.post<{ movementId: string; duplicate: boolean }>('cash.movement.annul', { movementId, reason }),
  saveDay: (date: string, fields: { openingCash?: number; countedCash?: number }) =>
    apiClient.post<{ date: string; saved: boolean }>('cash.day.save', { date, ...fields }),
}
