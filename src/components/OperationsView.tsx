import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, BedDouble, CalendarDays, CheckCircle2, Clock3, LogIn, LogOut,
  PackageOpen, Play, RefreshCw, Sparkles, UserRound, Wrench, X,
} from 'lucide-react'
import type {
  OperationDay, OperationTask, Reservation, Role, RoomAccessStatus, RoomIssueType, RoomState,
} from '../types'
import { longDate, money, number, shortDate } from '../utils'

const TODAY = '2026-10-06'
type OperationTab = 'Hoy' | 'Habitaciones' | 'Limpieza'
type PriorityItem = {
  id: string
  level: 'Crítica' | 'Alta' | 'Normal'
  title: string
  text: string
  action: string
  reservation?: Reservation
  task?: OperationTask
}

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

const occupiedOn = (reservation: Reservation, date: string) => reservation.status !== 'Cancelada' && reservation.status !== 'No show' && reservation.checkIn <= date && reservation.checkOut > date
const readyLabel = (room: RoomState) => room.occupancy === 'Bloqueada' ? 'Bloqueada' : room.occupancy === 'Libre' && room.cleaning === 'Limpia' ? 'Lista' : room.cleaning
const roomTone = (room: RoomState) => room.occupancy === 'Bloqueada' ? 'blocked' : room.cleaning === 'Limpia' ? 'ready' : room.cleaning === 'Sucia' ? 'dirty' : room.cleaning === 'En limpieza' ? 'working' : 'review'
const roomAccess = (room?: RoomState) => !room ? 'Estado desconocido' : room.accessStatus && room.accessStatus !== 'Normal' ? room.accessStatus : room.occupancy === 'Libre' ? 'Disponible para entrar' : room.occupancy === 'Ocupada' ? 'Huésped dentro' : room.occupancy === 'Salida prevista' ? 'Salida pendiente' : 'No ingresar'
const roomAccessTone = (room?: RoomState) => !room || room.occupancy === 'Bloqueada' || room.accessStatus === 'No molestar' ? 'blocked' : room.occupancy === 'Libre' || room.accessStatus === 'Limpieza solicitada' || room.accessStatus === 'Acceso autorizado' ? 'available' : 'waiting'
const ROOM_ISSUE_OPTIONS: RoomIssueType[] = ['Falta control de TV', 'Falta control de A/C', 'Luces no funcionan', 'A/C no funciona bien', 'No hay llaves', 'Falta papel higiénico', 'Faltan toallas', 'Otro faltante o falla']
const QUICK_ROOM_CHECKS: Array<{ label: string; issue: RoomIssueType }> = [{ label: 'Toallas', issue: 'Faltan toallas' }, { label: 'Papel', issue: 'Falta papel higiénico' }, { label: 'Control TV', issue: 'Falta control de TV' }, { label: 'Control A/C', issue: 'Falta control de A/C' }, { label: 'Luces', issue: 'Luces no funcionan' }, { label: 'A/C', issue: 'A/C no funciona bien' }, { label: 'Llaves', issue: 'No hay llaves' }]
const issueTaskMeta = (issue: RoomIssueType) => {
  const technical = issue === 'Luces no funcionan' || issue === 'A/C no funciona bien'
  return { type: (technical ? 'Mantenimiento' : 'Reposición') as OperationTask['type'], priority: (issue === 'No hay llaves' ? 'Crítica' : technical ? 'Alta' : 'Normal') as OperationTask['priority'], assignedTo: technical ? 'Gerencia' : 'Limpieza' }
}

