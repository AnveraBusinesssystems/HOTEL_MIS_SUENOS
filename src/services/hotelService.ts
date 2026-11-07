import { emptyDashboard } from '../data/emptyData'
import type { DashboardData } from '../types'
import { indicatorsService } from './indicatorsService'
import { rmsService } from './rmsService'
import { operationService } from './operationService'
import { reservationsService } from './reservationsService'
import { cashService } from './cashService'
import { tourPaymentsService } from './tourPaymentsService'
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

  getCash(refresh = false) { return cashService.get(refresh) },
  recordTourPayment(...args: Parameters<typeof tourPaymentsService.payment>) {
    return tourPaymentsService.payment(...args)
  },
  updateTourStatus(...args: Parameters<typeof tourPaymentsService.updateStatus>) {
    return tourPaymentsService.updateStatus(...args)
  },
  createCashMovement(movement: Parameters<typeof cashService.create>[0], movementId: string) {
    return cashService.create(movement, movementId)
  },
  annulCashMovement(movementId: string, reason: string) { return cashService.annul(movementId, reason) },
  saveCashDay(date: string, fields: { openingCash?: number; countedCash?: number }) { return cashService.saveDay(date, fields) },
  closeCashDay(date: string, note: string, acceptDifference = false) { return cashService.closeDay(date, note, acceptDifference) },

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

  recordReservationPayment(reservationKey: string, amount: number, method: 'Efectivo' | 'Tarjeta' | 'Transferencia', paymentId: string, category: 'Pago de reserva' | 'Anticipo de reserva' = 'Pago de reserva') {
    return reservationsService.payment(reservationKey, amount, method, paymentId, category)
  },

  updateReservation(reservationKey: string, changes: Partial<DashboardData['reservations'][number]>) {
    return reservationsService.update(reservationKey, changes)
  },
}
