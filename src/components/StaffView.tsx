import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  LogIn, LogOut, Pencil, Plus, ReceiptText, UserRound, Users, WalletCards, X,
} from 'lucide-react'
import type {
  Role, StaffMember, StaffRequest, StaffRequestType, StaffScheduleEntry, StaffTimeEntry,
} from '../types'
import { longDate, money, shortDate } from '../utils'

type Props = {
  role: Role
  staff: StaffMember[]
  schedules: StaffScheduleEntry[]
  timeEntries: StaffTimeEntry[]
  requests: StaffRequest[]
  onSchedulesChange: (updater: (rows: StaffScheduleEntry[]) => StaffScheduleEntry[]) => void
  onTimeEntriesChange: (updater: (rows: StaffTimeEntry[]) => StaffTimeEntry[]) => void
  onRequestsChange: (updater: (rows: StaffRequest[]) => StaffRequest[]) => void
  onNotify: (message: string) => void
}

type RequestDraft = { type: StaffRequestType; requestedDate: string; proposedDate: string; reason: string }

const hotelDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const hotelTime = () => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Cancun', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
const TODAY = hotelDate()
const managerRoles: Role[] = ['Dueño', 'Gerencia', 'Administración']
const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const iso = (date: Date) => date.toISOString().slice(0, 10)
const mondayOf = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  const weekday = date.getDay()
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1))
  return iso(date)
}
const moveDays = (value: string, amount: number) => {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return iso(date)
}
const weekDates = (monday: string) => Array.from({ length: 7 }, (_, index) => moveDays(monday, index))
const minutes = (value?: string) => {
  if (!value) return 0
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}
const durationHours = (entry: StaffTimeEntry) => entry.clockOut ? Math.max(0, minutes(entry.clockOut) - minutes(entry.clockIn)) / 60 : 0
const employeeForRole = (staff: StaffMember[], role: Role) => staff.find(employee => employee.role === role && employee.status === 'Activo')
const attendanceFor = (entries: StaffTimeEntry[], employeeId: string, date: string) => entries.find(entry => entry.employeeId === employeeId && entry.date === date)
const scheduleFor = (schedules: StaffScheduleEntry[], employeeId: string, date: string) => schedules.find(entry => entry.employeeId === employeeId && entry.date === date)

function payrollFor(employee: StaffMember, monday: string, schedules: StaffScheduleEntry[], entries: StaffTimeEntry[]) {
  const dates = weekDates(monday)
  const planned = schedules.filter(row => row.employeeId === employee.id && dates.includes(row.date) && (!row.isRest || row.unpaidLeave)).length
  const worked = new Set(entries.filter(row => row.employeeId === employee.id && dates.includes(row.date)).map(row => row.date)).size
  const hours = entries.filter(row => row.employeeId === employee.id && dates.includes(row.date)).reduce((sum, row) => sum + durationHours(row), 0)
  const estimated = planned ? employee.weeklySalary / planned * Math.min(worked, planned) : 0
  return { planned, worked, hours, estimated }
}

