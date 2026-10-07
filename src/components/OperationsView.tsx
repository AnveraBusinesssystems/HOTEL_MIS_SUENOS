import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, BedDouble, CalendarDays, CheckCircle2, Clock3, LogIn, LogOut,
  PackageOpen, Play, RefreshCw, Sparkles, UserRound, Wrench, X,
} from 'lucide-react'
import type {
  OperationDay, OperationTask, Reservation, Role, RoomAccessStatus, RoomIssueType, RoomState,
} from '../types'
import { longDate, number, shortDate } from '../utils'

const hotelDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}
const hotelTime = () => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Cancun', hour: '2-digit', minute: '2-digit' }).format(new Date())
const TODAY = hotelDate()
const completedNow = () => `${TODAY} · ${hotelTime()}`
const completionTime = (value?: string) => value?.includes(' · ') ? value.split(' · ')[1] : value

type OperationTab = 'Hoy' | 'Habitaciones' | 'Limpieza'
type CleaningQueue = 'Salidas' | 'Limpieza' | 'Check'
type PriorityItem = {
  id: string
  roomNumber?: string
  level: 'Crítica' | 'Alta' | 'Normal'
  title: string
  text: string
  action: string
  reservation?: Reservation
  task?: OperationTask
}
type CleaningWorkItem = {
  roomNumber: string
  roomType: OperationTask['roomType']
  tasks: OperationTask[]
  section: CleaningQueue
  priority: OperationTask['priority']
}
type OperationMetric = { label: string; value: string | number; detail: string; icon: React.ReactNode }

type Props = {
  role: Role
  reservations: Reservation[]
  rooms: RoomState[]
  tasks: OperationTask[]
  days: OperationDay[]
  onReservationsChange: (updater: (rows: Reservation[]) => Reservation[]) => void
  onRoomsChange: (updater: (rows: RoomState[]) => RoomState[]) => void
  onTasksChange: (updater: (rows: OperationTask[]) => OperationTask[]) => void
  onDaysChange: (updater: (rows: OperationDay[]) => OperationDay[]) => void
  onNotify: (message: string) => void
}

const occupiedOn = (reservation: Reservation, date: string) => !['Cancelada', 'No show'].includes(reservation.status) && reservation.checkIn <= date && reservation.checkOut > date
const hasPendingIssue = (room: RoomState) => room.issues?.some(issue => issue.status === 'Pendiente') ?? false
const roomIsReady = (room?: RoomState) => !!room && room.occupancy === 'Libre' && room.cleaning === 'Limpia' && !hasPendingIssue(room)
const readyLabel = (room: RoomState) => room.occupancy === 'Bloqueada' ? 'Bloqueada' : hasPendingIssue(room) ? 'Con incidencia' : roomIsReady(room) ? 'Lista' : room.cleaning
const roomTone = (room: RoomState) => room.occupancy === 'Bloqueada' ? 'blocked' : hasPendingIssue(room) ? 'review' : room.cleaning === 'Limpia' ? 'ready' : room.cleaning === 'Sucia' ? 'dirty' : room.cleaning === 'En limpieza' ? 'working' : 'review'
const roomAccess = (room?: RoomState) => !room ? 'Estado desconocido' : room.accessStatus && room.accessStatus !== 'Normal' ? room.accessStatus : room.occupancy === 'Libre' ? 'Disponible para entrar' : room.occupancy === 'Ocupada' ? 'Huésped dentro' : room.occupancy === 'Salida prevista' ? 'Salida pendiente' : 'No ingresar'
const roomAccessTone = (room?: RoomState) => !room || room.occupancy === 'Bloqueada' || room.accessStatus === 'No molestar' ? 'blocked' : room.occupancy === 'Libre' || room.accessStatus === 'Limpieza solicitada' || room.accessStatus === 'Acceso autorizado' ? 'available' : 'waiting'
const ROOM_ISSUE_OPTIONS: RoomIssueType[] = ['Falta control de TV', 'Falta control de A/C', 'Luces no funcionan', 'A/C no funciona bien', 'No hay llaves', 'Falta papel higiénico', 'Faltan toallas', 'Otro faltante o falla']
const QUICK_ROOM_CHECKS: Array<{ label: string; issue: RoomIssueType }> = [{ label: 'Toallas', issue: 'Faltan toallas' }, { label: 'Papel', issue: 'Falta papel higiénico' }, { label: 'Control TV', issue: 'Falta control de TV' }, { label: 'Control A/C', issue: 'Falta control de A/C' }, { label: 'Luces', issue: 'Luces no funcionan' }, { label: 'A/C', issue: 'A/C no funciona bien' }, { label: 'Llaves', issue: 'No hay llaves' }]
const CLEANING_TYPES: OperationTask['type'][] = ['Limpieza de salida', 'Limpieza de estancia', 'Limpieza general', 'Reposición']
const issueTaskMeta = (issue: RoomIssueType) => {
  const technical = issue === 'Luces no funcionan' || issue === 'A/C no funciona bien'
  return { type: (technical ? 'Mantenimiento' : 'Reposición') as OperationTask['type'], priority: (issue === 'No hay llaves' ? 'Crítica' : technical ? 'Alta' : 'Normal') as OperationTask['priority'], assignedTo: technical ? 'Gerencia' : 'Limpieza' }
}
const allowedTabsFor = (role: Role): OperationTab[] => role === 'Limpieza' ? ['Limpieza', 'Habitaciones'] : role === 'Recepción' ? ['Hoy', 'Habitaciones'] : ['Cocina', 'Alberca'].includes(role) ? ['Hoy'] : ['Hoy', 'Habitaciones', 'Limpieza']
const canUpdateOperation = (role: Role) => ['Dueño', 'Gerencia', 'Administración', 'Recepción'].includes(role)
const liveRoomsFrom = (rooms: RoomState[], reservations: Reservation[]) => rooms.map(room => {
  if (room.occupancy === 'Bloqueada') return room
  const current = reservations.find(reservation => reservation.roomNumber === room.roomNumber && reservation.status === 'Hospedado')
  const next = reservations.filter(reservation => reservation.roomNumber === room.roomNumber && reservation.status === 'Confirmada' && reservation.checkOut > TODAY).sort((left, right) => left.checkIn.localeCompare(right.checkIn))[0]
  return { ...room, occupancy: current ? current.checkOut <= TODAY ? 'Salida prevista' as const : 'Ocupada' as const : 'Libre' as const, currentReservationId: current?.id, nextReservationId: next?.id }
})

