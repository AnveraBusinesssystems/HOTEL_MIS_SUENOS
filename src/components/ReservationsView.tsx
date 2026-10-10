import { useMemo, useState } from 'react'
import {
  AlertTriangle, BedDouble, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDollarSign, Cloud, List, LogIn, LogOut, Search, Sparkles, UserRound, X,
} from 'lucide-react'
import type { Reservation, ReservationStatus, RoomCode } from '../types'
import { roomNumbers } from '../data/mockData'
import { longDate, money, shortDate } from '../utils'

const TODAY = '2026-10-06'
const ACTIVE_STATUSES: ReservationStatus[] = ['Confirmada', 'Hospedado']
type Props = {
  reservations: Reservation[]
  onChange: (updater: (rows: Reservation[]) => Reservation[]) => void
  onNotify: (message: string) => void
}

const paymentState = (reservation: Reservation) => reservation.paid <= 0
  ? 'Pendiente' : reservation.paid >= reservation.total ? 'Pagada' : 'Parcial'

const nights = (reservation: Reservation) => Math.max(1, Math.round((new Date(`${reservation.checkOut}T12:00:00`).getTime() - new Date(`${reservation.checkIn}T12:00:00`).getTime()) / 86400000))
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const shiftDate = (date: string, amount: number) => {
  const shifted = new Date(`${date}T12:00:00`)
  shifted.setDate(shifted.getDate() + amount)
  return isoDate(shifted)
}
const calendarLabel = (date: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)).replace('.', '').toUpperCase()

export function ReservationsView({ reservations, onChange, onNotify }: Props) {
  const [selectedId, setSelectedId] = useState<string>()
  const [view, setView] = useState<'Calendario' | 'Lista'>('Calendario')
  const [calendarStart, setCalendarStart] = useState(TODAY)
  const [calendarLength, setCalendarLength] = useState(14)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'Todas' | ReservationStatus>('Todas')
  const [roomType, setRoomType] = useState<'Todas' | RoomCode>('Todas')
  const [payment, setPayment] = useState<'Todos' | 'Pagada' | 'Parcial' | 'Pendiente'>('Todos')
  const [from, setFrom] = useState(TODAY)
  const [to, setTo] = useState('2026-10-20')
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('06 oct · 08:03')

  const baseFiltered = useMemo(() => reservations.filter(reservation => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery = !normalizedQuery || [reservation.id, reservation.guestName, reservation.roomNumber ?? '', reservation.phone].some(value => value.toLowerCase().includes(normalizedQuery))
    return matchesQuery && (status === 'Todas' || reservation.status === status) && (roomType === 'Todas' || reservation.roomType === roomType) && (payment === 'Todos' || paymentState(reservation) === payment)
  }), [payment, query, reservations, roomType, status])
  const filtered = useMemo(() => baseFiltered.filter(reservation => reservation.checkOut >= from && reservation.checkIn <= to), [baseFiltered, from, to])
  const calendarDates = useMemo(() => Array.from({ length: calendarLength }, (_, index) => shiftDate(calendarStart, index)), [calendarLength, calendarStart])
  const calendarReservations = useMemo(() => baseFiltered.filter(reservation => reservation.status !== 'Cancelada' && reservation.status !== 'No show' && reservation.checkOut > calendarDates[0] && reservation.checkIn < shiftDate(calendarDates.at(-1)!, 1)), [baseFiltered, calendarDates])

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

    <section className="reservation-viewbar">
      <div className="view-switch"><button className={view === 'Calendario' ? 'active' : ''} onClick={() => setView('Calendario')}><CalendarDays size={15}/> Calendario</button><button className={view === 'Lista' ? 'active' : ''} onClick={() => setView('Lista')}><List size={15}/> Lista</button></div>
      {view === 'Calendario' && <div className="calendar-navigation"><button onClick={() => setCalendarStart(shiftDate(calendarStart, -7))} aria-label="Semana anterior"><ChevronLeft size={15}/></button><button onClick={() => setCalendarStart(TODAY)}>Hoy</button><button onClick={() => setCalendarStart(shiftDate(calendarStart, 7))} aria-label="Semana siguiente"><ChevronRight size={15}/></button><strong>{shortDate(calendarDates[0])} — {shortDate(calendarDates.at(-1)!)}</strong><select aria-label="Días visibles" value={calendarLength} onChange={event => setCalendarLength(Number(event.target.value))}><option value="7">7 días</option><option value="14">14 días</option><option value="21">21 días</option></select></div>}
    </section>

    <section className={`reservation-toolbar ${view === 'Calendario' ? 'calendar-mode' : ''}`}>
      <label className="reservation-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Huésped, folio, habitación o teléfono"/></label>
      {view === 'Lista' && <><label>Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label></>}
      <label>Estado<select value={status} onChange={event => setStatus(event.target.value as 'Todas' | ReservationStatus)}><option>Todas</option><option>Confirmada</option><option>Hospedado</option><option>Salida</option><option>Cancelada</option><option>No show</option></select></label>
      <label>Tipo<select value={roomType} onChange={event => setRoomType(event.target.value as 'Todas' | RoomCode)}><option>Todas</option><option>NAY</option><option>NA'</option><option>CHA</option><option>KAA</option><option>MUU</option></select></label>
      <label>Pago<select value={payment} onChange={event => setPayment(event.target.value as typeof payment)}><option>Todos</option><option>Pagada</option><option>Parcial</option><option>Pendiente</option></select></label>
    </section>

    {view === 'Calendario' && <ReservationsCalendar dates={calendarDates} reservations={calendarReservations} roomType={roomType} onOpen={setSelectedId}/>}

    {view === 'Lista' && <section className="panel reservations-table-panel">
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
    </section>}

    {selected && <ReservationDrawer reservation={selected} onClose={() => setSelectedId(undefined)} onUpdate={updateReservation} onNotify={onNotify}/>} 
  </div>
}

