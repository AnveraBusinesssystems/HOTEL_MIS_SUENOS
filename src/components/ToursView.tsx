import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Banknote, CheckCircle2, Clock3, HandCoins, MapPinned,
  Plus, ReceiptText, Users, X,
} from 'lucide-react'
import type { CashMovement, CashPaymentMethod, Reservation, Role, TourBooking } from '../types'
import { longDate, money, shortDate } from '../utils'

type Props = {
  role: Role
  date: string
  tours: TourBooking[]
  reservations: Reservation[]
  cashMovements: CashMovement[]
  onToursChange: (updater: (rows: TourBooking[]) => TourBooking[]) => void
  onCashMovementsChange: (updater: (rows: CashMovement[]) => CashMovement[]) => void
  onTourPayment: (tourId: string, kind: 'Cobro huésped' | 'Pago proveedor' | 'Pago recepción' | 'Pago hotel', amount: number, method: CashPaymentMethod, eventId: string) => Promise<boolean>
  onTourStatus: (tourId: string, status: TourBooking['status']) => Promise<boolean>
  onNotify: (message: string) => void
}

type TourDraft = {
  reservationId: string
  guestName: string
  tourType: string
  provider: string
  serviceDate: string
  serviceTime: string
  people: string
  salePrice: string
  providerAmount: string
  notes: string
}

type MoneyAction = { type: 'Cobrar' | 'Liquidar' | 'Comisión'; tour: TourBooking }

const methods: CashPaymentMethod[] = ['Efectivo', 'Tarjeta', 'Transferencia']
const tourTypes = ['Tres Islas', 'Bioluminiscencia', 'Tiburón ballena', 'Pesca', 'Cabo Catoche', 'Transporte marítimo', 'Otro']
const providers = ['Holbox Tours', 'VIP Holbox', 'Tours El Chino', 'Otro proveedor']
const hotelDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const hotelTime = () => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Cancun', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
const TODAY = hotelDate()
const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
const commission = (tour: TourBooking) => Math.max(0, tour.salePrice - tour.providerAmount)
const hotelShare = (tour: TourBooking) => commission(tour) * .4
const receptionShare = (tour: TourBooking) => commission(tour) * .6
const activeReservation = (reservation: Reservation) => !['Cancelada', 'No show'].includes(reservation.status)

const freshDraft = (date: string): TourDraft => ({
  reservationId: '', guestName: '', tourType: 'Tres Islas', provider: 'Holbox Tours',
  serviceDate: date, serviceTime: '09:00', people: '2', salePrice: '', providerAmount: '', notes: '',
})

