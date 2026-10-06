import { useMemo, useState } from 'react'
import {
  AlertTriangle, BedDouble, CheckCircle2, ChevronRight, CircleDollarSign,
  Cloud, LogIn, LogOut, Search, Sparkles, UserRound, X,
} from 'lucide-react'
import type { Reservation, ReservationStatus, RoomCode } from '../types'
import { longDate, money, shortDate } from '../utils'

const TODAY = '2026-10-06'
const ACTIVE_STATUSES: ReservationStatus[] = ['Confirmada', 'Hospedado']
const ROOMS: Record<RoomCode, string[]> = {
  NAY: ['NAY-01'],
  "NA'": ["NA'-01", "NA'-02", "NA'-03"],
  CHA: ['CHA-01', 'CHA-02', 'CHA-03', 'CHA-04', 'CHA-05', 'CHA-06'],
  KAA: ['KAA-01', 'KAA-02'],
  MUU: ['MUU-01', 'MUU-02', 'MUU-03', 'MUU-04', 'MUU-05'],
}

type Props = {
  reservations: Reservation[]
  onChange: (updater: (rows: Reservation[]) => Reservation[]) => void
  onNotify: (message: string) => void
}

const paymentState = (reservation: Reservation) => reservation.paid <= 0
  ? 'Pendiente' : reservation.paid >= reservation.total ? 'Pagada' : 'Parcial'

const nights = (reservation: Reservation) => Math.max(1, Math.round((new Date(`${reservation.checkOut}T12:00:00`).getTime() - new Date(`${reservation.checkIn}T12:00:00`).getTime()) / 86400000))