export function OperationsView(props: Props) {
  const { role, reservations, rooms, tasks, days, onReservationsChange, onRoomsChange, onTasksChange, onDaysChange, onNotify } = props
  const allowedTabs = allowedTabsFor(role)
  const [tab, setTab] = useState<OperationTab>(allowedTabs[0])
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [roomFilter, setRoomFilter] = useState<'Todas' | 'Atención' | 'Listas' | 'Ocupadas' | 'Bloqueadas'>('Atención')
  const dateStripRef = useRef<HTMLElement>(null)
  const liveRooms = useMemo(() => liveRoomsFrom(rooms, reservations), [rooms, reservations])

  useEffect(() => {
    const nextTabs = allowedTabsFor(role)
    if (!nextTabs.includes(tab)) setTab(nextTabs[0])
  }, [role, tab])
  useEffect(() => {
    const container = dateStripRef.current
    const active = container?.querySelector<HTMLElement>('button.active')
    if (container && active) container.scrollLeft = active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2
  }, [selectedDate])

  const isLiveDate = selectedDate === TODAY
  const selectedDay = days.find(day => day.date === selectedDate) ?? { date: selectedDate, status: 'No iniciado' as const }
  const arrivals = reservations.filter(row => row.status === 'Confirmada' && (isLiveDate ? row.checkIn <= selectedDate && row.checkOut > selectedDate : row.checkIn === selectedDate))
  const departures = reservations.filter(row => isLiveDate ? row.status === 'Hospedado' && row.checkOut <= selectedDate : ['Confirmada', 'Hospedado'].includes(row.status) && row.checkOut === selectedDate)
  const stays = reservations.filter(row => occupiedOn(row, selectedDate) && (isLiveDate ? row.status === 'Hospedado' : true))
  const selectedTasks = tasks.filter(task => isLiveDate ? task.date <= selectedDate && task.status !== 'Terminada' : task.date === selectedDate)
  const pendingTasks = selectedTasks.filter(task => task.status !== 'Terminada')
  const readyRooms = liveRooms.filter(roomIsReady)
  const attentionRooms = liveRooms.filter(room => room.occupancy === 'Bloqueada' || room.occupancy === 'Salida prevista' || room.cleaning !== 'Limpia' || hasPendingIssue(room))

  const dayStrip = useMemo(() => days.map(day => {
    const active = reservations.filter(row => !['Cancelada', 'No show'].includes(row.status))
    const dayArrivals = active.filter(row => row.checkIn === day.date).length
    const dayDepartures = active.filter(row => row.checkOut === day.date).length
    const occupied = active.filter(row => occupiedOn(row, day.date)).length
    return { ...day, arrivals: dayArrivals, departures: dayDepartures, occupancy: occupied / 17 * 100, cleaningLoad: dayDepartures }
  }), [days, reservations])

  const priorityCandidates: PriorityItem[] = [
    ...departures.map(reservation => ({ id: `exit-${reservation.id}`, roomNumber: reservation.roomNumber, level: 'Crítica' as const, title: `Confirmar salida · ${reservation.roomNumber}`, text: `${reservation.guestName}${reservation.checkOut < selectedDate ? ` tiene salida vencida desde ${shortDate(reservation.checkOut)}` : ' tiene salida programada hoy'}.`, action: 'Confirmar salida', reservation })),
    ...arrivals.filter(reservation => !reservation.roomNumber).map(reservation => ({ id: `assign-${reservation.id}`, level: 'Crítica' as const, title: 'Llegada sin habitación', text: `${reservation.guestName} ${reservation.checkIn < selectedDate ? `debía llegar el ${shortDate(reservation.checkIn)}` : 'llega hoy'} y todavía no tiene habitación.`, action: 'Abrir reserva', reservation })),
    ...arrivals.filter(reservation => reservation.roomNumber && !roomIsReady(liveRooms.find(room => room.roomNumber === reservation.roomNumber)!)).map(reservation => ({ id: `ready-${reservation.id}`, roomNumber: reservation.roomNumber, level: 'Alta' as const, title: `${reservation.roomNumber} no está lista`, text: `${reservation.guestName} ${reservation.checkIn < selectedDate ? `debía llegar el ${shortDate(reservation.checkIn)}` : 'llega hoy'}; la habitación requiere atención.`, action: 'Ver habitación', reservation })),
    ...pendingTasks.filter(task => task.priority !== 'Normal').map(task => ({ id: task.id, roomNumber: task.roomNumber, level: task.priority, title: `${task.type} · ${task.roomNumber}`, text: task.note, action: task.type === 'Revisión' ? 'Marcar lista' : 'Ver tarea', task })),
  ]
  const seenRooms = new Set<string>()
  const priorities = priorityCandidates.filter(item => !item.roomNumber || !seenRooms.has(item.roomNumber) && !!seenRooms.add(item.roomNumber)).slice(0, 7)

  const metrics: OperationMetric[] = isLiveDate ? [
    { label: 'Llegadas', value: arrivals.length, detail: `${arrivals.filter(row => !row.roomNumber).length} sin asignar`, icon: <LogIn size={14}/> },
    { label: 'Salidas pendientes', value: departures.length, detail: departures.some(row => row.checkOut < TODAY) ? 'Incluye salidas vencidas' : 'Por confirmar', icon: <LogOut size={14}/> },
    { label: 'Hospedados', value: stays.length, detail: 'En el hotel', icon: <UserRound size={14}/> },
    { label: 'Listas', value: readyRooms.length, detail: 'Libres y limpias', icon: <CheckCircle2 size={14}/> },
    { label: 'Atención', value: attentionRooms.length, detail: 'Limpieza, bloqueo o incidencia', icon: <AlertTriangle size={14}/> },
  ] : [
    { label: 'Llegadas', value: arrivals.length, detail: 'Programadas', icon: <LogIn size={14}/> },
    { label: 'Salidas', value: departures.length, detail: 'Programadas', icon: <LogOut size={14}/> },
    { label: 'Ocupadas', value: stays.length, detail: 'Noches proyectadas', icon: <UserRound size={14}/> },
    { label: 'Limpiezas', value: departures.length, detail: 'Carga prevista', icon: <Sparkles size={14}/> },
    { label: 'Disponibles', value: Math.max(0, 17 - stays.length), detail: 'Inventario estimado', icon: <BedDouble size={14}/> },
  ]

  const syncOperation = () => {
    const syncedAt = hotelTime()
    onDaysChange(rows => rows.some(day => day.date === TODAY) ? rows.map(day => day.date === TODAY ? { ...day, status: 'Abierto', openedBy: role, openedAt: syncedAt } : day) : [...rows, { date: TODAY, status: 'Abierto', openedBy: role, openedAt: syncedAt }])
    onNotify('Operación actualizada con la información más reciente de Cloudbeds')
  }
  const confirmDeparture = (reservation: Reservation) => {
    onReservationsChange(rows => rows.map(row => row.id === reservation.id ? { ...row, status: 'Salida' } : row))
    if (reservation.roomNumber) {
      const room = liveRooms.find(item => item.roomNumber === reservation.roomNumber)
      onRoomsChange(rows => rows.map(item => item.roomNumber === reservation.roomNumber ? { ...item, occupancy: 'Libre', cleaning: 'Sucia', currentReservationId: undefined, accessStatus: 'Normal' } : item))
      onTasksChange(rows => rows.some(task => task.date <= TODAY && task.roomNumber === reservation.roomNumber && CLEANING_TYPES.includes(task.type) && task.status !== 'Terminada') ? rows : [...rows, { id: `OP-${Date.now()}`, date: TODAY, roomNumber: reservation.roomNumber!, roomType: room?.roomType ?? reservation.roomType, type: 'Limpieza de salida', status: 'Pendiente', priority: 'Alta', assignedTo: 'Limpieza', requestedAt: hotelTime(), deadline: '15:00', note: 'Salida confirmada por recepción.', reservationId: reservation.id }])
    }
    onNotify(`Salida de ${reservation.guestName} confirmada; habitación enviada a limpieza`)
  }
  const markRoomReady = (roomNumber: string) => {
    const room = liveRooms.find(item => item.roomNumber === roomNumber)
    if (room?.issues?.some(issue => issue.status === 'Pendiente')) { onNotify(`${roomNumber} todavía tiene incidencias pendientes`); return }
    onRoomsChange(rows => rows.map(item => item.roomNumber === roomNumber ? { ...item, cleaning: 'Limpia' } : item))
    onTasksChange(rows => rows.map(task => task.date <= TODAY && task.roomNumber === roomNumber && task.type === 'Revisión' && task.status !== 'Terminada' ? { ...task, status: 'Terminada', completedAt: completedNow() } : task))
    onNotify(`${roomNumber} está lista para entregar`)
  }
  const runPriorityAction = (item: PriorityItem) => {
    if (!isLiveDate) return
    if (item.reservation && item.action === 'Confirmar salida') return confirmDeparture(item.reservation)
    if (item.task?.type === 'Revisión') return markRoomReady(item.task.roomNumber)
    if (item.reservation && !item.reservation.roomNumber) return onNotify(`Abre ${item.reservation.id} desde el módulo Reservas para asignar habitación`)
    if (item.roomNumber) { setTab(item.task && CLEANING_TYPES.includes(item.task.type) && allowedTabs.includes('Limpieza') ? 'Limpieza' : 'Habitaciones'); setSelectedDate(TODAY) }
  }
  const chooseTab = (next: OperationTab) => { setTab(next); if (next !== 'Hoy') setSelectedDate(TODAY) }

  return <div className="page operations-page">
    <section className="page-heading operation-heading"><div><p className="eyebrow">CENTRO DE CONTROL</p><h1>Operación</h1><p>Una sola vista para coordinar recepción, habitaciones y limpieza.</p></div><div className={`operation-day-state ${isLiveDate && selectedDay.status === 'Abierto' ? 'abierto' : ''}`}><span>{isLiveDate ? 'SINCRONIZACIÓN CLOUDBEDS' : selectedDate < TODAY ? 'CONSULTA HISTÓRICA' : 'PLANIFICACIÓN'}</span><strong>{isLiveDate ? selectedDay.status === 'Abierto' ? 'Actualizado' : 'Pendiente' : longDate(selectedDate)}</strong><small>{isLiveDate && selectedDay.openedAt ? `${selectedDay.openedBy} · ${selectedDay.openedAt}` : isLiveDate ? 'Recepción debe actualizar la operación' : 'Vista informativa · sin cambios operativos'}</small></div></section>

    {tab === 'Hoy' && <section className="operation-date-strip" ref={dateStripRef}>{dayStrip.map(day => <button key={day.date} className={`${day.date === selectedDate ? 'active' : ''} ${day.date === TODAY ? 'today' : ''}`} onClick={() => setSelectedDate(day.date)}><span>{shortDate(day.date)}</span><b>{number(day.occupancy, 0)}%</b><small>{day.arrivals} lleg. · {day.departures} sal.</small><em>{day.cleaningLoad} limp.</em></button>)}</section>}

    <section className="operation-controls"><div className="operation-tabs">{allowedTabs.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => chooseTab(item)}>{item === 'Hoy' ? <CalendarDays size={15}/> : item === 'Habitaciones' ? <BedDouble size={15}/> : <Sparkles size={15}/>} {item === 'Hoy' ? 'Control de hoy' : item}</button>)}</div><div className="day-actions">{tab === 'Hoy' && !isLiveDate && <button onClick={() => setSelectedDate(TODAY)}><CalendarDays size={14}/>Volver a hoy</button>}{tab === 'Hoy' && isLiveDate && canUpdateOperation(role) && <button className="primary-action" onClick={syncOperation}><RefreshCw size={14}/>{selectedDay.status === 'Abierto' ? 'Actualizar operación' : 'Iniciar operación'}</button>}</div></section>

    {tab === 'Hoy' && <TodayView date={selectedDate} isLive={isLiveDate} metrics={metrics} arrivals={arrivals} departures={departures} stays={stays} priorities={priorities} onPriority={runPriorityAction}/>}
    {tab === 'Habitaciones' && <RoomsView role={role} rooms={liveRooms} reservations={reservations} tasks={tasks} filter={roomFilter} setFilter={setRoomFilter} onRoomsChange={onRoomsChange} onTasksChange={onTasksChange} onOpenCleaning={() => chooseTab('Limpieza')} onNotify={onNotify}/>}
    {tab === 'Limpieza' && <CleaningView role={role} tasks={tasks.filter(task => task.date === TODAY || task.date < TODAY && (task.status !== 'Terminada' || task.completedAt?.startsWith(TODAY)))} rooms={liveRooms} reservations={reservations} onTasksChange={onTasksChange} onRoomsChange={onRoomsChange} onNotify={onNotify}/>}
  </div>
}

