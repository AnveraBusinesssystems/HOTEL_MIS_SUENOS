import { apiClient } from './apiClient'
import type { DashboardData, StaffMember, StaffRequest, StaffScheduleEntry } from '../types'

/**
 * Prepared transport for Personal. NOT invoked by the UI until a server-side
 * authenticated identity replaces the current demo login.
 * All responses come from HMS_IW / Staff.gs, never from localStorage.
 */
export type StaffSnapshot = Pick<DashboardData,
  'staff' | 'staffSchedules' | 'staffTimeEntries' | 'staffRequests' | 'userAccounts'> & {
  generatedAt: string
}

export const staffService = {
  isConfigured: apiClient.isConfigured,

  get(startDate: string, endDate: string, refresh = false) {
    return apiClient.post<StaffSnapshot>('staff.get', { startDate, endDate, refresh })
  },

  saveEmployee(employee: Partial<StaffMember> & {
    name: string
    role: StaffMember['role']
    payType?: 'Por hora' | 'Por día' | 'Semanal' | 'Quincenal' | 'Mensual'
    baseSalary?: number
    weeklyHours?: number
    email?: string
    phone?: string
  }) {
    return apiClient.post<{ employee: StaffMember }>('staff.employee.save', { employee })
  },

  setEmployeeStatus(employeeId: string, status: 'Activo' | 'Inactivo') {
    return apiClient.post<{ employeeId: string; status: string }>('staff.employee.status', { employeeId, status })
  },

  saveSchedules(entries: StaffScheduleEntry[]) {
    return apiClient.post<{ saved: number; created: number }>('staff.schedule.save', { entries })
  },

  deleteSchedule(employeeId: string, date: string) {
    return apiClient.post<{ deleted: boolean }>('staff.schedule.delete', { employeeId, date })
  },

  createRequest(request: StaffRequest) {
    return apiClient.post<{ request: StaffRequest }>('staff.request.create', { request })
  },

  reviewRequest(requestId: string, status: 'Aprobada' | 'Rechazada', note = '') {
    return apiClient.post<{ request: StaffRequest }>('staff.request.review', { requestId, status, note })
  },

  punch(employeeId: string, kind: 'in' | 'out') {
    return apiClient.post<{ entry: DashboardData['staffTimeEntries'][number] }>('staff.attendance.punch', { employeeId, kind })
  },
}