export function ReservationsView({ reservations, onChange, onNotify }: Props) {
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'Todas' | ReservationStatus>('Todas')
  const [roomType, setRoomType] = useState<'Todas' | RoomCode>('Todas')
  const [payment, setPayment] = useState<'Todos' | 'Pagada' | 'Parcial' | 'Pendiente'>('Todos')
  const [from, setFrom] = useState(TODAY)
  const [to, setTo] = useState('2026-10-20')
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('06 oct · 08:03')

  const filtered = useMemo(() => reservations.filter(reservation => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery = !normalizedQuery || [reservation.id, reservation.guestName, reservation.roomNumber ?? '', reservation.phone].some(value => value.toLowerCase().includes(normalizedQuery))
    const overlapsRange = reservation.checkOut >= from && reservation.checkIn <= to
    return matchesQuery && overlapsRange && (status === 'Todas' || reservation.status === status) && (roomType === 'Todas' || reservation.roomType === roomType) && (payment === 'Todos' || paymentState(reservation) === payment)
  }), [from, payment, query, reservations, roomType, status, to])

  const selected = reservations.find(reservation => reservation.id === selectedId)
  const arrivals = reservations.filter(row => row.checkIn === TODAY && row.status === 'Confirmada').length
  const departures = reservations.filter(row => row.checkOut === TODAY && row.status === 'Hospedado').length
  const inHouse = reservations.filter(row => row.status === 'Hospedado').length
  const future = reservations.filter(row => row.checkIn > TODAY && row.status === 'Confirmada').length
  const balance = reservations.filter(row => ACTIVE_STATUSES.includes(row.status)).reduce((sum, row) => sum + Math.max(0, row.total - row.paid), 0)
  const attention = reservations.filter(row => ACTIVE_STATUSES.includes(row.status) && (!row.roomNumber || row.total > row.paid)).length

  const sync = () => {
    setSyncing(true)
    window.setTimeout(() => {
      setSyncing(false)
      setLastSync(new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace('.', ''))
      onNotify('Simulación: reservaciones sincronizadas con Cloudbeds')
    }, 800)
  }

  const updateReservation = (id: string, changes: Partial<Reservation>, message: string) => {
    onChange(rows => rows.map(row => row.id === id ? { ...row, ...changes } : row))
    onNotify(`Simulación: ${message}. Aún no se envió a Cloudbeds`)
  }

  return <div className="page reservations-page">
    <section className="page-heading reservation-heading">
      <div><p className="eyebrow">OPERACIÓN DE HOSPEDAJE</p><h1>Reservas</h1><p>Llegadas, salidas, asignación y saldos desde una sola vista.</p></div>
      <div className="sync-cluster"><div><span>Última sincronización</span><b>{lastSync}</b><small>Cloudbeds · Simulación</small></div><button className="cloudbeds-action" onClick={sync} disabled={syncing}><Cloud size={15}/>{syncing ? 'Sincronizando…' : 'Sincronizar Cloudbeds'}</button></div>
    </section>

    <section className="reservation-summary">
      <article><span><LogIn size={14}/> Llegadas hoy</span><strong>{arrivals}</strong><small>{arrivals ? 'Revisar habitación y saldo' : 'Sin llegadas pendientes'}</small></article>
      <article><span><LogOut size={14}/> Salidas hoy</span><strong>{departures}</strong><small>Check-out antes de 11:00</small></article>
      <article><span><UserRound size={14}/> Hospedados</span><strong>{inHouse}</strong><small>Actualmente en el hotel</small></article>
      <article><span><BedDouble size={14}/> Próximas</span><strong>{future}</strong><small>Después de hoy</small></article>
      <article className={balance > 0 ? 'summary-warning' : ''}><span><CircleDollarSign size={14}/> Saldo pendiente</span><strong>{money(balance)}</strong><small>{attention} reservas requieren atención</small></article>
    </section>

    <section className="reservation-toolbar">
      <label className="reservation-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Huésped, folio, habitación o teléfono"/></label>
      <label>Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
      <label>Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
      <label>Estado<select value={status} onChange={event => setStatus(event.target.value as 'Todas' | ReservationStatus)}><option>Todas</option><option>Confirmada</option><option>Hospedado</option><option>Salida</option><option>Cancelada</option><option>No show</option></select></label>
      <label>Tipo<select value={roomType} onChange={event => setRoomType(event.target.value as 'Todas' | RoomCode)}><option>Todas</option><option>NAY</option><option>NA'</option><option>CHA</option><option>KAA</option><option>MUU</option></select></label>
      <label>Pago<select value={payment} onChange={event => setPayment(event.target.value as typeof payment)}><option>Todos</option><option>Pagada</option><option>Parcial</option><option>Pendiente</option></select></label>
    </section>

    <section className="panel reservations-table-panel">
      <header><div><span>RESERVAS EN EL PERIODO</span><h2>{filtered.length} resultados</h2></div><span className="simulation-label">DATOS SIMULADOS</span></header>
      <div className="table-scroll"><table className="reservations-table">
        <thead><tr><th>Reserva</th><th>Huésped</th><th>Estancia</th><th>Habitación</th><th>Personas</th><th>Estado</th><th>Canal</th><th>Total</th><th>Saldo</th><th>Pago</th><th/></tr></thead>
        <tbody>{filtered.map(reservation => {
          const due = Math.max(0, reservation.total - reservation.paid)
          const paymentLabel = paymentState(reservation)
          return <tr key={reservation.subReservationId} className={!reservation.roomNumber && ACTIVE_STATUSES.includes(reservation.status) ? 'row-attention' : ''} onClick={() => setSelectedId(reservation.id)}>
            <td><b>{reservation.id}</b><small>{reservation.subReservationId}</small></td>
            <td><b>{reservation.guestName}</b><small>{reservation.phone}</small></td>
            <td><b>{shortDate(reservation.checkIn)} → {shortDate(reservation.checkOut)}</b><small>{nights(reservation)} noches</small></td>
            <td><b>{reservation.roomNumber ?? 'Sin asignar'}</b><small>{reservation.roomType}</small></td>
            <td>{reservation.adults + reservation.children}<small>{reservation.adults} ad. · {reservation.children} men.</small></td>
            <td><span className={`reservation-status ${reservation.status.toLowerCase().replace(' ', '-')}`}>{reservation.status}</span></td>
            <td>{reservation.channel}</td><td>{money(reservation.total)}</td><td className={due > 0 ? 'negative' : ''}>{money(due)}</td>
            <td><span className={`payment-status ${paymentLabel.toLowerCase()}`}>{paymentLabel}</span></td><td><button className="row-open" aria-label={`Abrir ${reservation.id}`}><ChevronRight size={16}/></button></td>
          </tr>
        })}</tbody>
      </table>{!filtered.length && <div className="empty-reservations"><Search size={22}/><b>No encontramos reservaciones</b><span>Prueba otro rango o elimina algunos filtros.</span></div>}</div>
    </section>

    {selected && <ReservationDrawer reservation={selected} onClose={() => setSelectedId(undefined)} onUpdate={updateReservation} onNotify={onNotify}/>} 
  </div>
}