export function StaffView({ role, staff, schedules, timeEntries, requests, onSchedulesChange, onTimeEntriesChange, onRequestsChange, onNotify }: Props) {
  const canManage = managerRoles.includes(role)
  const [weekStart, setWeekStart] = useState(mondayOf(TODAY))
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(staff[0]?.id ?? '')
  const [editSchedule, setEditSchedule] = useState<StaffScheduleEntry | null>(null)
  const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null)
  const [requestEmployeeId, setRequestEmployeeId] = useState('')
  const [error, setError] = useState('')

  const currentEmployee = canManage ? staff.find(employee => employee.id === selectedEmployeeId) : employeeForRole(staff, role)
  const dates = weekDates(weekStart)
  const weekEnd = dates[6]
  const activeStaff = staff.filter(employee => employee.status === 'Activo')

  useEffect(() => {
    if (canManage && !staff.some(employee => employee.id === selectedEmployeeId)) setSelectedEmployeeId(staff[0]?.id ?? '')
  }, [canManage, selectedEmployeeId, staff])

  const todayScheduled = activeStaff.filter(employee => {
    const schedule = scheduleFor(schedules, employee.id, TODAY)
    return schedule && !schedule.isRest
  })
  const workingNow = activeStaff.filter(employee => {
    const entry = attendanceFor(timeEntries, employee.id, TODAY)
    return entry && !entry.clockOut
  })
  const notStarted = todayScheduled.filter(employee => !attendanceFor(timeEntries, employee.id, TODAY))
  const weeklyPayroll = activeStaff.reduce((sum, employee) => sum + payrollFor(employee, weekStart, schedules, timeEntries).estimated, 0)
  const pendingRequests = requests.filter(request => request.status === 'Pendiente')

  const updateWeek = (amount: number) => setWeekStart(current => moveDays(current, amount * 7))
  const openRequest = (type: StaffRequestType, employeeId = currentEmployee?.id ?? '') => {
    const nextRest = schedules
      .filter(row => row.employeeId === employeeId && row.date >= TODAY && row.isRest && !row.unpaidLeave)
      .sort((left, right) => left.date.localeCompare(right.date))[0]
    setError('')
    setRequestEmployeeId(employeeId)
    setRequestDraft({ type, requestedDate: type === 'Cambio de descanso' ? nextRest?.date ?? TODAY : TODAY, proposedDate: '', reason: '' })
  }

  const saveRequest = () => {
    if (!requestDraft || !requestEmployeeId) return
    if (!requestDraft.requestedDate) { setError('Selecciona la fecha solicitada.'); return }
    if (requestDraft.type === 'Cambio de descanso' && !requestDraft.proposedDate) { setError('Selecciona el nuevo día de descanso.'); return }
    if (requestDraft.type === 'Cambio de descanso' && requestDraft.requestedDate === requestDraft.proposedDate) { setError('Los dos días deben ser diferentes.'); return }
    if (requestDraft.type === 'Cambio de descanso') {
      const currentRest = scheduleFor(schedules, requestEmployeeId, requestDraft.requestedDate)
      const proposedRest = scheduleFor(schedules, requestEmployeeId, requestDraft.proposedDate)
      if (!currentRest?.isRest || currentRest.unpaidLeave) { setError('La primera fecha debe ser el descanso actualmente programado.'); return }
      if (proposedRest?.isRest) { setError('El nuevo descanso debe ser un día actualmente programado para trabajar.'); return }
    }
    if (!requestDraft.reason.trim()) { setError('Agrega un motivo breve.'); return }
    const next: StaffRequest = {
      id: `SOL-${Date.now()}`, employeeId: requestEmployeeId, type: requestDraft.type,
      requestedDate: requestDraft.requestedDate, proposedDate: requestDraft.proposedDate || undefined,
      reason: requestDraft.reason.trim(), status: 'Pendiente', createdAt: `${TODAY} ${hotelTime()}`,
    }
    onRequestsChange(rows => [next, ...rows])
    setRequestDraft(null)
    onNotify('Solicitud enviada a administración')
  }

  const punch = () => {
    if (!currentEmployee) return
    const schedule = scheduleFor(schedules, currentEmployee.id, TODAY)
    if (!schedule || schedule.isRest) { onNotify('Hoy no tienes un turno programado'); return }
    const entry = attendanceFor(timeEntries, currentEmployee.id, TODAY)
    if (!entry) {
      onTimeEntriesChange(rows => [...rows, { id: `ASIS-${Date.now()}`, employeeId: currentEmployee.id, date: TODAY, clockIn: hotelTime() }])
      onNotify('Inicio de turno registrado')
      return
    }
    if (!entry.clockOut) {
      onTimeEntriesChange(rows => rows.map(row => row.id === entry.id ? { ...row, clockOut: hotelTime() } : row))
      onNotify('Fin de turno registrado')
      return
    }
    onNotify('Tu turno de hoy ya está registrado')
  }

  const saveSchedule = () => {
    if (!editSchedule) return
    if (!editSchedule.isRest && (!editSchedule.shiftStart || !editSchedule.shiftEnd)) { setError('Indica la hora de entrada y salida.'); return }
    if (!editSchedule.isRest && minutes(editSchedule.shiftEnd) <= minutes(editSchedule.shiftStart)) { setError('La salida debe ser posterior a la entrada.'); return }
    onSchedulesChange(rows => rows.some(row => row.employeeId === editSchedule.employeeId && row.date === editSchedule.date)
      ? rows.map(row => row.employeeId === editSchedule.employeeId && row.date === editSchedule.date ? editSchedule : row)
      : [...rows, editSchedule])
    setEditSchedule(null)
    onNotify('Horario actualizado')
  }

  const reviewRequest = (request: StaffRequest, status: 'Aprobada' | 'Rechazada') => {
    if (status === 'Aprobada') {
      if (request.type === 'Cambio de descanso' && request.proposedDate) {
        const reference = schedules.find(row => row.employeeId === request.employeeId && !row.isRest)
        onSchedulesChange(rows => {
          const update = (date: string, isRest: boolean) => {
            const found = rows.some(row => row.employeeId === request.employeeId && row.date === date)
            const next: StaffScheduleEntry = { employeeId: request.employeeId, date, isRest, unpaidLeave: false, shiftStart: isRest ? undefined : reference?.shiftStart ?? '08:00', shiftEnd: isRest ? undefined : reference?.shiftEnd ?? '16:00' }
            return found ? rows.map(row => row.employeeId === request.employeeId && row.date === date ? next : row) : [...rows, next]
          }
          return update(request.proposedDate!, true).map(row => row.employeeId === request.employeeId && row.date === request.requestedDate ? { ...row, isRest: false, unpaidLeave: false, shiftStart: reference?.shiftStart ?? '08:00', shiftEnd: reference?.shiftEnd ?? '16:00' } : row)
        })
      }
      if (request.type === 'Día libre sin goce') {
        onSchedulesChange(rows => rows.some(row => row.employeeId === request.employeeId && row.date === request.requestedDate)
          ? rows.map(row => row.employeeId === request.employeeId && row.date === request.requestedDate ? { ...row, isRest: true, unpaidLeave: true, shiftStart: undefined, shiftEnd: undefined } : row)
          : [...rows, { employeeId: request.employeeId, date: request.requestedDate, isRest: true, unpaidLeave: true }])
      }
    }
    onRequestsChange(rows => rows.map(row => row.id === request.id ? { ...row, status, reviewedBy: role } : row))
    onNotify(`Solicitud ${status.toLowerCase()}`)
  }

  if (!canManage && !currentEmployee) return <section className="page"><div className="page-heading"><div><p className="eyebrow">PERSONAL</p><h1>Mi horario</h1><p>Tu rol todavía no está vinculado con un empleado de demostración.</p></div></div><div className="access-note">La vinculación individual se configurará cuando conectemos usuarios y personal.</div></section>

  return <section className="page staff-page">
    <section className="page-heading staff-heading"><div><p className="eyebrow">PERSONAL Y ASISTENCIA</p><h1>{canManage ? 'Equipo y nómina semanal' : 'Mi semana'}</h1><p>{canManage ? 'Horarios, asistencia, solicitudes y estimación del pago de lunes a domingo.' : 'Consulta tus turnos, registra tu asistencia y solicita cambios.'}</p></div><WeekPicker monday={weekStart} sunday={weekEnd} onPrevious={() => updateWeek(-1)} onNext={() => updateWeek(1)} onToday={() => setWeekStart(mondayOf(TODAY))}/></section>

    {canManage ? <>
      <section className="staff-summary">
        <article><span><Users size={14}/>Personal activo</span><strong>{activeStaff.length}</strong><small>{todayScheduled.length} programados hoy</small></article>
        <article><span><Clock3 size={14}/>En turno</span><strong>{workingNow.length}</strong><small>{notStarted.length} sin iniciar</small></article>
        <article><span><ReceiptText size={14}/>Solicitudes</span><strong>{pendingRequests.length}</strong><small>Pendientes de revisión</small></article>
        <article><span><WalletCards size={14}/>Pago estimado</span><strong>{money(weeklyPayroll)}</strong><small>Se paga el domingo · sujeto a revisión</small></article>
      </section>
      <div className="staff-management-layout">
        <aside className="panel staff-roster"><header><div><span>EQUIPO</span><h2>{activeStaff.length} empleados</h2></div></header><div>{activeStaff.map(employee => {
          const payroll = payrollFor(employee, weekStart, schedules, timeEntries)
          const attendance = attendanceFor(timeEntries, employee.id, TODAY)
          return <button key={employee.id} className={selectedEmployeeId === employee.id ? 'active' : ''} onClick={() => setSelectedEmployeeId(employee.id)}><span className="staff-avatar">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span><b>{employee.name}</b><small>{employee.role} · {payroll.worked}/{payroll.planned} días</small></span><em className={attendance && !attendance.clockOut ? 'working' : ''}>{attendance && !attendance.clockOut ? 'En turno' : money(payroll.estimated)}</em></button>
        })}</div></aside>
        {currentEmployee && <EmployeeWeek
          employee={currentEmployee} monday={weekStart} schedules={schedules} entries={timeEntries}
          canEdit showPayroll onEdit={entry => { setError(''); setEditSchedule(entry) }}
        />}
      </div>
      <section className="panel staff-requests-panel"><header><div><span>SOLICITUDES DEL PERSONAL</span><h2>{pendingRequests.length ? `${pendingRequests.length} por revisar` : 'Sin pendientes'}</h2></div><button onClick={() => openRequest('Día libre sin goce', selectedEmployeeId)}><Plus size={14}/>Crear solicitud</button></header><div className="staff-request-list">{requests.map(request => {
        const employee = staff.find(item => item.id === request.employeeId)
        return <article key={request.id} className={request.status.toLowerCase()}><div><span>{request.type}</span><b>{employee?.name ?? request.employeeId}</b><small>{request.type === 'Cambio de descanso' ? `${shortDate(request.requestedDate)} → ${shortDate(request.proposedDate ?? '')}` : shortDate(request.requestedDate)} · {request.reason}</small></div><strong>{request.status}</strong>{request.status === 'Pendiente' && <div className="request-actions"><button onClick={() => reviewRequest(request, 'Rechazada')}>Rechazar</button><button onClick={() => reviewRequest(request, 'Aprobada')}>Aprobar</button></div>}</article>
      })}</div></section>
    </> : currentEmployee && <EmployeePortal
      employee={currentEmployee} monday={weekStart} schedules={schedules}
      entries={timeEntries} requests={requests} onPunch={punch} onRequest={openRequest}
    />}

    {editSchedule && <ScheduleDialog
      employee={staff.find(item => item.id === editSchedule.employeeId)} entry={editSchedule}
      error={error} onChange={setEditSchedule} onClose={() => setEditSchedule(null)} onSave={saveSchedule}
    />}
    {requestDraft && <RequestDialog
      employee={staff.find(item => item.id === requestEmployeeId)} draft={requestDraft}
      error={error} onChange={setRequestDraft} onClose={() => setRequestDraft(null)} onSave={saveRequest}
    />}
  </section>
}