function ReservationsCalendar({ dates, reservations, roomType, onOpen }: { dates: string[]; reservations: Reservation[]; roomType: 'Todas' | RoomCode; onOpen: (id: string) => void }) {
  const roomGroups = (Object.entries(roomNumbers) as [RoomCode, string[]][]).filter(([code]) => roomType === 'Todas' || roomType === code)
  const unassigned = reservations.filter(reservation => !reservation.roomNumber)
  const columns = `var(--calendar-room-column, 190px) repeat(${dates.length}, minmax(76px, 1fr))`
  const occupancy = (date: string) => new Set(reservations.filter(reservation => reservation.roomNumber && reservation.checkIn <= date && reservation.checkOut > date).map(reservation => reservation.roomNumber)).size

  return <section className="panel reservation-calendar-panel">
    <header><div><span>CALENDARIO DE HABITACIONES</span><h2>Ocupación y asignación</h2></div><div className="calendar-legend"><span><i className="confirmed"/>Confirmada</span><span><i className="in-house"/>Hospedado</span><span><i className="due"/>Saldo pendiente</span></div></header>
    <div className="reservation-calendar-scroll">
      <div className="calendar-date-row" style={{ gridTemplateColumns: columns, minWidth: `calc(var(--calendar-room-column, 190px) + ${dates.length * 76}px)` }}><div className="calendar-corner"><b>17 habitaciones</b><small>Hotel Mis Sueños</small></div>{dates.map(date => { const occupied = occupancy(date); return <div key={date} className={`calendar-date ${date === TODAY ? 'today' : ''}`}><b>{calendarLabel(date)}</b><span>{Math.round(occupied / 17 * 100)}% ocup.</span><small>{reservations.filter(row => row.checkIn === date).length} lleg. · {reservations.filter(row => row.checkOut === date).length} sal.</small></div> })}</div>
      {unassigned.length > 0 && <><div className="calendar-group unassigned-group"><b>Sin habitación asignada</b><span>{unassigned.length} pendientes</span></div><CalendarRoomRow label="Por asignar" dates={dates} reservations={unassigned} columns={columns} onOpen={onOpen}/></>}
      {roomGroups.map(([code, rooms]) => <div key={code} className="calendar-room-group"><div className="calendar-group"><b>{code} · {code === 'NAY' ? 'Suite' : code === "NA'" ? 'Familiar' : code === 'CHA' ? 'King' : code === 'KAA' ? 'Queen económica' : 'Queen balcón'}</b><span>{rooms.length} {rooms.length === 1 ? 'habitación' : 'habitaciones'}</span></div>{rooms.map(room => <CalendarRoomRow key={room} label={room} dates={dates} reservations={reservations.filter(reservation => reservation.roomNumber === room)} columns={columns} onOpen={onOpen}/>)}</div>)}
    </div>
    <footer className="calendar-help">Haz clic en una reservación para abrir su detalle. Las cancelaciones no ocupan espacio en el calendario.</footer>
  </section>
}

function CalendarRoomRow({ label, dates, reservations, columns, onOpen }: { label: string; dates: string[]; reservations: Reservation[]; columns: string; onOpen: (id: string) => void }) {
  const afterLastDay = shiftDate(dates.at(-1)!, 1)
  return <div className="calendar-room-row" style={{ gridTemplateColumns: columns, minWidth: `calc(var(--calendar-room-column, 190px) + ${dates.length * 76}px)` }}>
    <div className="calendar-room-label"><BedDouble size={13}/><b>{label}</b></div>
    {dates.map(date => <div key={date} className={`calendar-day-cell ${date === TODAY ? 'today' : ''}`}/>) }
    {reservations.map(reservation => {
      const visibleStart = reservation.checkIn < dates[0] ? dates[0] : reservation.checkIn
      const visibleEnd = reservation.checkOut > afterLastDay ? afterLastDay : reservation.checkOut
      const startIndex = dates.findIndex(date => date >= visibleStart)
      const endIndex = visibleEnd === afterLastDay ? dates.length : dates.findIndex(date => date >= visibleEnd)
      if (startIndex < 0 || endIndex <= startIndex) return null
      const due = reservation.total > reservation.paid
      return <button key={reservation.subReservationId} className={`calendar-reservation ${reservation.status.toLowerCase().replace(' ', '-')} ${due ? 'has-balance' : ''}`} style={{ gridColumn: `${startIndex + 2} / ${endIndex + 2}` }} onClick={() => onOpen(reservation.id)} title={`${reservation.guestName} · ${reservation.id}`}><span>{reservation.guestName}</span>{due && <i title="Saldo pendiente"/>}{reservation.cleaningRequested && <Sparkles size={11}/>}</button>
    })}
  </div>
}

