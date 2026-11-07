import type { Reservation } from '../types'
import { apiClient } from './apiClient'

export type ReservationsPayload = {
  reservations: Reservation[]
  generatedAt: string
}

export const reservationsService = {
  isConfigured: apiClient.isConfigured,
  get: (refresh = false) => apiClient.post<ReservationsPayload>('reservations.get', { refresh }),
  payment: (reservationKey: string, amount: number, method: 'Efectivo' | 'Tarjeta' | 'Transferencia', paymentId: string) =>
    apiClient.post<Reservation>('reservations.payment', { reservationKey, amount, method, paymentId }),
  update: (reservationKey: string, changes: Partial<Reservation>) => {
    const serializedChanges = Object.prototype.hasOwnProperty.call(changes, 'roomNumber')
      ? { ...changes, roomNumber: changes.roomNumber ?? null }
      : changes
    return apiClient.post<Reservation>('reservations.update', { reservationKey, changes: serializedChanges })
  },
}
