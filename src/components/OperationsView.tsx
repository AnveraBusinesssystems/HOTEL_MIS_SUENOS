import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, BedDouble, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, Clock3, LogIn, LogOut, Play, RefreshCw,
  Sparkles, UserRound, Wrench,
} from 'lucide-react'
import type {
  CleaningStatus, OperationDay, OperationTask, Reservation, Role, RoomState,
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
    {tab === 'Habitaciones' && <RoomsView rooms={rooms} reservations={reservations} filter={roomFilter} setFilter={setRoomFilter} onReady={markRoomReady} onNotify={onNotify}/>}
    {tab === 'Limpieza' && <CleaningView date={selectedDate} tasks={selectedTasks} rooms={rooms} onTasksChange={onTasksChange} onRoomsChange={onRoomsChange} onNotify={onNotify}/>}
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

function RoomsView({ rooms, reservations, filter, setFilter, onReady, onNotify }: { rooms: RoomState[]; reservations: Reservation[]; filter: string; setFilter: (value: any) => void; onReady: (room: string) => void; onNotify: (message: string) => void }) {
  const visible = rooms.filter(room => filter === 'Todas' || filter === 'Atención' && (room.cleaning !== 'Limpia' || room.occupancy === 'Bloqueada') || filter === 'Listas' && readyLabel(room) === 'Lista' || filter === 'Ocupadas' && ['Ocupada', 'Salida prevista'].includes(room.occupancy) || filter === 'Bloqueadas' && room.occupancy === 'Bloqueada')
  const guest = (id?: string) => reservations.find(row => row.id === id)
  return <section className="operation-section"><div className="room-board-toolbar"><div><span>ESTADO ACTUAL</span><h2>17 habitaciones</h2></div><select value={filter} onChange={event => setFilter(event.target.value)}><option>Todas</option><option>Atención</option><option>Listas</option><option>Ocupadas</option><option>Bloqueadas</option></select></div><div className="room-board">{visible.map(room => { const current = guest(room.currentReservationId); const next = guest(room.nextReservationId); return <article key={room.roomNumber} className={`room-card ${roomTone(room)}`}><header><div><span>{room.roomType}</span><h3>{room.roomNumber}</h3></div><b>{readyLabel(room)}</b></header><div className="room-card-status"><span>Ocupación <b>{room.occupancy}</b></span><span>Limpieza <b>{room.cleaning}</b></span></div>{current && <div className="room-guest"><small>Huésped actual</small><b>{current.guestName}</b><span>Salida {shortDate(current.checkOut)}</span></div>}{next && <div className="room-guest next"><small>Próxima llegada</small><b>{next.guestName}</b><span>{shortDate(next.checkIn)}</span></div>}{room.blockReason && <div className="room-block"><Wrench size={13}/>{room.blockReason}</div>}<footer>{room.cleaning === 'Por revisar' && <button onClick={() => onReady(room.roomNumber)}>Marcar lista</button>}{room.cleaning === 'Sucia' && room.occupancy !== 'Bloqueada' && <button onClick={() => onNotify(`La tarea de ${room.roomNumber} está disponible en Limpieza`)}>Ver limpieza</button>}{room.occupancy === 'Bloqueada' && <button onClick={() => onNotify(`Abriríamos la incidencia de ${room.roomNumber}`)}>Ver incidencia</button>}</footer></article>})}</div></section>
}

function CleaningView({ date, tasks, rooms, onTasksChange, onRoomsChange, onNotify }: { date: string; tasks: OperationTask[]; rooms: RoomState[]; onTasksChange: Props['onTasksChange']; onRoomsChange: Props['onRoomsChange']; onNotify: (message: string) => void }) {
  const cleaningTasks = tasks.filter(task => task.type === 'Limpieza de salida' || task.type === 'Limpieza de estancia')
  const updateTask = (task: OperationTask, status: OperationTask['status']) => {
    onTasksChange(rows => {
      let next = rows.map(row => row.id === task.id ? { ...row, status, startedAt: status === 'En proceso' ? '10:20' : row.startedAt, completedAt: status === 'Terminada' ? '11:05' : row.completedAt } : row)
      if (status === 'Terminada' && task.type === 'Limpieza de salida' && !next.some(row => row.date === date && row.roomNumber === task.roomNumber && row.type === 'Revisión')) next = [...next, { id: `OP-${Date.now()}`, date, roomNumber: task.roomNumber, roomType: task.roomType, type: 'Revisión', status: 'Pendiente', priority: 'Alta', assignedTo: 'Recepción', requestedAt: '11:05', deadline: '14:30', note: 'Limpieza terminada; requiere revisión final.', reservationId: task.reservationId }]
      return next
    })
    onRoomsChange(rows => rows.map(room => room.roomNumber === task.roomNumber ? { ...room, cleaning: status === 'En proceso' ? 'En limpieza' : status === 'Terminada' ? (task.type === 'Limpieza de salida' ? 'Por revisar' : 'Limpia') : room.cleaning } : room))
    onNotify(`Simulación: ${task.roomNumber} cambió a ${status}`)
  }
  const columns: OperationTask['status'][] = ['Pendiente', 'En proceso', 'Terminada']
  return <section className="operation-section"><div className="cleaning-heading"><div><span>PLAN DE LIMPIEZA</span><h2>{longDate(date)}</h2></div><div><b>{cleaningTasks.filter(task => task.status !== 'Terminada').length}</b><span>tareas pendientes</span></div></div><div className="cleaning-board">{columns.map(status => <section key={status} className="cleaning-column"><header><span>{status}</span><b>{cleaningTasks.filter(task => task.status === status).length}</b></header><div>{cleaningTasks.filter(task => task.status === status).map(task => <article key={task.id} className={`cleaning-task ${task.priority.toLowerCase()}`}><div className="task-top"><b>{task.roomNumber}</b><span>{task.priority}</span></div><h3>{task.type}</h3><p>{task.note}</p><div className="task-meta"><span><UserRound size={12}/>{task.assignedTo ?? 'Sin asignar'}</span><span><Clock3 size={12}/>{task.deadline ?? 'Sin límite'}</span></div><footer>{task.status === 'Pendiente' && <button onClick={() => updateTask(task, 'En proceso')}><Play size={13}/>Empezar</button>}{task.status === 'En proceso' && <><button onClick={() => updateTask(task, 'Pausada')}>Pausar</button><button className="primary-action" onClick={() => updateTask(task, 'Terminada')}><CheckCircle2 size={13}/>Terminar</button></>}{task.status === 'Terminada' && <span>Terminada {task.completedAt}</span>}<button className="issue-button" onClick={() => onNotify(`Incidencia registrada para ${task.roomNumber}`)}><Wrench size={13}/></button></footer></article>)}{!cleaningTasks.some(task => task.status === status) && <div className="empty-task-column">Sin tareas</div>}</div></section>)}</div></section>
}
