import { staffService } from './staffService'
import type { StaffMember, StaffRequest, StaffScheduleEntry, StaffTimeEntry } from '../types'

/**
 * Connected Personal contract. The React demo account is NOT an authenticated
 * backend identity: caller must keep mode=preview until a verified login exists.
 */
export type StaffPersistence = {
  mode: 'preview' | 'live'
  load: (start: string, end: string, refresh?: boolean) => Promise<void>
  saveEmployee: (employee: StaffMember) => Promise<StaffMember>
  changeStatus: (employeeId: string, status: StaffMember['status']) => Promise<void>
  saveSchedules: (entries: StaffScheduleEntry[]) => Promise<void>
  deleteSchedule: (employeeId: string, date: string) => Promise<void>
  createRequest: (request: StaffRequest) => Promise<StaffRequest>
  reviewRequest: (request: StaffRequest, decision: 'Aprobada' | 'Rechazada') => Promise<StaffRequest>
  punch: (employeeId: string, kind: 'in' | 'out') => Promise<StaffTimeEntry>
}

/** Server actions do not accept a browser-provided role as proof of privilege. */
export const staffBackend = {
  load: staffService.get,
  async saveEmployee(employee: StaffMember) {
    const response = await staffService.saveEmployee(employee)
    return response.employee
  },
  async changeStatus(employeeId: string, status: StaffMember['status']) {
    await staffService.setEmployeeStatus(employeeId, status)
  },
  async saveSchedules(entries: StaffScheduleEntry[]) {
    await staffService.saveSchedules(entries)
  },
  async deleteSchedule(employeeId: string, date: string) {
    await staffService.deleteSchedule(employeeId, date)
  },
  async createRequest(request: StaffRequest) {
    const result = await staffService.createRequest(request)
    return result.request
  },
  async reviewRequest(request: StaffRequest, decision: 'Aprobada' | 'Rechazada') {
    const result = await staffService.reviewRequest(request.id, decision)
    return result.request
  },
  async punch(employeeId: string, kind: 'in' | 'out') {
    const result = await staffService.punch(employeeId, kind)
    return result.entry
  },
}