function ReservationDrawer({ reservation, onClose, onUpdate, onNotify }: { reservation: Reservation; onClose: () => void; onUpdate: (id: string, changes: Partial<Reservation>, message: string) => void; onNotify: (message: string) => void }) {
  const [room, setRoom] = useState(reservation.roomNumber ?? '')
  const [paymentAmount, setPaymentAmount] = useState('')
  const due = Math.max(0, reservation.total - reservation.paid)
  const requestedPayment = Number(paymentAmount)
  const canPay = requestedPayment > 0 && requestedPayment <= due

  return <div className="drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="drawer reservation-drawer">
      <header><div><span>RESERVA · {reservation.id}</span><h2>{reservation.guestName}</h2><p>{reservation.channel} · creada {shortDate(reservation.createdAt)}</p></div><button onClick={onClose} aria-label="Cerrar"><X size={18}/></button></header>
      <div className="reservation-alerts">
        {!reservation.roomNumber && <div className="reservation-alert warning"><AlertTriangle size={15}/><span>La llegada todavía no tiene habitación asignada.</span></div>}
        {due > 0 && <div className="reservation-alert"><CircleDollarSign size={15}/><span>Saldo pendiente de {money(due)}.</span></div>}
        {reservation.cleaningRequested && <div className="reservation-alert cleaning"><Sparkles size={15}/><span>El huésped solicitó limpieza.</span></div>}
      </div>

      <section className="drawer-section"><span className="drawer-label">ESTANCIA</span><div className="reservation-stay"><div><small>Check-in</small><b>{longDate(reservation.checkIn)}</b><em>15:00</em></div><div><small>Check-out</small><b>{longDate(reservation.checkOut)}</b><em>11:00</em></div></div><div className="reservation-facts"><div><small>Noches</small><b>{nights(reservation)}</b></div><div><small>Huéspedes</small><b>{reservation.adults + reservation.children}</b></div><div><small>Tipo</small><b>{reservation.roomType}</b></div><div><small>Canal</small><b>{reservation.channel}</b></div></div></section>

      <section className="drawer-section"><span className="drawer-label">HABITACIÓN</span><div className="room-assignment"><select value={room} onChange={event => setRoom(event.target.value)}><option value="">Sin asignar</option>{roomNumbers[reservation.roomType].map(item => <option key={item}>{item}</option>)}</select><button disabled={room === (reservation.roomNumber ?? '')} onClick={() => onUpdate(reservation.id, { roomNumber: room || undefined }, room ? `habitación asignada: ${room}` : 'habitación desasignada')}>Guardar asignación</button></div><small className="field-help">En la integración real se validará disponibilidad antes de enviar el cambio.</small></section>

      <section className="drawer-section"><span className="drawer-label">HUÉSPED</span><div className="guest-contact"><b>{reservation.email}</b><span>{reservation.phone}</span></div>{reservation.notes && <p className="reservation-notes">{reservation.notes}</p>}</section>

      <section className="drawer-section"><span className="drawer-label">PAGO</span><div className="payment-balance"><div><small>Total</small><b>{money(reservation.total)}</b></div><div><small>Pagado</small><b>{money(reservation.paid)}</b></div><div><small>Saldo</small><b className={due > 0 ? 'negative' : 'positive'}>{money(due)}</b></div></div>{due > 0 && <div className="payment-entry"><span>$</span><input type="number" min="1" max={due} value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} placeholder="Cantidad"/><select aria-label="Método de pago"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select><button disabled={!canPay} onClick={() => { onUpdate(reservation.id, { paid: reservation.paid + requestedPayment }, `pago de ${money(requestedPayment)} registrado`); setPaymentAmount('') }}>Registrar</button></div>}</section>

      <footer className="reservation-actions"><button onClick={() => onUpdate(reservation.id, { cleaningRequested: !reservation.cleaningRequested }, reservation.cleaningRequested ? 'solicitud de limpieza retirada' : 'limpieza solicitada') }><Sparkles size={14}/>{reservation.cleaningRequested ? 'Retirar limpieza' : 'Solicitar limpieza'}</button>{reservation.status === 'Confirmada' && <button className="primary-action" onClick={() => onUpdate(reservation.id, { status: 'Hospedado' }, 'check-in confirmado')}><CheckCircle2 size={14}/>Confirmar check-in</button>}{reservation.status === 'Hospedado' && <button className="primary-action" onClick={() => onUpdate(reservation.id, { status: 'Salida' }, 'salida confirmada')}><LogOut size={14}/>Confirmar salida</button>}<button onClick={() => onNotify('Vista simulada: el enlace directo a Cloudbeds se activará con la API')}>Abrir en Cloudbeds</button></footer>
    </aside>
  </div>
}