function WeekPicker({ monday, sunday, onPrevious, onNext, onToday }: { monday: string; sunday: string; onPrevious: () => void; onNext: () => void; onToday: () => void }) {
  return <div className="week-picker"><button onClick={onPrevious} aria-label="Semana anterior"><ChevronLeft size={16}/></button><div><span>PERIODO DE PAGO</span><b>{shortDate(monday)} — {shortDate(sunday)}</b><small>Lunes a domingo</small></div><button onClick={onNext} aria-label="Semana siguiente"><ChevronRight size={16}/></button><button className="current-week" onClick={onToday}>Semana actual</button></div>
}

function EmployeeWeek({ employee, monday, schedules, entries, canEdit, showPayroll, onEdit }: { employee: StaffMember; monday: string; schedules: StaffScheduleEntry[]; entries: StaffTimeEntry[]; canEdit?: boolean; showPayroll?: boolean; onEdit: (entry: StaffScheduleEntry) => void }) {
  const dates = weekDates(monday)
  const payroll = payrollFor(employee, monday, schedules, entries)
  return <article className="panel employee-week"><header><div><span>{employee.id} · {employee.role}</span><h2>{employee.name}</h2></div>{showPayroll && <div className="salary-overview"><span><small>Salario semanal</small><b>{money(employee.weeklySalary)}</b></span><span><small>Días trabajados</small><b>{payroll.worked} / {payroll.planned}</b></span><span><small>Horas registradas</small><b>{payroll.hours.toFixed(1)} h</b></span><span><small>Pago estimado</small><b>{money(payroll.estimated)}</b></span></div>}</header><div className="schedule-week-grid">{dates.map((date, index) => {
    const schedule = scheduleFor(schedules, employee.id, date) ?? { employeeId: employee.id, date, isRest: true }
    const attendance = attendanceFor(entries, employee.id, date)
    const status = schedule.unpaidLeave ? 'Sin goce' : schedule.isRest ? 'Descanso' : attendance?.clockOut ? 'Trabajado' : attendance ? 'En turno' : date < TODAY ? 'Sin registro' : date === TODAY ? 'Por iniciar' : 'Programado'
    return <article key={date} className={`${schedule.isRest ? 'rest' : ''} ${date === TODAY ? 'today' : ''}`}><header><span>{dayNames[index]}</span><b>{shortDate(date)}</b>{canEdit && <button aria-label={`Editar ${date}`} onClick={() => onEdit(schedule)}><Pencil size={12}/></button>}</header><strong>{schedule.unpaidLeave ? 'Día libre' : schedule.isRest ? 'Descanso' : `${schedule.shiftStart} – ${schedule.shiftEnd}`}</strong><small className={`shift-status ${status.toLowerCase().replace(' ', '-')}`}>{status}</small>{attendance && <div><span>Entrada <b>{attendance.clockIn}</b></span><span>Salida <b>{attendance.clockOut ?? '—'}</b></span></div>}</article>
  })}</div>{showPayroll && <footer><span>Pago semanal base dividido entre {payroll.planned || 0} días programados.</span><b>Estimación operativa; administración confirma el pago final el domingo.</b></footer>}</article>
}

