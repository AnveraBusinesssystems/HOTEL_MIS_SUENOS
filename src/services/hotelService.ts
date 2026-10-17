import { emptyDashboard } from '../data/emptyData'
import type { DashboardData } from '../types'
import { indicatorsService } from './indicatorsService'
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

  getReservations(refresh = false) {
    return reservationsService.get(refresh)
  },

  updateReservation(reservationKey: string, changes: Partial<DashboardData['reservations'][number]>) {
    return reservationsService.update(reservationKey, changes)
  },
}
