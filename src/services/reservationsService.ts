import type { Reservation } from '../types'
import { apiClient } from './apiClient'

export type ReservationsPayload = {
  reservations: Reservation[]
  generatedAt: string
}

export const reservationsService = {
  isConfigured: apiClient.isConfigured,
  get: (refresh = false) => apiClient.post<ReservationsPayload>('reservations.get', { refresh }),
  update: (reservationKey: string, changes: Partial<Reservation>) => {
    const serializedChanges = Object.prototype.hasOwnProperty.call(changes, 'roomNumber')
      ? { ...changes, roomNumber: changes.roomNumber ?? null }
      : changes
    return apiClient.post<Reservation>('reservations.update', { reservationKey, changes: serializedChanges })
  },
}