function EmployeePortal({ employee, monday, schedules, entries, requests, onPunch, onRequest }: { employee: StaffMember; monday: string; schedules: StaffScheduleEntry[]; entries: StaffTimeEntry[]; requests: StaffRequest[]; onPunch: () => void; onRequest: (type: StaffRequestType) => void }) {
  const schedule = scheduleFor(schedules, employee.id, TODAY)
  const attendance = attendanceFor(entries, employee.id, TODAY)
  const completed = !!attendance?.clockOut
  return <>
    <section className="employee-self-head"><article className="today-shift-card"><div><span>MI TURNO DE HOY</span><h2>{schedule?.isRest ? 'Día de descanso' : schedule ? `${schedule.shiftStart} – ${schedule.shiftEnd}` : 'Sin horario'}</h2><p>{longDate(TODAY)} · {employee.role}</p></div><div className="punch-status">{attendance ? <><span>{completed ? 'TURNO TERMINADO' : 'EN TURNO'}</span><b>Entrada {attendance.clockIn}</b>{completed && <small>Salida {attendance.clockOut}</small>}</> : <><span>PENDIENTE</span><b>Registra tu llegada</b></>}</div><button disabled={!schedule || schedule.isRest || completed} onClick={onPunch}>{!attendance ? <LogIn size={17}/> : <LogOut size={17}/>} {!attendance ? 'Iniciar turno' : completed ? 'Turno registrado' : 'Terminar turno'}</button></article><article className="self-actions"><span>SOLICITUDES</span><h2>¿Necesitas ajustar tu semana?</h2><button onClick={() => onRequest('Cambio de descanso')}><CalendarDays size={15}/><span><b>Cambiar descanso</b><small>Propón otro día de esta semana</small></span></button><button onClick={() => onRequest('Día libre sin goce')}><UserRound size={15}/><span><b>Pedir día libre</b><small>Solicitud sin goce de sueldo</small></span></button></article></section>
    <EmployeeWeek employee={employee} monday={monday} schedules={schedules} entries={entries} onEdit={() => {}}/>
    <section className="panel my-requests"><header><div><span>MIS SOLICITUDES</span><h2>Seguimiento</h2></div></header><div>{requests.filter(request => request.employeeId === employee.id).map(request => <article key={request.id}><div><b>{request.type}</b><small>{shortDate(request.requestedDate)}{request.proposedDate ? ` → ${shortDate(request.proposedDate)}` : ''} · {request.reason}</small></div><span className={request.status.toLowerCase()}>{request.status}</span></article>)}</div></section>
  </>
}

