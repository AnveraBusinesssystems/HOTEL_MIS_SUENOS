import { apiClient } from './apiClient'
import type { CashPaymentMethod, TourStatus } from '../types'
export type TourPaymentKind = 'Cobro huésped' | 'Pago proveedor' | 'Pago recepción' | 'Pago hotel'
export const tourPaymentsService = {
  payment: (tourId: string, kind: TourPaymentKind, amount: number, method: CashPaymentMethod, eventId: string) =>
    apiClient.post<{tourId:string;eventId:string;duplicate:boolean}>('tour.payment', {tourId,kind,amount,method,eventId}),
  updateStatus: (tourId:string, status:TourStatus) =>
    apiClient.post<{tourId:string;status:TourStatus}>('tour.update',{tourId,status}),
}
