import {
  aggregateRateDays, buildAlerts, costs, generateRecommendations,
  expenses, monthly, performance, reservations, roomMonthly, roomPerformance,
} from '../data/mockData'
import type { DashboardData } from '../types'

const delay = (ms = 220) => new Promise(resolve => setTimeout(resolve, ms))

export const hotelService = {
  async getDashboard(): Promise<DashboardData> {
    await delay()
    const recommendations = generateRecommendations()
    return {
      performance, roomPerformance,
      rateDays: aggregateRateDays(recommendations), recommendations,
      monthly, expenses, roomMonthly, reservations, costs,
      alerts: buildAlerts(recommendations), generatedAt: new Date().toISOString(),
    }
  },
}