function TodayView({ date, isLive, metrics, arrivals, departures, stays, priorities, onPriority }: { date: string; isLive: boolean; metrics: OperationMetric[]; arrivals: Reservation[]; departures: Reservation[]; stays: Reservation[]; priorities: PriorityItem[]; onPriority: (item: PriorityItem) => void }) {
  return <section className="operation-section">
    <div className="operation-summary">{metrics.map(metric => <article key={metric.label}><span>{metric.icon}{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}</div>
    <div className="operation-main-grid">
      <article className="panel priority-panel"><header><div><span>{isLive ? 'QUÉ SIGUE' : 'PUNTOS DE ATENCIÓN'}</span><h2>{priorities.length ? `${priorities.length} ${priorities.length === 1 ? 'prioridad' : 'prioridades'}` : 'Operación bajo control'}</h2></div><span className="data-state">{isLive ? 'AUTOMÁTICO' : 'SOLO LECTURA'}</span></header><div className="priority-list">{priorities.map(item => <div key={item.id} className={`priority-item ${item.level.toLowerCase()}`}><span className="priority-icon"><AlertTriangle size={15}/></span><div><b>{item.title}</b><p>{item.text}</p></div><button disabled={!isLive} onClick={() => onPriority(item)}>{isLive ? item.action : 'Informativo'}</button></div>)}{!priorities.length && <div className="all-clear"><CheckCircle2 size={22}/><b>Sin pendientes críticos</b><span>No hay acciones urgentes para esta fecha.</span></div>}</div></article>
      <DayAgenda date={date} arrivals={arrivals} departures={departures} stays={stays}/>
    </div>
  </section>
}

function DayAgenda({ date, arrivals, departures, stays }: { date: string; arrivals: Reservation[]; departures: Reservation[]; stays: Reservation[] }) {
  const groups = [{ title: 'Llegadas', icon: <LogIn size={14}/>, rows: arrivals }, { title: 'Salidas', icon: <LogOut size={14}/>, rows: departures }, { title: 'En casa', icon: <UserRound size={14}/>, rows: stays }]
  return <article className="panel day-agenda"><header><div><span>AGENDA</span><h2>{shortDate(date)}</h2></div><b>{arrivals.length + departures.length}</b></header><div>{groups.map(group => <section key={group.title} className="agenda-group"><h3>{group.icon}{group.title}<b>{group.rows.length}</b></h3>{group.rows.map(row => <div className="agenda-row" key={`${group.title}-${row.id}`}><div><b>{row.roomNumber ?? 'Sin asignar'}</b><span>{row.guestName}</span></div><small>{row.status}</small></div>)}{!group.rows.length && <p>Sin movimientos</p>}</section>)}</div></article>
}

function RoomsView({ role, rooms, reservations, tasks, filter, setFilter, onRoomsChange, onTasksChange, onOpenCleaning, onNotify }: { role: Role; rooms: RoomState[]; reservations: Reservation[]; tasks: OperationTask[]; filter: 'Todas' | 'Atención' | 'Listas' | 'Ocupadas' | 'Bloqueadas'; setFilter: (value: 'Todas' | 'Atención' | 'Listas' | 'Ocupadas' | 'Bloqueadas') => void; onRoomsChange: Props['onRoomsChange']; onTasksChange: Props['onTasksChange']; onOpenCleaning: () => void; onNotify: (message: string) => void }) {
  const [issueRoom, setIssueRoom] = useState<RoomState>()
  const [issueType, setIssueType] = useState<RoomIssueType>('Falta control de TV')
  const visible = rooms.filter(room => filter === 'Todas' || filter === 'Atención' && (room.cleaning !== 'Limpia' || room.occupancy === 'Bloqueada' || room.occupancy === 'Salida prevista' || hasPendingIssue(room)) || filter === 'Listas' && readyLabel(room) === 'Lista' || filter === 'Ocupadas' && ['Ocupada', 'Salida prevista'].includes(room.occupancy) || filter === 'Bloqueadas' && room.occupancy === 'Bloqueada')
  const guest = (id?: string) => reservations.find(row => row.id === id)
  const activity = (action: string) => ({ id: `ACT-${Date.now()}-${Math.random().toString(16).slice(2)}`, action, by: role, at: hotelTime() })
  const requestCleaning = (room: RoomState) => {
    const occupied = room.occupancy === 'Ocupada'
    onRoomsChange(rows => rows.map(item => item.roomNumber === room.roomNumber ? { ...item, cleaning: 'Sucia', accessStatus: occupied ? 'Limpieza solicitada' : item.accessStatus, activityLog: [...(item.activityLog ?? []), activity(occupied ? 'Solicitó limpieza de estancia' : 'Marcó la habitación como sucia')] } : item))
    const type: OperationTask['type'] = occupied ? 'Limpieza de estancia' : 'Limpieza general'
    onTasksChange(rows => rows.some(task => task.date <= TODAY && task.roomNumber === room.roomNumber && CLEANING_TYPES.includes(task.type) && task.status !== 'Terminada') ? rows : [...rows, { id: `OP-${Date.now()}`, date: TODAY, roomNumber: room.roomNumber, roomType: room.roomType, type, status: 'Pendiente', priority: room.nextReservationId && (guest(room.nextReservationId)?.checkIn ?? '9999-12-31') <= TODAY ? 'Alta' : 'Normal', assignedTo: 'Limpieza', requestedAt: hotelTime(), deadline: 'Hoy', note: occupied ? 'Limpieza solicitada durante la estancia.' : 'Habitación enviada a limpieza desde Operación.' }])
    onNotify(`${room.roomNumber} fue enviada a Limpieza`)
  }
  const approveRoom = (room: RoomState) => {
    if (room.issues?.some(issue => issue.status === 'Pendiente')) { onNotify(`${room.roomNumber} todavía tiene incidencias pendientes`); return }
    onRoomsChange(rows => rows.map(item => item.roomNumber === room.roomNumber ? { ...item, cleaning: 'Limpia', activityLog: [...(item.activityLog ?? []), activity('Aprobó la habitación para entrega')] } : item))
    onTasksChange(rows => rows.map(task => task.date <= TODAY && task.roomNumber === room.roomNumber && task.type === 'Revisión' && task.status !== 'Terminada' ? { ...task, status: 'Terminada', completedAt: completedNow() } : task))
    onNotify(`${room.roomNumber} está lista para entregar`)
  }
  const reportIssue = () => {
    if (!issueRoom) return
    if (issueRoom.issues?.some(issue => issue.status === 'Pendiente' && issue.type === issueType)) { onNotify(`${issueType} ya está reportado en ${issueRoom.roomNumber}`); setIssueRoom(undefined); return }
    const taskId = `OP-${Date.now()}`
    const meta = issueTaskMeta(issueType)
    onRoomsChange(rows => rows.map(room => room.roomNumber === issueRoom.roomNumber ? { ...room, issues: [...(room.issues ?? []), { id: `INC-${Date.now()}`, type: issueType, status: 'Pendiente', reportedAt: hotelTime(), reportedBy: role, taskId }], activityLog: [...(room.activityLog ?? []), activity(`Reportó: ${issueType}`)] } : room))
    onTasksChange(rows => [...rows, { id: taskId, date: TODAY, roomNumber: issueRoom.roomNumber, roomType: issueRoom.roomType, type: meta.type, status: 'Pendiente', priority: meta.priority, assignedTo: meta.assignedTo, requestedAt: hotelTime(), deadline: 'Hoy', note: `${issueType}.` }])
    onNotify(`${issueType} registrado en ${issueRoom.roomNumber}`)
    setIssueRoom(undefined)
  }
  const updateAccess = (roomNumber: string, accessStatus: RoomAccessStatus) => {
    onRoomsChange(rows => rows.map(room => room.roomNumber === roomNumber ? { ...room, accessStatus, activityLog: [...(room.activityLog ?? []), activity(`Acceso: ${accessStatus}`)] } : room))
    onNotify(`Acceso de ${roomNumber}: ${accessStatus}`)
  }
  return <section className="operation-section">
    <div className="room-board-toolbar"><div><span>ESTADO EN VIVO</span><h2>{visible.length} de 17 habitaciones</h2></div><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option>Atención</option><option>Todas</option><option>Listas</option><option>Ocupadas</option><option>Bloqueadas</option></select></div>
    <div className="room-board">{visible.map(room => {
      const current = guest(room.currentReservationId)
      const next = guest(room.nextReservationId)
      const issues = room.issues?.filter(issue => issue.status === 'Pendiente') ?? []
      const hasActiveCleaning = tasks.some(task => task.date <= TODAY && task.roomNumber === room.roomNumber && CLEANING_TYPES.includes(task.type) && task.status !== 'Terminada')
      return <article key={room.roomNumber} className={`room-card ${roomTone(room)}`}>
        <header><div><span>{room.roomType}</span><h3>{room.roomNumber}</h3></div><b>{readyLabel(room)}</b></header>
        <div className="room-card-status"><span>Ocupación <b>{room.occupancy}</b></span><span>Limpieza <b>{room.cleaning}</b></span></div>
        <div className={`room-access ${roomAccessTone(room)}`}>{roomAccess(room)}</div>
        {room.occupancy === 'Ocupada' && <select className="room-access-select" value={room.accessStatus ?? 'Normal'} onChange={event => updateAccess(room.roomNumber, event.target.value as RoomAccessStatus)} aria-label={`Acceso ${room.roomNumber}`}><option>Normal</option><option>No molestar</option><option>Limpieza solicitada</option><option>Acceso autorizado</option><option>Intentar más tarde</option></select>}
        {current && <div className="room-guest"><small>Huésped actual</small><b>{current.guestName}</b><span>Salida {shortDate(current.checkOut)}</span></div>}
        {next && <div className="room-guest next"><small>Próxima llegada</small><b>{next.guestName}</b><span>{shortDate(next.checkIn)}</span></div>}
        {room.blockReason && <div className="room-block"><Wrench size={13}/>{room.blockReason}</div>}
        {!!issues.length && <div className="room-issues"><small>{issues.length} incidencia{issues.length > 1 ? 's' : ''}</small>{issues.map(issue => <div key={issue.id}><span>{issue.type}</span></div>)}</div>}
        <footer className="room-card-actions">
          {room.cleaning === 'Limpia' && !['Bloqueada', 'Salida prevista'].includes(room.occupancy) && !hasActiveCleaning && <button className="dirty-action" onClick={() => requestCleaning(room)}>{room.occupancy === 'Ocupada' ? 'Solicitar limpieza' : 'Marcar sucia'}</button>}
          {room.cleaning === 'Limpia' && hasActiveCleaning && <button className="open-cleaning" onClick={onOpenCleaning}>Ver solicitud</button>}
          {room.occupancy === 'Salida prevista' && <button className="open-cleaning" disabled>Esperar salida</button>}
          {room.cleaning === 'Por revisar' && <button className="approve-action" onClick={() => approveRoom(room)}>Aprobar y liberar</button>}
          {room.cleaning !== 'Limpia' && room.cleaning !== 'Por revisar' && room.occupancy !== 'Bloqueada' && <button className="open-cleaning" disabled={!hasActiveCleaning} onClick={onOpenCleaning}>{room.cleaning === 'En limpieza' ? 'Ver progreso' : 'Ver en Limpieza'}</button>}
          <button className="report-issue" onClick={() => { setIssueRoom(room); setIssueType('Falta control de TV') }}><PackageOpen size={13}/>Reportar problema</button>
        </footer>
      </article>
    })}</div>
    {!visible.length && <div className="cleaning-empty"><CheckCircle2 size={25}/><b>Sin habitaciones en este filtro</b><span>El estado se actualiza con Reservas y Limpieza.</span></div>}
    {issueRoom && <IssueDialog roomNumber={issueRoom.roomNumber} issueType={issueType} setIssueType={setIssueType} onClose={() => setIssueRoom(undefined)} onConfirm={reportIssue}/>}
  </section>
}

function CleaningView({ role, tasks, rooms, reservations, onTasksChange, onRoomsChange, onNotify }: { role: Role; tasks: OperationTask[]; rooms: RoomState[]; reservations: Reservation[]; onTasksChange: Props['onTasksChange']; onRoomsChange: Props['onRoomsChange']; onNotify: (message: string) => void }) {
  const [queue, setQueue] = useState<CleaningQueue>('Salidas')
  const [finishItem, setFinishItem] = useState<CleaningWorkItem>()
  const [reportItem, setReportItem] = useState<CleaningWorkItem>()
  const [selectedIssues, setSelectedIssues] = useState<RoomIssueType[]>([])
  const [reportType, setReportType] = useState<RoomIssueType>('Falta control de TV')
  const activity = (action: string) => ({ id: `ACT-${Date.now()}-${Math.random().toString(16).slice(2)}`, action, by: role, at: hotelTime() })
  const grouped = new Map<string, OperationTask[]>()
  tasks.filter(task => CLEANING_TYPES.includes(task.type)).forEach(task => grouped.set(task.roomNumber, [...(grouped.get(task.roomNumber) ?? []), task]))
  const workItems: CleaningWorkItem[] = rooms.map(room => {
    const roomTasks = grouped.get(room.roomNumber) ?? []
    const activeTasks = roomTasks.filter(task => task.status !== 'Terminada')
    const hasExit = room.occupancy === 'Salida prevista' || activeTasks.some(task => task.type === 'Limpieza de salida')
    const needsCleaning = activeTasks.some(task => task.type !== 'Limpieza de salida') || ['Sucia', 'En limpieza'].includes(room.cleaning)
    const section: CleaningQueue = hasExit ? 'Salidas' : room.occupancy !== 'Bloqueada' && needsCleaning ? 'Limpieza' : 'Check'
    const priority = roomTasks.reduce<OperationTask['priority']>((highest, task) => ({ Normal: 1, Alta: 2, Crítica: 3 }[task.priority] > { Normal: 1, Alta: 2, Crítica: 3 }[highest] ? task.priority : highest), 'Normal')
    return { roomNumber: room.roomNumber, roomType: room.roomType, tasks: roomTasks, section, priority }
  })
  const nextArrival = (room?: RoomState) => reservations.find(reservation => reservation.id === room?.nextReservationId)
  const visibleItems = workItems.filter(item => item.section === queue).sort((left, right) => {
    const leftRoom = rooms.find(room => room.roomNumber === left.roomNumber)
    const rightRoom = rooms.find(room => room.roomNumber === right.roomNumber)
    const score = (item: CleaningWorkItem, room?: RoomState) => (nextArrival(room)?.checkIn === TODAY ? 100 : 0) + ({ Crítica: 30, Alta: 20, Normal: 10 }[item.priority]) + (room?.occupancy === 'Libre' ? 5 : 0)
    return score(right, rightRoom) - score(left, leftRoom)
  })
  const queueCount = (target: CleaningQueue) => workItems.filter(item => item.section === target).length
  const itemHasCleaning = (item: CleaningWorkItem) => item.tasks.some(task => task.status !== 'Terminada' && task.type !== 'Reposición') || rooms.find(room => room.roomNumber === item.roomNumber)?.cleaning !== 'Limpia'

  const startWork = (item: CleaningWorkItem) => {
    const ids = new Set(item.tasks.filter(task => task.status !== 'Terminada').map(task => task.id))
    const room = rooms.find(room => room.roomNumber === item.roomNumber)
    onTasksChange(rows => {
      if (ids.size) return rows.map(task => ids.has(task.id) ? { ...task, status: 'En proceso', startedAt: hotelTime(), assignedTo: role === 'Limpieza' ? 'Personal de limpieza' : task.assignedTo } : task)
      const type: OperationTask['type'] = item.section === 'Salidas' ? 'Limpieza de salida' : room?.occupancy === 'Ocupada' ? 'Limpieza de estancia' : 'Limpieza general'
      return [...rows, { id: `OP-${Date.now()}`, date: TODAY, roomNumber: item.roomNumber, roomType: item.roomType, type, status: 'En proceso', priority: item.priority, assignedTo: role === 'Limpieza' ? 'Personal de limpieza' : 'Limpieza', requestedAt: hotelTime(), startedAt: hotelTime(), deadline: 'Hoy', note: 'Trabajo iniciado desde el panel de Limpieza.' }]
    })
    onRoomsChange(rows => rows.map(room => room.roomNumber === item.roomNumber ? { ...room, cleaning: itemHasCleaning(item) ? 'En limpieza' : room.cleaning, activityLog: [...(room.activityLog ?? []), activity('Inició el trabajo de habitación')] } : room))
    onNotify(`${item.roomNumber}: trabajo iniciado`)
  }
  const completeWork = (item: CleaningWorkItem, issues: RoomIssueType[] = []) => {
    const completedIds = new Set(item.tasks.map(task => task.id))
    const issueRecords = issues.map((issue, index) => ({ issue, taskId: `OP-${Date.now()}-${index}`, meta: issueTaskMeta(issue) }))
    onTasksChange(rows => {
      const completed = rows.map(task => completedIds.has(task.id) ? { ...task, status: 'Terminada' as const, completedAt: completedNow() } : task)
      const additions: OperationTask[] = issueRecords.map(({ issue, taskId, meta }) => ({ id: taskId, date: TODAY, roomNumber: item.roomNumber, roomType: item.roomType, type: meta.type, status: 'Pendiente', priority: meta.priority, assignedTo: meta.assignedTo, requestedAt: hotelTime(), deadline: 'Hoy', note: `${issue}.` }))
      return [...completed, ...additions]
    })
    onRoomsChange(rows => rows.map(room => {
      if (room.roomNumber !== item.roomNumber) return room
      const resolved = room.issues?.map(issue => issue.taskId && completedIds.has(issue.taskId) ? { ...issue, status: 'Resuelto' as const } : issue) ?? []
      const existingTypes = new Set(resolved.filter(issue => issue.status === 'Pendiente').map(issue => issue.type))
      const newIssues = issueRecords.filter(record => !existingTypes.has(record.issue)).map(({ issue, taskId }, index) => ({ id: `INC-${Date.now()}-${index}`, type: issue, status: 'Pendiente' as const, reportedAt: hotelTime(), reportedBy: role, taskId }))
      return { ...room, cleaning: itemHasCleaning(item) ? 'Limpia' : room.cleaning, issues: [...resolved, ...newIssues], activityLog: [...(room.activityLog ?? []), activity(`Terminó el trabajo${issues.length ? ` y reportó ${issues.length} incidencia(s)` : ''}`)] }
    }))
    setFinishItem(undefined)
    setSelectedIssues([])
    setQueue(issueRecords.some(record => record.meta.type === 'Reposición') ? 'Limpieza' : 'Check')
    onNotify(`${item.roomNumber}: trabajo terminado`)
  }
  const confirmCheck = (item: CleaningWorkItem) => {
    const room = rooms.find(room => room.roomNumber === item.roomNumber)
    if (!room) return
    if (hasPendingIssue(room)) { onNotify(`${item.roomNumber} todavía tiene incidencias pendientes`); return }
    onRoomsChange(rows => rows.map(row => row.roomNumber === item.roomNumber ? { ...row, cleaning: 'Limpia', activityLog: [...(row.activityLog ?? []), activity('Confirmó el check de habitación')] } : row))
    onTasksChange(rows => rows.map(task => task.roomNumber === item.roomNumber && task.type === 'Revisión' && task.status !== 'Terminada' ? { ...task, status: 'Terminada', completedAt: completedNow() } : task))
    onNotify(`${item.roomNumber}: check confirmado`)
  }
  const reportProblem = () => {
    if (!reportItem) return
    const room = rooms.find(item => item.roomNumber === reportItem.roomNumber)
    if (room?.issues?.some(issue => issue.status === 'Pendiente' && issue.type === reportType)) { onNotify(`${reportType} ya está reportado en ${reportItem.roomNumber}`); setReportItem(undefined); return }
    const taskId = `OP-${Date.now()}`
    const meta = issueTaskMeta(reportType)
    onTasksChange(rows => [...rows, { id: taskId, date: TODAY, roomNumber: reportItem.roomNumber, roomType: reportItem.roomType, type: meta.type, status: 'Pendiente', priority: meta.priority, assignedTo: meta.assignedTo, requestedAt: hotelTime(), deadline: 'Hoy', note: `${reportType}.` }])
    onRoomsChange(rows => rows.map(item => item.roomNumber === reportItem.roomNumber ? { ...item, issues: [...(item.issues ?? []), { id: `INC-${Date.now()}`, type: reportType, status: 'Pendiente', reportedAt: hotelTime(), reportedBy: role, taskId }], activityLog: [...(item.activityLog ?? []), activity(`Reportó: ${reportType}`)] } : item))
    onNotify(`${reportType} registrado en ${reportItem.roomNumber}`)
    setReportItem(undefined)
  }

  return <section className="cleaning-workspace">
    <div className="cleaning-heading"><div><span>HABITACIONES DE HOY</span><h2>{longDate(TODAY)}</h2></div><div><b>{workItems.length}</b><span>habitaciones organizadas</span></div></div>
    <div className="cleaning-queue-tabs">{(['Salidas', 'Limpieza', 'Check'] as CleaningQueue[]).map(item => <button key={item} className={queue === item ? 'active' : ''} onClick={() => setQueue(item)}><span>{item}</span><b>{queueCount(item)}</b></button>)}</div>
    <div className={`cleaning-task-list ${queue === 'Check' ? 'check-grid' : ''}`}>{visibleItems.map((item, index) => {
      const room = rooms.find(room => room.roomNumber === item.roomNumber)
      const arrival = nextArrival(room)
      const accessBlocked = room?.occupancy === 'Bloqueada' || room?.accessStatus === 'No molestar' || room?.occupancy === 'Salida prevista'
      const issueCount = room?.issues?.filter(issue => issue.status === 'Pendiente').length ?? 0
      const activeTasks = item.tasks.filter(task => task.status !== 'Terminada')
      const inProgress = activeTasks.some(task => task.status === 'En proceso') || room?.cleaning === 'En limpieza'
      const completedToday = item.tasks.find(task => task.status === 'Terminada' && task.completedAt?.startsWith(TODAY))
      const labels: string[] = [...new Set(activeTasks.map(task => task.type))]
      if (!labels.length) labels.push(item.section === 'Salidas' ? 'Salida pendiente' : item.section === 'Check' ? 'Check de habitación' : 'Limpieza')
      const note = activeTasks.find(task => task.type !== 'Reposición')?.note ?? (item.section === 'Salidas' ? 'Esperar confirmación de salida de recepción.' : room?.occupancy === 'Bloqueada' ? room.blockReason ?? 'Habitación bloqueada. No ingresar.' : item.section === 'Check' ? room?.occupancy === 'Ocupada' ? 'Habitación ocupada: revisar el estado sin ingresar.' : 'Sin limpieza pendiente. Reportar cualquier faltante o falla.' : 'Habitación pendiente de limpieza.')
      const deadline = item.tasks.find(task => task.deadline)?.deadline ?? 'hoy'
      return <article key={item.roomNumber} className={`cleaning-work-card ${item.priority.toLowerCase()} ${item.section.toLowerCase()}`}>
        <div className="cleaning-order">{index + 1}</div>
        <div className="cleaning-work-main">
          <header><div><div className="task-kind-row">{labels.map(label => <span key={label}>{label}</span>)}</div><h3>{item.roomNumber}</h3></div><b className={`task-access ${roomAccessTone(room)}`}>{roomAccess(room)}</b></header>
          <div className="cleaning-context">{arrival?.checkIn === TODAY && <span className="arrival-warning"><CalendarDays size={13}/>Llegada hoy · 3:00 p. m.</span>}{item.section !== 'Check' && <span><Clock3 size={13}/>Límite {deadline}</span>}{inProgress && <span className="working-label"><Sparkles size={13}/>En proceso</span>}{completedToday && <span><CheckCircle2 size={13}/>Terminada {completionTime(completedToday.completedAt)}</span>}{issueCount > 0 && <span className="issue-warning"><Wrench size={13}/>{issueCount} problema{issueCount > 1 ? 's' : ''}</span>}</div>
          <p>{note}</p>
        </div>
        <div className="cleaning-work-actions">
          {item.section !== 'Check' && !inProgress && <button className="primary-action" disabled={accessBlocked} onClick={() => startWork(item)}><Play size={15}/>{accessBlocked ? room?.occupancy === 'Salida prevista' ? 'Esperar salida' : 'No ingresar' : 'Empezar'}</button>}
          {item.section !== 'Check' && inProgress && <button className="primary-action" onClick={() => itemHasCleaning(item) ? (setFinishItem(item), setSelectedIssues([])) : completeWork(item)}><CheckCircle2 size={15}/>{itemHasCleaning(item) ? 'Terminar habitación' : 'Completar'}</button>}
          {item.section === 'Check' && room?.cleaning === 'Por revisar' && <button className="primary-action" onClick={() => confirmCheck(item)}><CheckCircle2 size={15}/>Confirmar check</button>}
          <button className="secondary-action" onClick={() => { setReportItem(item); setReportType('Falta control de TV') }}><Wrench size={14}/>Reportar problema</button>
        </div>
      </article>
    })}{!visibleItems.length && <div className="cleaning-empty"><CheckCircle2 size={25}/><b>Sin habitaciones en {queue}</b><span>Las 17 habitaciones se organizan automáticamente según su atención del día.</span></div>}</div>

    {finishItem && <div className="room-issue-backdrop" role="presentation"><section className="cleaning-finish-dialog" role="dialog" aria-modal="true" aria-label={`Terminar limpieza de ${finishItem.roomNumber}`}><header><div><span>HABITACIÓN {finishItem.roomNumber}</span><h2>Revisión rápida</h2><p>Todo está correcto por defecto. Toca únicamente lo que falte o no funcione.</p></div><button onClick={() => setFinishItem(undefined)} aria-label="Cerrar"><X size={17}/></button></header><div className="quick-room-checks">{QUICK_ROOM_CHECKS.map(check => { const selected = selectedIssues.includes(check.issue); return <button key={check.issue} className={selected ? 'has-issue' : ''} aria-pressed={selected} onClick={() => setSelectedIssues(current => selected ? current.filter(issue => issue !== check.issue) : [...current, check.issue])}><CheckCircle2 size={16}/><span>{check.label}</span><small>{selected ? 'Reportar' : 'Correcto'}</small></button> })}</div><footer><button onClick={() => setFinishItem(undefined)}>Cancelar</button><button className="primary-action" onClick={() => completeWork(finishItem, selectedIssues)}>Terminar habitación</button></footer></section></div>}
    {reportItem && <IssueDialog roomNumber={reportItem.roomNumber} issueType={reportType} setIssueType={setReportType} onClose={() => setReportItem(undefined)} onConfirm={reportProblem}/>}
  </section>
}

function IssueDialog({ roomNumber, issueType, setIssueType, onClose, onConfirm }: { roomNumber: string; issueType: RoomIssueType; setIssueType: (issue: RoomIssueType) => void; onClose: () => void; onConfirm: () => void }) {
  return <div className="room-issue-backdrop" role="presentation"><section className="room-issue-dialog" role="dialog" aria-modal="true" aria-label={`Reportar problema en ${roomNumber}`}><header><div><span>HABITACIÓN {roomNumber}</span><h2>Reportar problema</h2></div><button onClick={onClose} aria-label="Cerrar"><X size={17}/></button></header><div className="issue-options">{ROOM_ISSUE_OPTIONS.map(option => <button key={option} className={issueType === option ? 'selected' : ''} onClick={() => setIssueType(option)}>{option}</button>)}</div><footer><button onClick={onClose}>Cancelar</button><button className="primary-action" onClick={onConfirm}>Registrar problema</button></footer></section></div>
}