export function ToursView({
  role, date, tours, reservations, cashMovements,
  onToursChange, onCashMovementsChange, onTourPayment, onTourStatus, onNotify,
}: Props) {
  // Cobros y estados de tours existentes están conectados. Crear tours sigue
  // pendiente porque el origen no conserva proveedor, hora ni participantes.
  const toursWriteConnected = true
  const toursCreateConnected = false
  const [draft, setDraft] = useState<TourDraft | null>(null)
  const [action, setAction] = useState<MoneyAction | null>(null)
  const [method, setMethod] = useState<CashPaymentMethod>('Efectivo')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const retryPayment = useRef<{ key: string; id: string } | null>(null)

  const scheduled = tours.filter(tour => tour.serviceDate === date && tour.status !== 'Cancelado')
    .sort((left, right) => left.serviceTime.localeCompare(right.serviceTime))
  const activeTours = tours.filter(tour => tour.status !== 'Cancelado')
  const unpaid = activeTours.filter(tour => (tour.guestDue ?? 0) > 0)
  const providerPending = activeTours.filter(tour => tour.status === 'Realizado' && (tour.providerDue ?? 0) > 0)
  const commissionPending = activeTours.filter(tour => tour.status === 'Realizado' && tour.providerSettlementStatus === 'Liquidado' &&
    (tour.collectedBy === 'Hotel' ? (tour.receptionDue ?? 0) > 0 : (tour.hotelDue ?? 0) > 0))
  const canSettle = ['Dueño', 'Gerencia', 'Administración'].includes(role)

  const tourKind = (tour: TourBooking, type: MoneyAction['type']) => type === 'Cobrar' ? 'Cobro huésped' as const
    : type === 'Liquidar' ? 'Pago proveedor' as const : tour.collectedBy === 'Hotel' ? 'Pago recepción' as const : 'Pago hotel' as const
  const tourAmount = (tour: TourBooking, type: MoneyAction['type']) => type === 'Cobrar' ? (tour.guestDue ?? 0)
    : type === 'Liquidar' ? (tour.providerDue ?? 0) : tour.collectedBy === 'Hotel' ? (tour.receptionDue ?? 0) : (tour.hotelDue ?? 0)

  const pendingItems = useMemo(() => [
    ...unpaid.map(tour => ({ key: `pay-${tour.id}`, type: 'Cobro' as const, tour, amount: tour.guestDue ?? 0, label: 'Cobrar huésped', overdue: tour.serviceDate < TODAY })),
    ...providerPending.map(tour => ({ key: `provider-${tour.id}`, type: 'Proveedor' as const, tour, amount: tour.providerDue ?? 0, label: 'Liquidar proveedor', overdue: Boolean(tour.settlementDueDate) && tour.settlementDueDate <= TODAY })),
    ...commissionPending.map(tour => ({ key: `commission-${tour.id}`, type: 'Comisión' as const, tour, amount: tourAmount(tour,'Comisión'), label: tour.collectedBy === 'Hotel' ? 'Pagar recepción' : 'Pagar hotel', overdue: false })),
  ].sort((left, right) => Number(right.overdue) - Number(left.overdue) || left.tour.serviceDate.localeCompare(right.tour.serviceDate)), [unpaid, providerPending, commissionPending])

  const selectReservation = (reservationId: string) => {
    const reservation = reservations.find(row => row.id === reservationId)
    setDraft(current => current ? { ...current, reservationId, guestName: reservation?.guestName ?? '' } : current)
  }

  const saveTour = () => {
    if (!draft) return
    const salePrice = Number(draft.salePrice)
    const providerAmount = Number(draft.providerAmount)
    const people = Number(draft.people)
    if (!draft.guestName.trim()) { setError('Selecciona una reserva o escribe el nombre del cliente.'); return }
    if (!draft.serviceDate || !draft.serviceTime) { setError('Indica la fecha y hora del tour.'); return }
    if (!Number.isFinite(people) || people < 1) { setError('Indica una cantidad válida de personas.'); return }
    if (!Number.isFinite(salePrice) || salePrice <= 0 || !Number.isFinite(providerAmount) || providerAmount < 0) { setError('Revisa el precio de venta y el monto del proveedor.'); return }
    if (providerAmount > salePrice) { setError('El monto del proveedor no puede superar el precio cobrado.'); return }
    const stamp = draft.serviceDate.replaceAll('-', '')
    const sameDay = tours.filter(tour => tour.serviceDate === draft.serviceDate).length + 1
    const newTour: TourBooking = {
      id: `TOUR-${stamp}-${String(sameDay).padStart(3, '0')}`,
      reservationId: draft.reservationId || undefined,
      guestName: draft.guestName.trim(), tourType: draft.tourType, provider: draft.provider,
      serviceDate: draft.serviceDate, serviceTime: draft.serviceTime, people, salePrice, providerAmount,
      status: 'Agendado', paymentStatus: 'Pendiente', providerSettlementStatus: 'Pendiente', receptionCommissionStatus: 'Pendiente',
      settlementDueDate: addDays(draft.serviceDate, 4), createdAt: `${TODAY} ${hotelTime()}`, createdBy: role,
      notes: draft.notes.trim() || undefined,
    }
    onToursChange(rows => [...rows, newTour])
    setDraft(null)
    onNotify(`${newTour.tourType} agendado para ${newTour.guestName}`)
  }

  const confirmMoneyAction = async () => {
    if (!action || saving) return
    const kind = tourKind(action.tour,action.type)
    const amount = tourAmount(action.tour,action.type)
    if (!amount || amount<=0) {setError('No hay saldo confirmado para liquidar.');return}
    const key=JSON.stringify({tourId:action.tour.id,kind,amount,method})
    const id=retryPayment.current?.key===key ? retryPayment.current.id : 'HMS-TOUR-'+crypto.randomUUID()
    retryPayment.current={key,id}
    setSaving(true)
    try {
      await onTourPayment(action.tour.id,kind,amount,method,id)
      retryPayment.current=null
      setAction(null)
      setError('')
      onNotify(`${kind} · ${money(amount)} registrado en Caja y PAGOS_TOURS`)
    } catch(error) {
      console.warn('Pago de tour sin confirmación',error)
      setError('No se confirmó el movimiento. Usa el mismo identificador al reintentar; si persiste, concilia Caja y Tours.')
    } finally {setSaving(false)}
  }

  const markCompleted = async (tour: TourBooking) => {
    if(saving)return
    setSaving(true)
    try {await onTourStatus(tour.id,'Realizado');onNotify('Tour marcado como realizado en Google Sheets')}
    catch(error){console.warn(error);onNotify('No se guardó el estado del tour')}
    finally {setSaving(false)}
  }

  const cancelTour = async (tour: TourBooking) => {
    if(saving)return
    if((tour.guestDue ?? 0)<tour.salePrice) {
      onNotify('Tour con cobros registrados; requiere primero una conciliación de reembolso')
      return
    }
    setSaving(true)
    try {await onTourStatus(tour.id,'Cancelado');onNotify('Tour cancelado en Google Sheets')}
    catch(error){console.warn(error);onNotify('No se confirmó la cancelación')}
    finally {setSaving(false)}
  }

  const openAction = (type: MoneyAction['type'], tour: TourBooking) => { setMethod('Efectivo'); setError('');retryPayment.current=null;setAction({ type, tour }) }
  const hasTourData = tours.length > 0 || cashMovements.length > 0

  return <section className="tour-workspace">
    <section className="tour-summary">
      <article><span><MapPinned size={14}/> Tours del día</span><strong>{hasTourData ? scheduled.length : '—'}</strong><small>{hasTourData ? scheduled.some(tour => tour.people > 0) ? `${scheduled.reduce((sum, tour) => sum + tour.people, 0)} personas registradas` : 'Participantes sin registro' : 'Sin datos'}</small></article>
      <article><span><ReceiptText size={14}/> Por cobrar</span><strong>{hasTourData ? money(unpaid.reduce((sum, tour) => sum + (tour.guestDue ?? 0), 0)) : '—'}</strong><small>{hasTourData ? `${unpaid.length} tour${unpaid.length === 1 ? '' : 's'}` : 'Sin datos'}</small></article>
      <article><span><Banknote size={14}/> A proveedores</span><strong>{hasTourData ? money(providerPending.reduce((sum, tour) => sum + (tour.providerDue ?? 0), 0)) : '—'}</strong><small>{hasTourData ? `${providerPending.length} liquidación${providerPending.length === 1 ? '' : 'es'}` : 'Sin datos'}</small></article>
      <article><span><HandCoins size={14}/> Participación pendiente</span><strong>{hasTourData ? money(commissionPending.reduce((sum, tour) => sum + tourAmount(tour,'Comisión'), 0)) : '—'}</strong><small>{hasTourData ? 'Pendiente de entregar' : 'Sin datos'}</small></article>
    </section>

    <div className="tour-layout">
      <article className="panel tour-agenda">
        <header><div><span>AGENDA DE TOURS</span><h2>{longDate(date)}</h2></div><button className="primary-action" disabled={!toursCreateConnected} title="Agendar tours requiere integrar proveedor, horario y participantes" onClick={() => { setError(''); setDraft(freshDraft(date)) }}><Plus size={14}/>Agendar tour</button></header>
        <div className="tour-table-wrap"><table className="tour-table"><thead><tr><th>Hora</th><th>Huésped / reserva</th><th>Tour</th><th>Personas</th><th>Importes</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{scheduled.map(tour => <tr key={tour.id}>
          <td><b>{tour.serviceTime || '—'}</b></td>
          <td><b>{tour.guestName}</b><small>{tour.reservationId ?? 'Cliente externo'}</small></td>
          <td><b>{tour.tourType}</b><small>{tour.provider || 'Proveedor sin registrar'}</small></td>
          <td><span className="tour-people"><Users size={13}/>{tour.people > 0 ? tour.people : '—'}</span></td>
          <td><b>{money(tour.salePrice)}</b><small>Proveedor {money(tour.providerAmount)}</small></td>
          <td><span className={`tour-badge ${tour.status.toLowerCase()}`}>{tour.status}</span><span className={`tour-badge ${tour.paymentStatus.toLowerCase()}`}>{tour.paymentStatus}</span></td>
          <td><div className="tour-row-actions">{(tour.paymentStatus === 'Pendiente' || tour.paymentStatus === 'Parcial') && (tour.guestDue ?? 0)>0 && <button disabled={!toursWriteConnected || saving} onClick={() => openAction('Cobrar', tour)}>Cobrar</button>}{tour.status === 'Agendado' && <button disabled={!toursWriteConnected || saving} onClick={() => void markCompleted(tour)}>Realizado</button>}{tour.status === 'Agendado' && (tour.guestDue ?? 0)===tour.salePrice && <button className="muted" disabled={!toursWriteConnected || saving} onClick={() => void cancelTour(tour)}>Cancelar</button>}</div></td>
        </tr>)}</tbody></table>{!scheduled.length && <div className="tour-empty"><MapPinned size={24}/><b>Sin tours en esta fecha</b><span>Agenda uno nuevo o selecciona otro día.</span></div>}</div>
      </article>

      <aside className="panel tour-pending">
        <header><div><span>DINERO PENDIENTE</span><h2>{pendingItems.length} acciones</h2></div>{pendingItems.some(item => item.overdue) && <b className="overdue-count">VENCIDAS</b>}</header>
        <div>{pendingItems.slice(0, 8).map(item => <section key={item.key} className={item.overdue ? 'overdue' : ''}>
          <div><span>{item.overdue && <AlertTriangle size={12}/>} {item.type} · {shortDate(item.tour.serviceDate)}</span><b>{item.tour.guestName}</b><small>{item.tour.tourType} · {item.tour.provider}</small></div>
          <strong>{money(item.amount)}</strong>
          <button disabled={!toursWriteConnected || saving || (item.type !== 'Cobro' && !canSettle)} onClick={() => openAction(item.type === 'Cobro' ? 'Cobrar' : item.type === 'Proveedor' ? 'Liquidar' : 'Comisión', item.tour)}>{item.label}</button>
        </section>)}{!pendingItems.length && <div className="tour-all-clear"><CheckCircle2 size={22}/><b>Todo liquidado</b><span>No hay cobros ni pagos pendientes.</span></div>}</div>
      </aside>
    </div>

    {draft && <div className="dialog-backdrop" role="presentation"><section className="tour-dialog" role="dialog" aria-modal="true" aria-label="Agendar tour">
      <header><div><span>NUEVA ACTIVIDAD</span><h2>Agendar tour</h2><p>Registra una sola vez; cobros y liquidaciones se enlazarán a este folio.</p></div><button onClick={() => setDraft(null)} aria-label="Cerrar"><X size={18}/></button></header>
      <div className="tour-form">
        <label className="full"><span>Reserva (opcional)</span><select value={draft.reservationId} onChange={event => selectReservation(event.target.value)}><option value="">Cliente externo / sin reserva</option>{reservations.filter(activeReservation).map(reservation => <option key={reservation.id} value={reservation.id}>{reservation.id} · {reservation.guestName}</option>)}</select></label>
        <label className="full"><span>Nombre del huésped o cliente</span><input value={draft.guestName} onChange={event => setDraft({ ...draft, guestName: event.target.value })}/></label>
        <label><span>Tour</span><select value={draft.tourType} onChange={event => setDraft({ ...draft, tourType: event.target.value })}>{tourTypes.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>Proveedor</span><select value={draft.provider} onChange={event => setDraft({ ...draft, provider: event.target.value })}>{providers.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>Fecha</span><input type="date" value={draft.serviceDate} onChange={event => setDraft({ ...draft, serviceDate: event.target.value })}/></label>
        <label><span>Hora</span><input type="time" value={draft.serviceTime} onChange={event => setDraft({ ...draft, serviceTime: event.target.value })}/></label>
        <label><span>Personas</span><input type="number" min="1" value={draft.people} onChange={event => setDraft({ ...draft, people: event.target.value })}/></label>
        <div className="tour-auto-date"><Clock3 size={14}/><span>Liquidación prevista</span><b>{draft.serviceDate ? shortDate(addDays(draft.serviceDate, 4)) : '—'}</b></div>
        <label><span>Precio al huésped</span><div className="tour-money-input"><i>$</i><input type="number" min="0" value={draft.salePrice} onChange={event => setDraft({ ...draft, salePrice: event.target.value })}/></div></label>
        <label><span>Monto del proveedor</span><div className="tour-money-input"><i>$</i><input type="number" min="0" value={draft.providerAmount} onChange={event => setDraft({ ...draft, providerAmount: event.target.value })}/></div></label>
        <div className="tour-split full"><span><small>Comisión total</small><b>{money(Math.max(0, Number(draft.salePrice) - Number(draft.providerAmount)))}</b></span><span><small>Hotel · 40%</small><b>{money(Math.max(0, Number(draft.salePrice) - Number(draft.providerAmount)) * .4)}</b></span><span><small>Recepción · 60%</small><b>{money(Math.max(0, Number(draft.salePrice) - Number(draft.providerAmount)) * .6)}</b></span></div>
        <label className="full"><span>Nota breve (opcional)</span><textarea value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })}/></label>
        {error && <div className="tour-form-error full"><AlertTriangle size={14}/>{error}</div>}
      </div>
      <footer><button onClick={() => setDraft(null)}>Cancelar</button><button className="primary-action" disabled={!toursCreateConnected} onClick={saveTour}>Guardar tour</button></footer>
    </section></div>}

    {action && <div className="dialog-backdrop" role="presentation"><section className="tour-action-dialog" role="dialog" aria-modal="true" aria-label={action.type}>
      <header><div><span>{action.tour.id}</span><h2>{action.type === 'Cobrar' ? 'Cobrar al huésped' : action.type === 'Liquidar' ? 'Liquidar al proveedor' : 'Entregar comisión'}</h2><p>{action.tour.tourType} · {action.tour.guestName}</p></div><button onClick={() => setAction(null)} aria-label="Cerrar"><X size={18}/></button></header>
      <div className="tour-action-body"><span>Monto del movimiento</span><strong>{money(tourAmount(action.tour,action.type))}</strong><label><span>Método de pago</span><select value={method} onChange={event => setMethod(event.target.value as CashPaymentMethod)}>{methods.map(item => <option key={item}>{item}</option>)}</select></label><p>Se generará automáticamente un movimiento enlazado en Caja. El historial del tour conservará quién y cuándo lo registró.</p></div>
      {error && <div className="tour-form-error"><AlertTriangle size={14}/>{error}</div>}
      <footer><button disabled={saving} onClick={() => setAction(null)}>Cancelar</button><button className="primary-action" disabled={!toursWriteConnected || saving || tourAmount(action.tour,action.type)<=0} onClick={() => void confirmMoneyAction()}>{saving ? 'Guardando…' : 'Confirmar movimiento'}</button></footer>
    </section></div>}
  </section>
}