function ReservationDrawer({ reservation, onClose, onUpdate, onNotify }: { reservation: Reservation; onClose: () => void; onUpdate: (id: string, changes: Partial<Reservation>, message: string) => void; onNotify: (message: string) => void }) {
  const [room, setRoom] = useState(reservation.roomNumber ?? '')
  const [paymentAmount, setPaymentAmount] = useState('')
  const due = Math.max(0, reservation.total - reservation.paid)
  const requestedPayment = Number(paymentAmount)
  const canPay = requestedPayment > 0 && requestedPayment <= due
  const adr = reservation.nights.length ? reservation.nights.reduce((sum, night) => sum + night.rate, 0) / reservation.nights.length : 0

  return <div className="drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="drawer reservation-drawer">
      <header><div><span>RESERVA · {reservation.id}</span><h2>{reservation.guestName}</h2><p>{reservation.channel} · creada {shortDate(reservation.createdAt)}</p></div><button onClick={onClose} aria-label="Cerrar"><X size={18}/></button></header>
      <div className="reservation-alerts">
        {!reservation.roomNumber && <div className="reservation-alert warning"><AlertTriangle size={15}/><span>La llegada todavía no tiene habitación asignada.</span></div>}
        {due > 0 && <div className="reservation-alert"><CircleDollarSign size={15}/><span>Saldo pendiente de {money(due)}.</span></div>}
        {reservation.cleaningRequested && <div className="reservation-alert cleaning"><Sparkles size={15}/><span>El huésped solicitó limpieza.</span></div>}
      </div>

      <section className="drawer-section"><span className="drawer-label">ESTANCIA</span><div className="reservation-stay"><div><small>Check-in</small><b>{longDate(reservation.checkIn)}</b><em>15:00</em></div><div><small>Check-out</small><b>{longDate(reservation.checkOut)}</b><em>11:00</em></div></div><div className="reservation-facts"><div><small>Noches</small><b>{nights(reservation)}</b></div><div><small>Huéspedes</small><b>{reservation.adults + reservation.children}</b></div><div><small>Tipo</small><b>{reservation.roomType}</b></div><div><small>ADR</small><b>{money(adr)}</b></div></div></section>

      <section className="drawer-section"><span className="drawer-label">HABITACIÓN</span><div className="room-assignment"><select value={room} onChange={event => setRoom(event.target.value)}><option value="">Sin asignar</option>{ROOMS[reservation.roomType].map(item => <option key={item}>{item}</option>)}</select><button disabled={room === (reservation.roomNumber ?? '')} onClick={() => onUpdate(reservation.id, { roomNumber: room || undefined }, room ? `habitación asignada: ${room}` : 'habitación desasignada')}>Guardar asignación</button></div><small className="field-help">En la integración real se validará disponibilidad antes de enviar el cambio.</small></section>

      <section className="drawer-section"><span className="drawer-label">HUÉSPED</span><div className="guest-contact"><b>{reservation.email}</b><span>{reservation.phone}</span></div>{reservation.notes && <p className="reservation-notes">{reservation.notes}</p>}</section>

      <section className="drawer-section"><span className="drawer-label">PAGO</span><div className="payment-balance"><div><small>Total</small><b>{money(reservation.total)}</b></div><div><small>Pagado</small><b>{money(reservation.paid)}</b></div><div><small>Saldo</small><b className={due > 0 ? 'negative' : 'positive'}>{money(due)}</b></div></div>{due > 0 && <div className="payment-entry"><span>$</span><input type="number" min="1" max={due} value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} placeholder="Cantidad"/><select aria-label="Método de pago"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select><button disabled={!canPay} onClick={() => { onUpdate(reservation.id, { paid: reservation.paid + requestedPayment }, `pago de ${money(requestedPayment)} registrado`); setPaymentAmount('') }}>Registrar</button></div>}</section>

      <section className="drawer-section"><span className="drawer-label">TARIFA POR NOCHE</span><div className="nightly-rates">{reservation.nights.map(night => <div key={night.date}><span>{shortDate(night.date)}</span><b>{money(night.rate)}</b></div>)}</div></section>

      <footer className="reservation-actions"><button onClick={() => onUpdate(reservation.id, { cleaningRequested: !reservation.cleaningRequested }, reservation.cleaningRequested ? 'solicitud de limpieza retirada' : 'limpieza solicitada') }><Sparkles size={14}/>{reservation.cleaningRequested ? 'Retirar limpieza' : 'Solicitar limpieza'}</button>{reservation.status === 'Confirmada' && <button className="primary-action" onClick={() => onUpdate(reservation.id, { status: 'Hospedado' }, 'check-in confirmado')}><CheckCircle2 size={14}/>Confirmar check-in</button>}{reservation.status === 'Hospedado' && <button className="primary-action" onClick={() => onUpdate(reservation.id, { status: 'Salida' }, 'salida confirmada')}><LogOut size={14}/>Confirmar salida</button>}<button onClick={() => onNotify('Vista simulada: el enlace directo a Cloudbeds se activará con la API')}>Abrir en Cloudbeds</button></footer>
    </aside>
  </div>
}
