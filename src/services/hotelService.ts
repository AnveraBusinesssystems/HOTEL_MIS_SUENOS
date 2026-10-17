import { emptyDashboard } from '../data/emptyData'
import type { DashboardData } from '../types'
import { summaryService } from './summaryService'

export const hotelService = {
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
}