export function OperationsView(props: Props) {
  const { role, reservations, rooms, tasks, days, onReservationsChange, onRoomsChange, onTasksChange, onDaysChange, onNotify } = props
  const [tab, setTab] = useState<OperationTab>(role === 'Limpieza' ? 'Limpieza' : 'Hoy')
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [roomFilter, setRoomFilter] = useState<'Todas' | 'Atención' | 'Listas' | 'Ocupadas' | 'Bloqueadas'>('Todas')
  const dateStripRef = useRef<HTMLElement>(null)

  useEffect(() => { if (role === 'Limpieza') setTab('Limpieza') }, [role])
  useEffect(() => {
    const container = dateStripRef.current
    const active = container?.querySelector<HTMLElement>('button.active')
    if (container && active) container.scrollLeft = active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2
  }, [selectedDate])
  useEffect(() => {
    const checkoutCutoff = new Date(`${TODAY}T11:00:00-05:00`)
    if (new Date() < checkoutCutoff) return
    const checkoutRooms = reservations.filter(reservation => reservation.checkOut === TODAY && reservation.status === 'Hospedado' && reservation.roomNumber).map(reservation => reservation.roomNumber!)
    if (!checkoutRooms.length) return
    onRoomsChange(rows => rows.map(room => checkoutRooms.includes(room.roomNumber) && room.cleaning === 'Limpia' ? { ...room, cleaning: 'Sucia' } : room))
    onTasksChange(rows => {
      const additions = checkoutRooms.flatMap(roomNumber => {
        if (rows.some(task => task.date === TODAY && task.roomNumber === roomNumber && ['Limpieza de salida', 'Limpieza general'].includes(task.type) && task.status !== 'Terminada')) return []
        const room = rooms.find(item => item.roomNumber === roomNumber)
        return room ? [{ id: `OP-AUTO-${roomNumber}`, date: TODAY, roomNumber, roomType: room.roomType, type: 'Limpieza de salida' as const, status: 'Pendiente' as const, priority: 'Alta' as const, assignedTo: 'Limpieza', requestedAt: '11:00', deadline: '15:00', note: 'Salida programada: habitación marcada como sucia automáticamente después de las 11:00.' }] : []
      })
      return additions.length ? [...rows, ...additions] : rows
    })
  }, [])

  const selectedDay = days.find(day => day.date === selectedDate) ?? { date: selectedDate, status: 'No iniciado' as const }
  const arrivals = reservations.filter(row => row.checkIn === selectedDate && row.status === 'Confirmada')
  const departures = reservations.filter(row => row.checkOut === selectedDate && row.status === 'Hospedado')
  const stays = reservations.filter(row => row.status === 'Hospedado' && occupiedOn(row, selectedDate))
  const selectedTasks = tasks.filter(task => task.date === selectedDate)
  const dirtyRooms = rooms.filter(room => room.cleaning !== 'Limpia' && room.occupancy !== 'Bloqueada')
  const readyRooms = rooms.filter(room => room.occupancy === 'Libre' && room.cleaning === 'Limpia')
  const pendingTasks = selectedTasks.filter(task => task.status !== 'Terminada')
  const pendingBalance = [...arrivals, ...departures].reduce((sum, row) => sum + Math.max(0, row.total - row.paid), 0)

  const dayStrip = useMemo(() => days.map(day => {
    const dayArrivals = reservations.filter(row => row.checkIn === day.date && row.status !== 'Cancelada').length
    const dayDepartures = reservations.filter(row => row.checkOut === day.date && row.status !== 'Cancelada').length
    const occupied = reservations.filter(row => occupiedOn(row, day.date)).length
    const cleaningLoad = reservations.filter(row => row.checkOut === day.date && row.status !== 'Cancelada').length
    return { ...day, arrivals: dayArrivals, departures: dayDepartures, occupancy: occupied / 17 * 100, cleaningLoad }
  }), [days, reservations])

  const priorities = ([
    ...departures.map(reservation => ({ id: `exit-${reservation.id}`, level: 'Crítica', title: `Confirmar salida · ${reservation.roomNumber}`, text: `${reservation.guestName} debía salir antes de las 11:00.`, action: 'Confirmar salida', reservation })),
    ...arrivals.filter(reservation => !reservation.roomNumber).map(reservation => ({ id: `assign-${reservation.id}`, level: 'Crítica', title: 'Llegada sin habitación', text: `${reservation.guestName} llega hoy y todavía no tiene habitación.`, action: 'Abrir reserva', reservation })),
    ...arrivals.filter(reservation => reservation.roomNumber && rooms.find(room => room.roomNumber === reservation.roomNumber)?.cleaning !== 'Limpia' && !pendingTasks.some(task => task.roomNumber === reservation.roomNumber && task.type === 'Revisión')).map(reservation => ({ id: `ready-${reservation.id}`, level: 'Alta', title: `${reservation.roomNumber} no está lista`, text: `${reservation.guestName} llega hoy; falta terminar o revisar la habitación.`, action: 'Ver habitación', reservation })),
    ...pendingTasks.filter(task => task.priority !== 'Normal').map(task => ({ id: task.id, level: task.priority, title: `${task.type} · ${task.roomNumber}`, text: task.note, action: task.type === 'Revisión' ? 'Marcar lista' : 'Abrir tarea', task })),
  ] as PriorityItem[]).slice(0, 6)

  const openDay = () => {
    onDaysChange(rows => rows.map(day => day.date === selectedDate ? { ...day, status: 'Abierto', openedBy: role, openedAt: '08:00' } : day))
    onNotify('Simulación: operación abierta y reservaciones actualizadas')
  }

  const confirmDeparture = (reservation: Reservation) => {
    onReservationsChange(rows => rows.map(row => row.id === reservation.id ? { ...row, status: 'Salida' } : row))
    if (reservation.roomNumber) {
      const room = rooms.find(item => item.roomNumber === reservation.roomNumber)
      onRoomsChange(rows => rows.map(item => item.roomNumber === reservation.roomNumber ? { ...item, occupancy: 'Libre', cleaning: 'Sucia', currentReservationId: undefined } : item))
      onTasksChange(rows => rows.some(task => task.date === selectedDate && task.roomNumber === reservation.roomNumber && task.type === 'Limpieza de salida') ? rows : [...rows, {
        id: `OP-${Date.now()}`, date: selectedDate, roomNumber: reservation.roomNumber!, roomType: room?.roomType ?? reservation.roomType,
        type: 'Limpieza de salida', status: 'Pendiente', priority: 'Alta', requestedAt: '11:00', deadline: '14:30', note: 'Salida confirmada por recepción.', reservationId: reservation.id,
      }])
    }
    onNotify(`Simulación: salida de ${reservation.guestName} confirmada y limpieza solicitada`)
  }

  const markRoomReady = (roomNumber: string) => {
    onRoomsChange(rows => rows.map(room => room.roomNumber === roomNumber ? { ...room, cleaning: 'Limpia' } : room))
    onTasksChange(rows => rows.map(task => task.date === selectedDate && task.roomNumber === roomNumber && task.type === 'Revisión' ? { ...task, status: 'Terminada', completedAt: '14:10' } : task))
    onNotify(`Simulación: ${roomNumber} está lista para entregar`)
  }

  const runPriorityAction = (item: PriorityItem) => {
    if (item.reservation && item.action === 'Confirmar salida') return confirmDeparture(item.reservation)
    if (item.task?.type === 'Revisión') return markRoomReady(item.task.roomNumber)
    if (item.reservation) return onNotify(`Abriríamos la reserva ${item.reservation.id} en el módulo Reservas`)
    if (item.task) { setTab(item.task.type === 'Mantenimiento' ? 'Habitaciones' : 'Limpieza'); onNotify(`Tarea ${item.task.id} seleccionada`) }
  }

  return <div className="page operations-page">
    <section className="page-heading operation-heading"><div><p className="eyebrow">CENTRO DE CONTROL</p><h1>Operación</h1><p>Lo que el equipo debe resolver hoy para entregar cada habitación correctamente.</p></div><div className={`operation-day-state ${selectedDay.status.toLowerCase().replace(' ', '-')}`}><span>Estado del día</span><strong>{selectedDay.status}</strong><small>{selectedDay.openedAt ? `${selectedDay.openedBy} · ${selectedDay.openedAt}` : 'Pendiente de apertura'}</small></div></section>

    <section className="operation-date-strip" ref={dateStripRef}>{dayStrip.map(day => <button key={day.date} className={`${day.date === selectedDate ? 'active' : ''} ${day.date === TODAY ? 'today' : ''}`} onClick={() => setSelectedDate(day.date)}><span>{shortDate(day.date)}</span><b>{number(day.occupancy, 0)}%</b><small>{day.arrivals} lleg. · {day.departures} sal.</small><em>{day.cleaningLoad} limp.</em></button>)}</section>

    <section className="operation-controls"><div className="operation-tabs">{(['Hoy', 'Habitaciones', 'Limpieza'] as OperationTab[]).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item === 'Hoy' ? <CalendarDays size={15}/> : item === 'Habitaciones' ? <BedDouble size={15}/> : <Sparkles size={15}/>} {item}</button>)}</div><div className="day-actions"><button onClick={() => setSelectedDate(TODAY)}><RefreshCw size={14}/>Hoy</button>{selectedDay.status === 'No iniciado' && <button className="primary-action" onClick={openDay}><Play size={14}/>Abrir operación</button>}</div></section>

    {tab === 'Hoy' && <TodayView arrivals={arrivals} departures={departures} stays={stays} readyRooms={readyRooms.length} dirtyRooms={dirtyRooms.length} pendingBalance={pendingBalance} priorities={priorities} onPriority={runPriorityAction} tasks={selectedTasks} rooms={rooms}/>}
    {tab === 'Habitaciones' && <RoomsView role={role} date={selectedDate} rooms={rooms} reservations={reservations} filter={roomFilter} setFilter={setRoomFilter} onRoomsChange={onRoomsChange} onTasksChange={onTasksChange} onNotify={onNotify}/>}
    {tab === 'Limpieza' && <CleaningView role={role} date={selectedDate} tasks={selectedTasks} rooms={rooms} reservations={reservations} onTasksChange={onTasksChange} onRoomsChange={onRoomsChange} onNotify={onNotify}/>}
  </div>
}

