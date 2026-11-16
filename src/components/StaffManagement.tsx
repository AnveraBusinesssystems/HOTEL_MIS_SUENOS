import { useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Search, Trash2, UserRoundPlus, UserX, X } from 'lucide-react'
import type { StaffMember, StaffRole, StaffScheduleEntry, StaffRequest, StaffTimeEntry, UserAccount } from '../types'
import { money } from '../utils'

type Props = {
  staff: StaffMember[]
  schedules: StaffScheduleEntry[]
  entries: StaffTimeEntry[]
  requests: StaffRequest[]
  accounts: UserAccount[]
  onStaffChange: (update: (rows: StaffMember[]) => StaffMember[]) => void
  onSchedulesChange: (update: (rows: StaffScheduleEntry[]) => StaffScheduleEntry[]) => void
  onAccountsChange: (update: (rows: UserAccount[]) => UserAccount[]) => void
  onNotify: (message: string) => void
}

const roles: StaffRole[] = ['Gerencia', 'Administración', 'Recepción', 'Cocina', 'Limpieza', 'Alberca']
const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const dateUTC = (value: string) => new Date(value + 'T12:00:00Z')
const dateKey = (value: Date) => value.toISOString().slice(0, 10)
const shiftDate = (value: string, offset: number) => { const date = dateUTC(value); date.setUTCDate(date.getUTCDate() + offset); return dateKey(date) }
const mondayOf = (value: string) => { const day = dateUTC(value).getUTCDay(); return shiftDate(value, -(day === 0 ? 6 : day - 1)) }
const hotelToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const rangeDates = (start: string, size: number) => Array.from({ length: size }, (_, i) => shiftDate(start, i))
const displayDate = (value: string) => new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(dateUTC(value))
const periodLabel = (start: string, end: string) => displayDate(start) + ' – ' + displayDate(end)
const sameSchedule = (a: StaffScheduleEntry, b: StaffScheduleEntry) => a.employeeId === b.employeeId && a.date === b.date
const isWorking = (employeeId: string, entries: StaffTimeEntry[], today: string) => entries.some(item => item.employeeId === employeeId && item.date === today && !item.clockOut)

type Draft = { id?: string; name: string; role: StaffRole; weeklySalary: string; defaultShiftStart: string; defaultShiftEnd: string; defaultRestDay: number }
const blankEmployee = (): Draft => ({ name: '', role: 'Recepción', weeklySalary: '', defaultShiftStart: '08:00', defaultShiftEnd: '16:00', defaultRestDay: 0 })
const asDraft = (employee: StaffMember): Draft => ({ id: employee.id, name: employee.name, role: employee.role, weeklySalary: String(employee.weeklySalary), defaultShiftStart: employee.defaultShiftStart, defaultShiftEnd: employee.defaultShiftEnd, defaultRestDay: employee.defaultRestDay })

