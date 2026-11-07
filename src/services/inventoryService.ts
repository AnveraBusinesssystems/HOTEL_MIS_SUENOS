import { apiClient } from './apiClient'
import type { InventoryItem } from '../types'

export interface MaintenanceChecklistItem {
  area: string
  item: string
  intervalDays: number
  description: string
}

export interface InventoryPayload {
  items: InventoryItem[]
  maintenanceItems: MaintenanceChecklistItem[]
  purchaseRequestsAvailable: boolean
  generatedAt: string
}

export interface InventoryCountChange {
  product: string
  previous: number
  counted: number
}

export const inventoryService = {
  get: (refresh = false) => apiClient.post<InventoryPayload>('inventory.get', { refresh }),
  count: (changes: InventoryCountChange[], countId: string) =>
    apiClient.post<{ countId: string; changed: number }>('inventory.count', {changes,countId}),
}
