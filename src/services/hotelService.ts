import { emptyDashboard } from '../data/emptyData'
import type { DashboardData } from '../types'
import { indicatorsService } from './indicatorsService'
import { rmsService } from './rmsService'
import { operationService } from './operationService'
import { reservationsService } from './reservationsService'
import { summaryService } from './summaryService'

export const hotelService = {
  isConfigured: summaryService.isConfigured,

  async getDashboard(): Promise<DashboardData> {
    const dashboard = emptyDashboard()
    if (!summaryService.isConfigured) return dashboard

    try {
      const summary = await summaryService.get()
      return { ...dashboard, ...summary }
    } catch (error) {
      console.warn('No fue posible cargar Resumen; se conserva el estado vacío.', error)
      return dashboard
    }
  },

  getIndicators(includeMonthly = false) {
    return indicatorsService.get(includeMonthly)
  },

  getOperation(refresh = false) {
    return operationService.get(refresh)
  },

  recordOperationEvent(event: Parameters<typeof operationService.recordEvent>[0]) {
    return operationService.recordEvent(event)
  },

  getRms(refresh = false) {
    return rmsService.get(refresh)
  },

  getReservations(refresh = false) {
    return reservationsService.get(refresh)
  },

  recordReservationPayment(reservationKey: string, amount: number, method: 'Efectivo' | 'Tarjeta' | 'Transferencia', paymentId: string) {
    return reservationsService.payment(reservationKey, amount, method, paymentId)
  },

  updateReservation(reservationKey: string, changes: Partial<DashboardData['reservations'][number]>) {
    return reservationsService.update(reservationKey, changes)
  },
}
