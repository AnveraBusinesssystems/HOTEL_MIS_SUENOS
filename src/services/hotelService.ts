import { alerts, kpis, performance, rateDays, roomPerformance } from '../data/mockData'

const delay = (ms = 180) => new Promise(resolve => setTimeout(resolve, ms))

export const hotelService = {
  async getDashboard() {
    await delay()
    return { kpis, performance, roomPerformance, rateDays, alerts }
  }
}