export function StaffManagement({ staff, schedules, entries, requests, accounts, onStaffChange, onSchedulesChange, onAccountsChange, onNotify }: Props) {
  const today = hotelToday()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(mondayOf(today))
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkStart, setBulkStart] = useState('08:00')
  const [bulkEnd, setBulkEnd] = useState('16:00')
  const [bulkRest, setBulkRest] = useState(false)
  const [bulkDay, setBulkDay] = useState('all')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [activeMode, setActiveMode] = useState<'planner' | 'team'>('planner')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const activeStaff = staff.filter(employee => employee.status === 'Activo')
  const visibleStaff = activeStaff.filter(employee => (!filter || employee.role === filter) && (!search || employee.name.toLowerCase().includes(search.toLowerCase())))
  const periodStart = view === 'week' ? mondayOf(anchor) : anchor.slice(0, 7) + '-01'
  const periodEnd = view === 'week' ? shiftDate(periodStart, 6) : shiftDate(shiftDate(periodStart.slice(0, 7) + '-01', 32).slice(0, 7) + '-01', -1)
  const periodDates = useMemo(() => {
    const size = Math.round((dateUTC(periodEnd).getTime() - dateUTC(periodStart).getTime()) / 86400000) + 1
    return rangeDates(periodStart, size)
  }, [periodStart, periodEnd])
  const visibleDates = view === 'week' ? periodDates : periodDates
  const currentShift = (id: string, date: string) => schedules.find(entry => entry.employeeId === id && entry.date === date)
  const rosterCount = visibleStaff.reduce((count, employee) => count + periodDates.filter(date => currentShift(employee.id, date)?.isRest === false).length, 0)
  const uncovered = visibleStaff.filter(employee => !currentShift(employee.id, today) && employee.status === 'Activo').length
  const movePeriod = (delta: number) => setAnchor(current => view === 'week' ? shiftDate(mondayOf(current), delta * 7) : (() => { const d = dateUTC(current.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() + delta); return dateKey(d) })())
  const targetIds = selected.length ? selected.filter(id => activeStaff.some(item => item.id === id)) : visibleStaff.map(item => item.id)
  const toggleEmployee = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const mergeSchedule = (incoming: StaffScheduleEntry[]) => {
    onSchedulesChange(rows => {
      const map = new Map(rows.map(row => [row.employeeId + '|' + row.date, row]))
      incoming.forEach(row => map.set(row.employeeId + '|' + row.date, row))
      return [...map.values()]
    })
  }
  const applyBulk = () => {
    if (!targetIds.length) { setError('Selecciona al menos un empleado.'); return }
    if (!bulkRest && bulkEnd <= bulkStart) { setError('La hora de salida debe ser posterior a la entrada.'); return }
    const changes: StaffScheduleEntry[] = []
    for (const id of targetIds) for (const date of periodDates) {
      const weekday = dateUTC(date).getUTCDay()
      if (bulkDay !== 'all' && weekday !== Number(bulkDay)) continue
      const previous = currentShift(id, date)
      if (previous?.unpaidLeave) continue
      changes.push({ employeeId: id, date, isRest: bulkRest, unpaidLeave: false, shiftStart: bulkRest ? undefined : bulkStart, shiftEnd: bulkRest ? undefined : bulkEnd })
    }
    if (!changes.length) { setError('No hay turnos editables en el periodo.'); return }
    mergeSchedule(changes)
    setBulkOpen(false); setError('')
    onNotify(changes.length + ' turnos actualizados en esta vista (sin sincronizar)')
  }
  const populateDefaults = () => {
    const changes: StaffScheduleEntry[] = []
    for (const employee of visibleStaff) for (const date of periodDates) {
      if (currentShift(employee.id, date)) continue
      const rest = dateUTC(date).getUTCDay() === employee.defaultRestDay
      changes.push({ employeeId: employee.id, date, isRest: rest, shiftStart: rest ? undefined : employee.defaultShiftStart, shiftEnd: rest ? undefined : employee.defaultShiftEnd })
    }
    if (!changes.length) { onNotify('El periodo ya tiene horarios asignados'); return }
    mergeSchedule(changes)
    onNotify(changes.length + ' turnos creados con horarios habituales (sin sincronizar)')
  }
  const copyPrevious = () => {
    const offset = view === 'week' ? 7 : periodDates.length
    const sourceDates = rangeDates(shiftDate(periodStart, -offset), offset)
    const changes: StaffScheduleEntry[] = []
    for (const employee of visibleStaff) for (let i = 0; i < periodDates.length; i++) {
      const source = sourceDates[i % sourceDates.length]
      const original = currentShift(employee.id, source)
      if (!original || original.unpaidLeave || currentShift(employee.id, periodDates[i])) continue
      changes.push({ ...original, date: periodDates[i] })
    }
    if (!changes.length) { onNotify('Sin turnos anteriores disponibles para copiar o todos los días ya están asignados'); return }
    mergeSchedule(changes)
    onNotify(changes.length + ' turnos copiados sin sobrescribir los existentes (sin sincronizar)')
  }
  const setShift = (employee: StaffMember, date: string) => {
    const current = currentShift(employee.id, date)
    setError('')
    setShiftDraft(current ?? { employeeId: employee.id, date, isRest: dateUTC(date).getUTCDay() === employee.defaultRestDay, shiftStart: employee.defaultShiftStart, shiftEnd: employee.defaultShiftEnd })
  }
  const [shiftDraft, setShiftDraft] = useState<StaffScheduleEntry | null>(null)
  const saveShift = () => {
    if (!shiftDraft) return
    if (!shiftDraft.isRest && (!shiftDraft.shiftStart || !shiftDraft.shiftEnd || shiftDraft.shiftEnd <= shiftDraft.shiftStart)) { setError('Especifica un turno válido con salida posterior a la entrada.'); return }
    if (shiftDraft.unpaidLeave) { setError('Un permiso sin goce aprobado se modifica desde Solicitudes.'); return }
    mergeSchedule([{ ...shiftDraft, shiftStart: shiftDraft.isRest ? undefined : shiftDraft.shiftStart, shiftEnd: shiftDraft.isRest ? undefined : shiftDraft.shiftEnd }])
    setShiftDraft(null); setError(''); onNotify('Horario actualizado localmente')
  }
  const saveEmployee = () => {
    if (!draft) return
    const salary = Number(draft.weeklySalary)
    if (!draft.name.trim() || !Number.isFinite(salary) || salary <= 0) { setError('Agrega nombre y salario semanal válido.'); return }
    if (draft.defaultShiftEnd <= draft.defaultShiftStart) { setError('Revisa las horas del turno habitual.'); return }
    if (draft.id) {
      onStaffChange(rows => rows.map(employee => employee.id === draft.id ? { ...employee, name: draft.name.trim(), role: draft.role, weeklySalary: salary, defaultShiftStart: draft.defaultShiftStart, defaultShiftEnd: draft.defaultShiftEnd, defaultRestDay: draft.defaultRestDay } : employee))
      onAccountsChange(rows => rows.map(account => account.employeeId === draft.id ? { ...account, role: draft.role } : account))
      onNotify('Perfil actualizado localmente')
    } else {
      const next = Math.max(0, ...staff.map(employee => Number(employee.id.replace('EMP-', '')) || 0)) + 1
      const employee: StaffMember = { id: 'EMP-' + String(next).padStart(3, '0'), name: draft.name.trim(), role: draft.role, weeklySalary: salary, defaultShiftStart: draft.defaultShiftStart, defaultShiftEnd: draft.defaultShiftEnd, defaultRestDay: draft.defaultRestDay, status: 'Activo' }
      onStaffChange(rows => [...rows, employee])
      onNotify('Empleado agregado localmente. Acceso al sistema pendiente en Configuración.')
    }
    setDraft(null); setError('')
  }
  const deactivate = (employee: StaffMember) => {
    onStaffChange(rows => rows.map(item => item.id === employee.id ? { ...item, status: employee.status === 'Activo' ? 'Inactivo' : 'Activo' } : item))
    if (employee.status === 'Activo') onAccountsChange(rows => rows.map(account => account.employeeId === employee.id ? { ...account, status: 'Inactivo' } : account))
    onNotify(employee.status === 'Activo' ? 'Empleado dado de baja y acceso desactivado localmente' : 'Empleado reactivado; revisa su acceso en Configuración')
    setConfirmId(null)
  }
  const erase = (employee: StaffMember) => {
    const history = entries.some(item => item.employeeId === employee.id) || requests.some(item => item.employeeId === employee.id)
    if (history) { setError('Este empleado tiene historial de asistencia o solicitudes: usa Dar de baja para conservarlo.'); return }
    onStaffChange(rows => rows.filter(item => item.id !== employee.id))
    onAccountsChange(rows => rows.filter(item => item.employeeId !== employee.id))
    onSchedulesChange(rows => rows.filter(item => item.employeeId !== employee.id))
    setConfirmId(null); setError(''); onNotify('Registro sin historial eliminado localmente')
  }

  return <section className="staff-admin-module">
    <div className="staff-admin-tabs">
      <button className={activeMode === 'planner' ? 'active' : ''} onClick={() => setActiveMode('planner')}><CalendarDays size={16}/> Planificador</button>
      <button className={activeMode === 'team' ? 'active' : ''} onClick={() => setActiveMode('team')}><UserRoundPlus size={16}/> Directorio y perfiles</button>
    </div>

    {activeMode === 'planner' ? <>
      <div className="staff-admin-toolbar">
        <div><span className="staff-overline">PLANIFICACIÓN DE TURNOS</span><h2>Calendario del equipo</h2><p>Edita turnos individuales o asigna un periodo completo. Los cambios aún son locales.</p></div>
        <div className="staff-admin-actions"><button onClick={populateDefaults}><Plus size={15}/> Completar vacíos</button><button onClick={copyPrevious}><Copy size={15}/> Copiar anterior</button><button className="staff-primary" onClick={() => { setError(''); setBulkOpen(true) }}><CalendarDays size={15}/> Asignar en lote</button></div>
      </div>
      <div className="staff-planner-controls">
        <div className="staff-period"><button aria-label="Periodo anterior" onClick={() => movePeriod(-1)}><ChevronLeft size={17}/></button><strong>{periodLabel(periodStart, periodEnd)}</strong><button aria-label="Periodo siguiente" onClick={() => movePeriod(1)}><ChevronRight size={17}/></button><button onClick={() => setAnchor(mondayOf(today))}>Hoy</button></div>
        <div className="staff-view-toggle"><button className={view === 'week' ? 'active' : ''} onClick={() => { setView('week'); setAnchor(mondayOf(anchor)) }}>Semana</button><button className={view === 'month' ? 'active' : ''} onClick={() => { setView('month'); setAnchor(anchor.slice(0, 7) + '-01') }}>Mes</button></div>
        <label className="staff-filter"><Search size={15}/><input aria-label="Buscar empleado" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empleado"/></label>
        <select aria-label="Filtrar departamento" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Todas las áreas</option>{roles.map(role => <option key={role}>{role}</option>)}</select>
      </div>
      <div className="staff-plan-metrics"><span><b>{visibleStaff.length}</b> empleados visibles</span><span><b>{rosterCount}</b> turnos asignados</span><span><b>{uncovered}</b> sin horario hoy</span><span>Marca empleados para asignar en lote; sin selección se usarán todos los visibles.</span></div>
      <div className="staff-schedule-scroll">
        <table className="staff-schedule-table"><thead><tr><th className="staff-sticky-name">Empleado</th>{visibleDates.map(date => <th key={date} className={date === today ? 'staff-today' : ''}>{days[(dateUTC(date).getUTCDay() + 6) % 7]}<small>{date.slice(8)}</small></th>)}</tr></thead>
          <tbody>{visibleStaff.map(employee => <tr key={employee.id}><th className="staff-sticky-name"><label><input type="checkbox" checked={selected.includes(employee.id)} onChange={() => toggleEmployee(employee.id)}/><span><b>{employee.name}</b><small>{employee.role}</small></span></label></th>{visibleDates.map(date => {
            const shift = currentShift(employee.id, date)
            return <td key={date} className={date === today ? 'staff-today' : ''}><button className={'staff-shift-cell ' + (shift?.unpaidLeave ? 'leave' : !shift ? 'empty' : shift.isRest ? 'rest' : 'assigned')} onClick={() => setShift(employee, date)} title={employee.name + ' · ' + date}>{!shift ? '+' : shift.unpaidLeave ? 'Sin goce' : shift.isRest ? 'Descanso' : <><b>{shift.shiftStart}</b><small>{shift.shiftEnd}</small></>}</button></td>
          })}</tr>)}</tbody></table>
      </div>
      {visibleStaff.length === 0 && <p className="staff-admin-empty">No hay empleados activos para ese filtro. Puedes agregarlos desde Directorio y perfiles.</p>}
      <p className="staff-planner-hint">En teléfonos también puedes tocar cada turno en el calendario desplazable para editarlo. Los días sin horario aparecen con +. Los permisos aprobados no se sobrescriben masivamente.</p>
    </> : <>
      <div className="staff-admin-toolbar"><div><span className="staff-overline">GESTIÓN DE PERSONAL</span><h2>Directorio y perfiles</h2><p>Altas, cambios de puesto, turnos habituales y bajas desde Personal.</p></div><button className="staff-primary" onClick={() => { setDraft(blankEmployee()); setError('') }}><Plus size={16}/> Añadir empleado</button></div>
      <div className="staff-team-summary"><span><b>{activeStaff.length}</b> Activos</span><span><b>{staff.length - activeStaff.length}</b> Inactivos</span><span><b>{money(activeStaff.reduce((sum, employee) => sum + employee.weeklySalary, 0))}</b> Nómina base semanal</span></div>
      <div className="staff-team-grid">{staff.map(employee => <article className="staff-team-card" key={employee.id}>
        <div className="staff-team-head"><span className="staff-avatar">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><h3>{employee.name}</h3><small>{employee.id} · {employee.role}</small></div><em className={employee.status === 'Activo' ? 'staff-status-on' : 'staff-status-off'}>{employee.status}</em></div>
        <div className="staff-team-facts"><span>Salario semanal <b>{money(employee.weeklySalary)}</b></span><span>Turno habitual <b>{employee.defaultShiftStart} – {employee.defaultShiftEnd}</b></span><span>Hoy <b>{isWorking(employee.id, entries, today) ? 'En turno' : currentShift(employee.id, today)?.isRest ? 'Descanso' : currentShift(employee.id, today) ? 'Sin entrada registrada' : 'Sin horario'}</b></span></div>
        <footer><button onClick={() => { setDraft(asDraft(employee)); setError('') }}><Pencil size={14}/> Editar</button><button onClick={() => { setConfirmId(employee.id); setError('') }}><UserX size={14}/> {employee.status === 'Activo' ? 'Dar de baja' : 'Reactivar / eliminar'}</button></footer>
      </article>)}</div>
      {!staff.length && <p className="staff-admin-empty">No hay empleados registrados. Comienza con Añadir empleado.</p>}
    </>}

    {bulkOpen && <div className="dialog-backdrop" role="presentation"><section className="staff-admin-dialog" role="dialog" aria-modal="true" aria-label="Asignar horarios en lote"><header><div><span className="staff-overline">PLANIFICACIÓN</span><h2>Asignar turnos en lote</h2><p>{targetIds.length} empleados · {periodLabel(periodStart, periodEnd)}</p></div><button aria-label="Cerrar" onClick={() => setBulkOpen(false)}><X size={18}/></button></header><div className="staff-admin-form"><label>Aplicar a<select value={bulkDay} onChange={event => setBulkDay(event.target.value)}><option value="all">Todos los días del periodo</option>{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label className="staff-check"><input type="checkbox" checked={bulkRest} onChange={event => setBulkRest(event.target.checked)}/> Marcar como descanso</label>{!bulkRest && <><label>Entrada<input type="time" value={bulkStart} onChange={event => setBulkStart(event.target.value)}/></label><label>Salida<input type="time" value={bulkEnd} onChange={event => setBulkEnd(event.target.value)}/></label></>}<p className="staff-form-note">Se reemplazarán los turnos elegidos, salvo días libres sin goce aprobados. Revisa la selección antes de aplicar.</p>{error && <p className="staff-admin-error">{error}</p>}</div><footer><button onClick={() => setBulkOpen(false)}>Cancelar</button><button className="staff-primary" onClick={applyBulk}><Check size={15}/> Aplicar horarios</button></footer></section></div>}
    {shiftDraft && <div className="dialog-backdrop" role="presentation"><section className="staff-admin-dialog" role="dialog" aria-modal="true" aria-label="Editar turno"><header><div><span className="staff-overline">HORARIO INDIVIDUAL</span><h2>{staff.find(item => item.id === shiftDraft.employeeId)?.name}</h2><p>{displayDate(shiftDraft.date)}</p></div><button aria-label="Cerrar" onClick={() => setShiftDraft(null)}><X size={18}/></button></header><div className="staff-admin-form"><label className="staff-check"><input type="checkbox" checked={shiftDraft.isRest} onChange={event => setShiftDraft({ ...shiftDraft, isRest: event.target.checked })}/> Día de descanso</label>{!shiftDraft.isRest && <><label>Entrada<input type="time" value={shiftDraft.shiftStart ?? ''} onChange={event => setShiftDraft({ ...shiftDraft, shiftStart: event.target.value })}/></label><label>Salida<input type="time" value={shiftDraft.shiftEnd ?? ''} onChange={event => setShiftDraft({ ...shiftDraft, shiftEnd: event.target.value })}/></label></>}{shiftDraft.unpaidLeave && <p className="staff-form-note">Día libre sin goce aprobado; modifícalo desde Solicitudes.</p>}{error && <p className="staff-admin-error">{error}</p>}</div><footer><button onClick={() => setShiftDraft(null)}>Cancelar</button><button className="staff-primary" onClick={saveShift}>Guardar turno</button></footer></section></div>}
    {draft && <div className="dialog-backdrop" role="presentation"><section className="staff-admin-dialog" role="dialog" aria-modal="true" aria-label="Perfil de empleado"><header><div><span className="staff-overline">EQUIPO</span><h2>{draft.id ? 'Editar empleado' : 'Añadir empleado'}</h2></div><button aria-label="Cerrar" onClick={() => setDraft(null)}><X size={18}/></button></header><div className="staff-admin-form"><label className="wide">Nombre completo<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/></label><label>Puesto<select value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value as StaffRole })}>{roles.map(role => <option key={role}>{role}</option>)}</select></label><label>Salario semanal (MXN)<input type="number" min="1" value={draft.weeklySalary} onChange={event => setDraft({ ...draft, weeklySalary: event.target.value })}/></label><label>Entrada habitual<input type="time" value={draft.defaultShiftStart} onChange={event => setDraft({ ...draft, defaultShiftStart: event.target.value })}/></label><label>Salida habitual<input type="time" value={draft.defaultShiftEnd} onChange={event => setDraft({ ...draft, defaultShiftEnd: event.target.value })}/></label><label className="wide">Descanso habitual<select value={draft.defaultRestDay} onChange={event => setDraft({ ...draft, defaultRestDay: Number(event.target.value) })}>{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><p className="staff-form-note">Crear un empleado no crea automáticamente su cuenta de acceso. Por ahora los registros no se guardan en Sheets.</p>{error && <p className="staff-admin-error">{error}</p>}</div><footer><button onClick={() => setDraft(null)}>Cancelar</button><button className="staff-primary" onClick={saveEmployee}>{draft.id ? 'Guardar cambios' : 'Agregar empleado'}</button></footer></section></div>}
    {confirmId && (() => { const employee = staff.find(item => item.id === confirmId); if (!employee) return null; return <div className="dialog-backdrop" role="presentation"><section className="staff-admin-dialog" role="dialog" aria-modal="true" aria-label="Gestionar baja"><header><div><span className="staff-overline">CONTROL DE REGISTROS</span><h2>{employee.name}</h2></div><button aria-label="Cerrar" onClick={() => setConfirmId(null)}><X size={18}/></button></header><p className="staff-confirm-text">Dar de baja conserva los horarios, las asistencias y solicitudes históricas. Eliminar permanentemente solo está permitido si no existe historial de asistencia o solicitudes.</p>{error && <p className="staff-admin-error">{error}</p>}<footer><button onClick={() => setConfirmId(null)}>Cancelar</button>{employee.status === 'Inactivo' && <button className="staff-danger" onClick={() => erase(employee)}><Trash2 size={14}/> Eliminar</button>}<button className="staff-primary" onClick={() => deactivate(employee)}>{employee.status === 'Activo' ? 'Confirmar baja' : 'Reactivar'}</button></footer></section></div> })()}
  </section>
}