function ScheduleDialog({ employee, entry, error, onChange, onClose, onSave }: { employee?: StaffMember; entry: StaffScheduleEntry; error: string; onChange: (entry: StaffScheduleEntry) => void; onClose: () => void; onSave: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section className="staff-dialog" role="dialog" aria-modal="true" aria-label="Editar horario"><header><div><span>{employee?.name} · {employee?.role}</span><h2>Editar {longDate(entry.date)}</h2></div><button onClick={onClose} aria-label="Cerrar"><X size={18}/></button></header><div className="schedule-dialog-body"><label className="rest-toggle"><input type="checkbox" checked={entry.isRest} onChange={event => onChange({ ...entry, isRest: event.target.checked, unpaidLeave: false, shiftStart: event.target.checked ? undefined : entry.shiftStart ?? '08:00', shiftEnd: event.target.checked ? undefined : entry.shiftEnd ?? '16:00' })}/><span>Marcar como día de descanso</span></label>{!entry.isRest && <div><label><span>Hora de entrada</span><input type="time" value={entry.shiftStart ?? ''} onChange={event => onChange({ ...entry, shiftStart: event.target.value })}/></label><label><span>Hora de salida</span><input type="time" value={entry.shiftEnd ?? ''} onChange={event => onChange({ ...entry, shiftEnd: event.target.value })}/></label></div>}{error && <p className="staff-form-error"><AlertTriangle size={14}/>{error}</p>}</div><footer><button onClick={onClose}>Cancelar</button><button className="primary-action" onClick={onSave}>Guardar horario</button></footer></section></div>
}

function RequestDialog({ employee, draft, error, onChange, onClose, onSave }: { employee?: StaffMember; draft: RequestDraft; error: string; onChange: (draft: RequestDraft) => void; onClose: () => void; onSave: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section className="staff-dialog" role="dialog" aria-modal="true" aria-label="Nueva solicitud"><header><div><span>{employee?.name} · {employee?.role}</span><h2>{draft.type}</h2><p>Administración revisará la solicitud antes de modificar el horario.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={18}/></button></header><div className="staff-request-form"><label><span>{draft.type === 'Cambio de descanso' ? 'Descanso actual' : 'Día solicitado'}</span><input type="date" value={draft.requestedDate} onChange={event => onChange({ ...draft, requestedDate: event.target.value })}/></label>{draft.type === 'Cambio de descanso' && <label><span>Nuevo descanso solicitado</span><input type="date" value={draft.proposedDate} onChange={event => onChange({ ...draft, proposedDate: event.target.value })}/></label>}<label className="full"><span>Motivo</span><textarea value={draft.reason} onChange={event => onChange({ ...draft, reason: event.target.value })} placeholder="Explica brevemente el motivo…"/></label>{error && <p className="staff-form-error full"><AlertTriangle size={14}/>{error}</p>}</div><footer><button onClick={onClose}>Cancelar</button><button className="primary-action" onClick={onSave}>Enviar solicitud</button></footer></section></div>
}
