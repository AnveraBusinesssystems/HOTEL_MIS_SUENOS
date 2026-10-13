import { emptyDashboard } from '../data/emptyData'
import type { DashboardData } from '../types'

const delay = (ms = 220) => new Promise(resolve => setTimeout(resolve, ms))

export const hotelService = {
  async getDashboard(): Promise<DashboardData> {
    await delay()
    return emptyDashboard()
  },
}