function TodayView({ arrivals, departures, stays, readyRooms, dirtyRooms, pendingBalance, priorities, onPriority, tasks, rooms }: {
  arrivals: Reservation[]; departures: Reservation[]; stays: Reservation[]; readyRooms: number; dirtyRooms: number; pendingBalance: number; priorities: PriorityItem[]; onPriority: (item: PriorityItem) => void; tasks: OperationTask[]; rooms: RoomState[]
}) {
  return <section className="operation-section">
    <div className="operation-summary"><article><span><LogIn size={14}/>Llegadas</span><strong>{arrivals.length}</strong><small>{arrivals.filter(row => !row.roomNumber).length} sin asignar</small></article><article><span><LogOut size={14}/>Salidas</span><strong>{departures.length}</strong><small>{departures.length} por confirmar</small></article><article><span><UserRound size={14}/>Hospedados</span><strong>{stays.length}</strong><small>En el hotel</small></article><article><span><CheckCircle2 size={14}/>Listas</span><strong>{readyRooms}</strong><small>Disponibles para entregar</small></article><article><span><Sparkles size={14}/>Limpieza</span><strong>{dirtyRooms}</strong><small>Requieren atención</small></article><article><span><Clock3 size={14}/>Saldo por cobrar</span><strong>{money(pendingBalance)}</strong><small>Llegadas y salidas</small></article></div>
    <div className="operation-main-grid">
      <article className="panel priority-panel"><header><div><span>ORDEN DE ATENCIÓN</span><h2>{priorities.length} prioridades del día</h2></div><span className="data-state">AUTOMÁTICO</span></header><div className="priority-list">{priorities.map(item => <div key={item.id} className={`priority-item ${item.level.toLowerCase()}`}><span className="priority-icon"><AlertTriangle size={15}/></span><div><b>{item.title}</b><p>{item.text}</p></div><button onClick={() => onPriority(item)}>{item.action}</button></div>)}{!priorities.length && <div className="all-clear"><CheckCircle2 size={22}/><b>Sin pendientes críticos</b><span>La operación del día está bajo control.</span></div>}</div></article>
      <article className="panel task-progress"><header><div><span>AVANCE DEL DÍA</span><h2>Tareas operativas</h2></div></header><div className="task-progress-body"><Progress label="Terminadas" value={tasks.filter(task => task.status === 'Terminada').length} total={tasks.length}/><Progress label="En proceso" value={tasks.filter(task => task.status === 'En proceso').length} total={tasks.length}/><Progress label="Pendientes" value={tasks.filter(task => task.status === 'Pendiente').length} total={tasks.length}/><div className="room-readiness"><div><span>Listas</span><b>{rooms.filter(room => room.occupancy === 'Libre' && room.cleaning === 'Limpia').length}</b></div><div><span>Por revisar</span><b>{rooms.filter(room => room.cleaning === 'Por revisar').length}</b></div><div><span>Bloqueadas</span><b>{rooms.filter(room => room.occupancy === 'Bloqueada').length}</b></div></div></div></article>
    </div>
    <section className="agenda-grid"><AgendaColumn title="Salidas" icon={<LogOut size={15}/>} reservations={departures} empty="Sin salidas pendientes"/><AgendaColumn title="Durante la estancia" icon={<Sparkles size={15}/>} reservations={stays.filter(row => row.cleaningRequested)} empty="Sin solicitudes pendientes"/><AgendaColumn title="Llegadas" icon={<LogIn size={15}/>} reservations={arrivals} empty="Sin llegadas"/></section>
  </section>
}

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  const percentage = total ? value / total * 100 : 0
  return <div className="progress-row"><span>{label}</span><div><i style={{ width: `${percentage}%` }}/></div><b>{value}/{total}</b></div>
}

