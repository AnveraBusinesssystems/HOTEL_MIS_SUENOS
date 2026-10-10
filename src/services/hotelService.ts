import {
  aggregateRateDays, buildAlerts, cashDays, cashMovements, costs, generateRecommendations,
  expenses, monthly, operationDays, operationTasks, performance, reservations,
  roomMonthly, roomPerformance, roomStates, tours,
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
      monthly, expenses, roomMonthly, reservations, roomStates, operationTasks,
      operationDays, tours, cashMovements, cashDays, costs,
      alerts: buildAlerts(recommendations), generatedAt: new Date().toISOString(),
    }
  },
}
