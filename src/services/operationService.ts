import type { CleaningHistory, OperationDay, OperationTask, RoomState } from '../types'
import { apiClient } from './apiClient'

export type OperationPayload = {
  roomStates: RoomState[]
  operationTasks: OperationTask[]
  operationDays: OperationDay[]
  cleaningHistory: CleaningHistory[]
  generatedAt: string
}

export type OperationEvent = {
  roomNumber: string
  actionType: 'Limpieza solicitada' | 'Marcar sucia' | 'Inició limpieza' | 'Terminó limpieza' |
    'Check confirmado' | 'Habitación aprobada' | 'Incidencia reportada' | 'Incidencia resuelta'
  worker: string
  work?: string
  note?: string
  eventId: string
}

export const operationService = {
  get: (refresh = false) => apiClient.post<OperationPayload>('operation.get', { refresh }),
  recordEvent: (event: OperationEvent) => apiClient.post<{ eventId: string; recorded: boolean; duplicate: boolean }>('operation.event', event),
}