function AgendaColumn({ title, icon, reservations, empty }: { title: string; icon: React.ReactNode; reservations: Reservation[]; empty: string }) {
  return <article className="panel agenda-column"><header><div><span>AGENDA</span><h2>{icon}{title}</h2></div><b>{reservations.length}</b></header><div>{reservations.map(row => <div className="agenda-item" key={row.id}><div><b>{row.roomNumber ?? 'Sin asignar'}</b><span>{row.guestName}</span></div><small>{row.status}</small></div>)}{!reservations.length && <p className="agenda-empty">{empty}</p>}</div></article>
}

function RoomsView({ role, date, rooms, reservations, filter, setFilter, onRoomsChange, onTasksChange, onNotify }: { role: Role; date: string; rooms: RoomState[]; reservations: Reservation[]; filter: string; setFilter: (value: any) => void; onRoomsChange: Props['onRoomsChange']; onTasksChange: Props['onTasksChange']; onNotify: (message: string) => void }) {
  const [issueRoom, setIssueRoom] = useState<RoomState>()
  const [issueType, setIssueType] = useState<RoomIssueType>('Falta control de TV')
  const visible = rooms.filter(room => filter === 'Todas' || filter === 'Atención' && (room.cleaning !== 'Limpia' || room.occupancy === 'Bloqueada') || filter === 'Listas' && readyLabel(room) === 'Lista' || filter === 'Ocupadas' && ['Ocupada', 'Salida prevista'].includes(room.occupancy) || filter === 'Bloqueadas' && room.occupancy === 'Bloqueada')
  const guest = (id?: string) => reservations.find(row => row.id === id)
  const activity = (action: string) => ({ id: `ACT-${Date.now()}`, action, by: role, at: 'Ahora' })
  const markDirty = (room: RoomState) => {
    onRoomsChange(rows => rows.map(item => item.roomNumber === room.roomNumber ? { ...item, cleaning: 'Sucia', activityLog: [...(item.activityLog ?? []), activity('Marcó la habitación como sucia')] } : item))
    const type: OperationTask['type'] = room.occupancy === 'Ocupada' ? 'Limpieza de estancia' : 'Limpieza general'
    onTasksChange(rows => rows.some(task => task.date === date && task.roomNumber === room.roomNumber && ['Limpieza de salida', 'Limpieza de estancia', 'Limpieza general'].includes(task.type) && task.status !== 'Terminada') ? rows : [...rows, { id: `OP-${Date.now()}`, date, roomNumber: room.roomNumber, roomType: room.roomType, type, status: 'Pendiente', priority: 'Normal', assignedTo: 'Limpieza', requestedAt: 'Ahora', deadline: 'Hoy', note: 'Habitación marcada como sucia desde Operación.' }])
    onNotify(`${room.roomNumber} fue enviada al plan de limpieza`)
  }
  const markClean = (room: RoomState) => {
    onRoomsChange(rows => rows.map(item => item.roomNumber === room.roomNumber ? { ...item, cleaning: 'Limpia', activityLog: [...(item.activityLog ?? []), activity('Marcó la habitación como limpia')] } : item))
    onTasksChange(rows => rows.map(task => task.date === date && task.roomNumber === room.roomNumber && ['Limpieza de salida', 'Limpieza de estancia', 'Limpieza general', 'Revisión'].includes(task.type) && task.status !== 'Terminada' ? { ...task, status: 'Terminada', completedAt: 'Ahora' } : task))
    onNotify(`${room.roomNumber} cambió a Limpia`)
  }
  const reportIssue = () => {
    if (!issueRoom) return
    const taskId = `OP-${Date.now()}`
    const meta = issueTaskMeta(issueType)
    onRoomsChange(rows => rows.map(room => room.roomNumber === issueRoom.roomNumber ? { ...room, issues: [...(room.issues ?? []), { id: `INC-${Date.now()}`, type: issueType, status: 'Pendiente', reportedAt: 'Ahora', reportedBy: role, taskId }], activityLog: [...(room.activityLog ?? []), activity(`Reportó: ${issueType}`)] } : room))
    onTasksChange(rows => [...rows, { id: taskId, date, roomNumber: issueRoom.roomNumber, roomType: issueRoom.roomType, type: meta.type, status: 'Pendiente', priority: meta.priority, assignedTo: meta.assignedTo, requestedAt: 'Ahora', deadline: 'Hoy', note: `${issueType}.` }])
    onNotify(`${issueType} registrado en ${issueRoom.roomNumber}`)
    setIssueRoom(undefined)
  }
  const resolveIssue = (roomNumber: string, issueId: string, taskId?: string) => {
    onRoomsChange(rows => rows.map(room => room.roomNumber === roomNumber ? { ...room, issues: room.issues?.map(issue => issue.id === issueId ? { ...issue, status: 'Resuelto' } : issue), activityLog: [...(room.activityLog ?? []), activity('Resolvió una incidencia')] } : room))
    if (taskId) onTasksChange(rows => rows.map(task => task.id === taskId ? { ...task, status: 'Terminada', completedAt: 'Ahora' } : task))
    onNotify(`Incidencia resuelta en ${roomNumber}`)
  }
  const updateAccess = (roomNumber: string, accessStatus: RoomAccessStatus) => {
    onRoomsChange(rows => rows.map(room => room.roomNumber === roomNumber ? { ...room, accessStatus, activityLog: [...(room.activityLog ?? []), activity(`Acceso: ${accessStatus}`)] } : room))
    onNotify(`Acceso de ${roomNumber}: ${accessStatus}`)
  }
  return <section className="operation-section">
    <div className="room-board-toolbar"><div><span>ESTADO ACTUAL</span><h2>17 habitaciones</h2></div><select value={filter} onChange={event => setFilter(event.target.value)}><option>Todas</option><option>Atención</option><option>Listas</option><option>Ocupadas</option><option>Bloqueadas</option></select></div>
    <div className="room-board">{visible.map(room => {
      const current = guest(room.currentReservationId)
      const next = guest(room.nextReservationId)
      const issues = room.issues?.filter(issue => issue.status === 'Pendiente') ?? []
      return <article key={room.roomNumber} className={`room-card ${roomTone(room)}`}>
        <header><div><span>{room.roomType}</span><h3>{room.roomNumber}</h3></div><b>{readyLabel(room)}</b></header>
        <div className="room-card-status"><span>Ocupación <b>{room.occupancy}</b></span><span>Limpieza <b>{room.cleaning}</b></span></div>
        <div className={`room-access ${roomAccessTone(room)}`}>{roomAccess(room)}</div>
        {room.occupancy === 'Ocupada' && <select className="room-access-select" value={room.accessStatus ?? 'Normal'} onChange={event => updateAccess(room.roomNumber, event.target.value as RoomAccessStatus)} aria-label={`Acceso ${room.roomNumber}`}><option>Normal</option><option>No molestar</option><option>Limpieza solicitada</option><option>Acceso autorizado</option><option>Intentar más tarde</option></select>}
        {current && <div className="room-guest"><small>Huésped actual</small><b>{current.guestName}</b><span>Salida {shortDate(current.checkOut)}</span></div>}
        {next && <div className="room-guest next"><small>Próxima llegada</small><b>{next.guestName}</b><span>{shortDate(next.checkIn)}</span></div>}
        {room.blockReason && <div className="room-block"><Wrench size={13}/>{room.blockReason}</div>}
        {!!issues.length && <div className="room-issues"><small>{issues.length} incidencia{issues.length > 1 ? 's' : ''}</small>{issues.map(issue => <div key={issue.id}><span>{issue.type}</span><button onClick={() => resolveIssue(room.roomNumber, issue.id, issue.taskId)} aria-label={`Resolver ${issue.type}`}><CheckCircle2 size={13}/></button></div>)}</div>}
        <footer className="room-card-actions">
          {room.cleaning === 'Limpia' && room.occupancy !== 'Bloqueada' && <button className="dirty-action" onClick={() => markDirty(room)}>Sucia</button>}
          {room.cleaning !== 'Limpia' && room.occupancy !== 'Bloqueada' && <button className="clean-action" onClick={() => markClean(room)}>Limpiar</button>}
          <button className="report-issue" onClick={() => { setIssueRoom(room); setIssueType('Falta control de TV') }}><PackageOpen size={13}/>Reportar problema</button>
        </footer>
      </article>
    })}</div>
    {issueRoom && <div className="room-issue-backdrop" role="presentation"><section className="room-issue-dialog" role="dialog" aria-modal="true" aria-label={`Reportar incidencia en ${issueRoom.roomNumber}`}><header><div><span>HABITACIÓN {issueRoom.roomNumber}</span><h2>Registrar faltante o falla</h2></div><button onClick={() => setIssueRoom(undefined)} aria-label="Cerrar"><X size={17}/></button></header><div className="issue-options">{ROOM_ISSUE_OPTIONS.map(option => <button key={option} className={issueType === option ? 'selected' : ''} onClick={() => setIssueType(option)}>{option}</button>)}</div><footer><button onClick={() => setIssueRoom(undefined)}>Cancelar</button><button className="primary-action" onClick={reportIssue}>Registrar incidencia</button></footer></section></div>}
  </section>
}

type CleaningQueue = 'Por limpiar' | 'En proceso' | 'Terminadas'

function CleaningView({ role, date, tasks, rooms, reservations, onTasksChange, onRoomsChange, onNotify }: { role: Role; date: string; tasks: OperationTask[]; rooms: RoomState[]; reservations: Reservation[]; onTasksChange: Props['onTasksChange']; onRoomsChange: Props['onRoomsChange']; onNotify: (message: string) => void }) {
  const [queue, setQueue] = useState<CleaningQueue>('Por limpiar')
  const [finishTask, setFinishTask] = useState<OperationTask>()
  const [reportTask, setReportTask] = useState<OperationTask>()
  const [selectedIssues, setSelectedIssues] = useState<RoomIssueType[]>([])
  const [reportType, setReportType] = useState<RoomIssueType>('Falta control de TV')
  const cleaningTasks = tasks.filter(task => ['Limpieza de salida', 'Limpieza de estancia', 'Limpieza general', 'Reposición'].includes(task.type))
  const isCleaningTask = (task: OperationTask) => task.type !== 'Reposición'
  const inQueue = (task: OperationTask, target: CleaningQueue) => target === 'Por limpiar' ? task.status === 'Pendiente' || task.status === 'Pausada' : target === 'En proceso' ? task.status === 'En proceso' : task.status === 'Terminada'
  const queueCount = (target: CleaningQueue) => cleaningTasks.filter(task => inQueue(task, target)).length
  const nextArrival = (room?: RoomState) => reservations.find(reservation => reservation.id === room?.nextReservationId) ?? reservations.find(reservation => reservation.roomNumber === room?.roomNumber && reservation.checkIn >= date && reservation.status === 'Confirmada')
  const visibleTasks = cleaningTasks.filter(task => inQueue(task, queue)).sort((left, right) => {
    const roomLeft = rooms.find(room => room.roomNumber === left.roomNumber)
    const roomRight = rooms.find(room => room.roomNumber === right.roomNumber)
    const score = (task: OperationTask, room?: RoomState) => (nextArrival(room)?.checkIn === date ? 100 : 0) + ({ Crítica: 30, Alta: 20, Normal: 10 }[task.priority]) + (room?.occupancy === 'Libre' ? 5 : 0)
    return score(right, roomRight) - score(left, roomLeft)
  })
  const activity = (action: string) => ({ id: `ACT-${Date.now()}-${Math.random().toString(16).slice(2)}`, action, by: role, at: 'Ahora' })

  const startTask = (task: OperationTask) => {
    onTasksChange(rows => rows.map(row => row.id === task.id ? { ...row, status: 'En proceso', startedAt: 'Ahora', assignedTo: role === 'Limpieza' ? 'Personal de limpieza' : row.assignedTo } : row))
    onRoomsChange(rows => rows.map(room => room.roomNumber === task.roomNumber ? { ...room, cleaning: isCleaningTask(task) ? 'En limpieza' : room.cleaning, activityLog: [...(room.activityLog ?? []), activity(`Inició ${task.type}`)] } : room))
    setQueue('En proceso')
    onNotify(`${task.roomNumber}: tarea iniciada`)
  }

  const createIssueRecords = (task: OperationTask, issues: RoomIssueType[]) => issues.map((issue, index) => {
    const taskId = `OP-${Date.now()}-${index}`
    return { issue, taskId, meta: issueTaskMeta(issue) }
  })

  const completeTask = (task: OperationTask, issues: RoomIssueType[] = []) => {
    const issueRecords = createIssueRecords(task, issues)
    onTasksChange(rows => {
      const completed = rows.map(row => row.id === task.id ? { ...row, status: 'Terminada' as const, completedAt: 'Ahora' } : row)
      const additions: OperationTask[] = issueRecords.map(({ issue, taskId, meta }) => ({ id: taskId, date, roomNumber: task.roomNumber, roomType: task.roomType, type: meta.type, status: 'Pendiente', priority: meta.priority, assignedTo: meta.assignedTo, requestedAt: 'Ahora', deadline: 'Hoy', note: `${issue}.` }))
      return [...completed, ...additions]
    })
    onRoomsChange(rows => rows.map(room => {
      if (room.roomNumber !== task.roomNumber) return room
      const newIssues = issueRecords.map(({ issue, taskId }, index) => ({ id: `INC-${Date.now()}-${index}`, type: issue, status: 'Pendiente' as const, reportedAt: 'Ahora', reportedBy: role, taskId }))
      const resolvedIssues = task.type === 'Reposición' ? room.issues?.map(issue => issue.taskId === task.id ? { ...issue, status: 'Resuelto' as const } : issue) : room.issues
      return { ...room, cleaning: isCleaningTask(task) ? 'Limpia' : room.cleaning, issues: [...(resolvedIssues ?? []), ...newIssues], activityLog: [...(room.activityLog ?? []), activity(`Terminó ${task.type}${issues.length ? ` y reportó ${issues.length} incidencia(s)` : ''}`)] }
    }))
    setFinishTask(undefined)
    setSelectedIssues([])
    setQueue('Por limpiar')
    onNotify(`${task.roomNumber}: ${task.type === 'Reposición' ? 'reposición completada' : 'habitación marcada como limpia'}`)
  }

  const reportProblem = () => {
    if (!reportTask) return
    const records = createIssueRecords(reportTask, [reportType])
    const [{ taskId, meta }] = records
    onTasksChange(rows => [...rows, { id: taskId, date, roomNumber: reportTask.roomNumber, roomType: reportTask.roomType, type: meta.type, status: 'Pendiente', priority: meta.priority, assignedTo: meta.assignedTo, requestedAt: 'Ahora', deadline: 'Hoy', note: `${reportType}.` }])
    onRoomsChange(rows => rows.map(room => room.roomNumber === reportTask.roomNumber ? { ...room, issues: [...(room.issues ?? []), { id: `INC-${Date.now()}`, type: reportType, status: 'Pendiente', reportedAt: 'Ahora', reportedBy: role, taskId }], activityLog: [...(room.activityLog ?? []), activity(`Reportó: ${reportType}`)] } : room))
    onNotify(`${reportType} registrado en ${reportTask.roomNumber}`)
    setReportTask(undefined)
  }

  return <section className="cleaning-workspace">
    <div className="cleaning-heading"><div><span>TRABAJO DE HOY</span><h2>{longDate(date)}</h2></div><div><b>{queueCount('Por limpiar')}</b><span>habitaciones pendientes</span></div></div>
    <div className="cleaning-queue-tabs">{(['Por limpiar', 'En proceso', 'Terminadas'] as CleaningQueue[]).map(item => <button key={item} className={queue === item ? 'active' : ''} onClick={() => setQueue(item)}><span>{item}</span><b>{queueCount(item)}</b></button>)}</div>
    <div className="cleaning-task-list">{visibleTasks.map((task, index) => {
      const room = rooms.find(item => item.roomNumber === task.roomNumber)
      const arrival = nextArrival(room)
      const accessBlocked = room?.occupancy === 'Bloqueada' || room?.accessStatus === 'No molestar' || room?.occupancy === 'Salida prevista'
      const issueCount = room?.issues?.filter(issue => issue.status === 'Pendiente').length ?? 0
      return <article key={task.id} className={`cleaning-work-card ${task.priority.toLowerCase()}`}>
        <div className="cleaning-order">{index + 1}</div>
        <div className="cleaning-work-main">
          <header><div><span>{task.type}</span><h3>{task.roomNumber}</h3></div><b className={`task-access ${roomAccessTone(room)}`}>{roomAccess(room)}</b></header>
          <div className="cleaning-context">{arrival?.checkIn === date && <span className="arrival-warning"><CalendarDays size={13}/>Llegada hoy · 3:00 p. m.</span>}<span><Clock3 size={13}/>Límite {task.deadline ?? 'hoy'}</span>{issueCount > 0 && <span className="issue-warning"><Wrench size={13}/>{issueCount} problema{issueCount > 1 ? 's' : ''}</span>}</div>
          <p>{task.note}</p>
        </div>
        <div className="cleaning-work-actions">
          {(task.status === 'Pendiente' || task.status === 'Pausada') && <button className="primary-action" disabled={accessBlocked} onClick={() => startTask(task)}><Play size={15}/>{accessBlocked ? room?.occupancy === 'Salida prevista' ? 'Esperar salida' : 'No ingresar' : 'Empezar'}</button>}
          {task.status === 'En proceso' && <button className="primary-action" onClick={() => isCleaningTask(task) ? (setFinishTask(task), setSelectedIssues([])) : completeTask(task)}><CheckCircle2 size={15}/>{isCleaningTask(task) ? 'Terminar limpieza' : 'Completar'}</button>}
          {task.status === 'Terminada' && <div className="task-completed"><CheckCircle2 size={16}/><span>Terminada</span><small>{task.completedAt}</small></div>}
          {task.status !== 'Terminada' && <button className="secondary-action" onClick={() => { setReportTask(task); setReportType('Falta control de TV') }}><Wrench size={14}/>Reportar problema</button>}
        </div>
      </article>
    })}{!visibleTasks.length && <div className="cleaning-empty"><CheckCircle2 size={25}/><b>{queue === 'Por limpiar' ? 'No hay habitaciones pendientes' : queue === 'En proceso' ? 'Nadie está limpiando ahora' : 'Todavía no hay tareas terminadas'}</b><span>La lista se actualiza automáticamente con los cambios de recepción.</span></div>}</div>

    {finishTask && <div className="room-issue-backdrop" role="presentation"><section className="cleaning-finish-dialog" role="dialog" aria-modal="true" aria-label={`Terminar limpieza de ${finishTask.roomNumber}`}><header><div><span>HABITACIÓN {finishTask.roomNumber}</span><h2>Revisión rápida</h2><p>Todo está correcto por defecto. Toca únicamente lo que falte o no funcione.</p></div><button onClick={() => setFinishTask(undefined)} aria-label="Cerrar"><X size={17}/></button></header><div className="quick-room-checks">{QUICK_ROOM_CHECKS.map(check => { const selected = selectedIssues.includes(check.issue); return <button key={check.issue} className={selected ? 'has-issue' : ''} aria-pressed={selected} onClick={() => setSelectedIssues(current => selected ? current.filter(issue => issue !== check.issue) : [...current, check.issue])}><CheckCircle2 size={16}/><span>{check.label}</span><small>{selected ? 'Reportar' : 'Correcto'}</small></button> })}</div><footer><button onClick={() => setFinishTask(undefined)}>Cancelar</button><button className="primary-action" onClick={() => completeTask(finishTask, selectedIssues)}>Marcar habitación limpia</button></footer></section></div>}

    {reportTask && <div className="room-issue-backdrop" role="presentation"><section className="room-issue-dialog" role="dialog" aria-modal="true" aria-label={`Reportar problema en ${reportTask.roomNumber}`}><header><div><span>HABITACIÓN {reportTask.roomNumber}</span><h2>Reportar problema</h2></div><button onClick={() => setReportTask(undefined)} aria-label="Cerrar"><X size={17}/></button></header><div className="issue-options">{ROOM_ISSUE_OPTIONS.map(option => <button key={option} className={reportType === option ? 'selected' : ''} onClick={() => setReportType(option)}>{option}</button>)}</div><footer><button onClick={() => setReportTask(undefined)}>Cancelar</button><button className="primary-action" onClick={reportProblem}>Registrar problema</button></footer></section></div>}
  </section>
}
