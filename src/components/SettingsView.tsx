import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Clock3, KeyRound, Plus, Save, Search,
  ShieldCheck, UserRound, Users, WalletCards, X,
} from 'lucide-react'
import type {
  AccessLevel, Role, StaffMember, StaffRole, StaffScheduleEntry, SystemModule, UserAccount,
} from '../types'
import { money } from '../utils'

type Props = {
  role: Role
  staff: StaffMember[]
  accounts: UserAccount[]
  onStaffChange: (updater: (rows: StaffMember[]) => StaffMember[]) => void
  onAccountsChange: (updater: (rows: UserAccount[]) => UserAccount[]) => void
  onSchedulesChange: (updater: (rows: StaffScheduleEntry[]) => StaffScheduleEntry[]) => void
  onNotify: (message: string) => void
}

type NewEmployee = {
  name: string
  role: StaffRole
  weeklySalary: string
  defaultShiftStart: string
  defaultShiftEnd: string
  defaultRestDay: number
  createAccess: boolean
  username: string
}

const staffRoles: StaffRole[] = ['Gerencia', 'Administración', 'Recepción', 'Cocina', 'Limpieza', 'Alberca']
const modules: SystemModule[] = ['Resumen', 'Indicadores', 'RMS / Tarifas', 'Reservas', 'Operación diaria', 'Caja', 'Inventario', 'Personal']
const levels: AccessLevel[] = ['Sin acceso', 'Ver', 'Editar']
const restDays = [{ value: 1, label: 'Lunes' }, { value: 2, label: 'Martes' }, { value: 3, label: 'Miércoles' }, { value: 4, label: 'Jueves' }, { value: 5, label: 'Viernes' }, { value: 6, label: 'Sábado' }, { value: 0, label: 'Domingo' }]
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const minutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
const iso = (date: Date) => date.toISOString().slice(0, 10)
const moveDays = (value: string, amount: number) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + amount); return iso(date) }

const permissionsFor = (role: StaffRole): UserAccount['permissions'] => {
  const base: UserAccount['permissions'] = { Resumen: 'Ver', Indicadores: 'Sin acceso', 'RMS / Tarifas': 'Sin acceso', Reservas: 'Sin acceso', 'Operación diaria': 'Sin acceso', Caja: 'Sin acceso', Inventario: 'Sin acceso', Personal: 'Ver' }
  if (role === 'Gerencia') return Object.fromEntries(modules.map(module => [module, 'Editar'])) as UserAccount['permissions']
  if (role === 'Administración') return { ...base, Indicadores: 'Ver', Reservas: 'Ver', 'Operación diaria': 'Editar', Caja: 'Editar', Inventario: 'Editar', Personal: 'Editar' }
  if (role === 'Recepción') return { ...base, Reservas: 'Editar', 'Operación diaria': 'Editar', Caja: 'Editar', Inventario: 'Editar' }
  if (role === 'Limpieza') return { ...base, 'Operación diaria': 'Editar' }
  if (role === 'Cocina') return { ...base, 'Operación diaria': 'Ver', Inventario: 'Editar' }
  return { ...base, 'Operación diaria': 'Ver' }
}

const freshEmployee = (): NewEmployee => ({ name: '', role: 'Recepción', weeklySalary: '', defaultShiftStart: '08:00', defaultShiftEnd: '16:00', defaultRestDay: 0, createAccess: true, username: '' })

export function SettingsView({ role, staff, accounts, onStaffChange, onAccountsChange, onSchedulesChange, onNotify }: Props) {
  const canAccess = role === 'Dueño' || role === 'Gerencia'
  const [selectedId, setSelectedId] = useState(staff[0]?.id ?? '')
  const [employeeDraft, setEmployeeDraft] = useState<StaffMember | null>(staff[0] ? { ...staff[0] } : null)
  const [accountDraft, setAccountDraft] = useState<UserAccount | null>(null)
  const [accessEnabled, setAccessEnabled] = useState(false)
  const [search, setSearch] = useState('')
  const [newEmployee, setNewEmployee] = useState<NewEmployee | null>(null)
  const [error, setError] = useState('')

  const selectEmployee = (employeeId: string) => {
    const employee = staff.find(item => item.id === employeeId)
    const account = accounts.find(item => item.employeeId === employeeId)
    setSelectedId(employeeId)
    setEmployeeDraft(employee ? { ...employee } : null)
    setAccountDraft(account ? { ...account, permissions: { ...account.permissions } } : null)
    setAccessEnabled(account?.status === 'Activo')
    setError('')
  }

  useEffect(() => {
    if (selectedId) selectEmployee(selectedId)
  }, [])

  const filteredStaff = useMemo(() => staff.filter(employee => !search.trim() || `${employee.name} ${employee.role} ${employee.id}`.toLowerCase().includes(search.trim().toLowerCase())), [search, staff])
  const activeEmployees = staff.filter(employee => employee.status === 'Activo').length
  const activeAccounts = accounts.filter(account => account.status === 'Activo').length
  const weeklyPayroll = staff.filter(employee => employee.status === 'Activo').reduce((sum, employee) => sum + employee.weeklySalary, 0)
  const withoutAccess = staff.filter(employee => employee.status === 'Activo' && !accounts.some(account => account.employeeId === employee.id && account.status === 'Activo')).length

  if (!canAccess) return <section className="page"><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>Acceso restringido</h1><p>Solamente Dueño y Gerencia pueden administrar usuarios, salarios y permisos.</p></div></div></section>

  const toggleAccess = (enabled: boolean) => {
    setAccessEnabled(enabled)
    if (enabled && employeeDraft && !accountDraft) {
      setAccountDraft({
        id: `USR-${Date.now()}`, employeeId: employeeDraft.id,
        username: employeeDraft.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''),
        role: employeeDraft.role, status: 'Activo', permissions: permissionsFor(employeeDraft.role),
      })
    }
  }

  const updateEmployeeRole = (nextRole: StaffRole) => {
    setEmployeeDraft(current => current ? { ...current, role: nextRole } : current)
    setAccountDraft(current => current ? { ...current, role: nextRole, permissions: permissionsFor(nextRole) } : current)
  }

  const saveProfile = () => {
    if (!employeeDraft) return
    if (!employeeDraft.name.trim()) { setError('El nombre del trabajador es obligatorio.'); return }
    if (!Number.isFinite(employeeDraft.weeklySalary) || employeeDraft.weeklySalary <= 0) { setError('Ingresa un salario semanal válido.'); return }
    if (minutes(employeeDraft.defaultShiftEnd) <= minutes(employeeDraft.defaultShiftStart)) { setError('La salida debe ser posterior a la entrada.'); return }
    if (accessEnabled && !accountDraft?.username.trim()) { setError('Escribe un nombre de usuario.'); return }
    if (accessEnabled && accounts.some(account => account.id !== accountDraft?.id && account.username.toLowerCase() === accountDraft?.username.trim().toLowerCase())) { setError('Ese nombre de usuario ya está ocupado.'); return }

    const savedEmployee = { ...employeeDraft, name: employeeDraft.name.trim() }
    onStaffChange(rows => rows.map(employee => employee.id === savedEmployee.id ? savedEmployee : employee))
    if (accountDraft) {
      const savedAccount = { ...accountDraft, employeeId: savedEmployee.id, username: accountDraft.username.trim().toLowerCase(), role: savedEmployee.role, status: accessEnabled && savedEmployee.status === 'Activo' ? 'Activo' as const : 'Inactivo' as const }
      onAccountsChange(rows => rows.some(account => account.id === savedAccount.id) ? rows.map(account => account.id === savedAccount.id ? savedAccount : account) : [...rows, savedAccount])
      setAccountDraft(savedAccount)
    }
    setError('')
    onNotify('Datos y permisos guardados')
  }

  const createEmployee = () => {
    if (!newEmployee) return
    const salary = Number(newEmployee.weeklySalary)
    if (!newEmployee.name.trim()) { setError('El nombre del trabajador es obligatorio.'); return }
    if (!Number.isFinite(salary) || salary <= 0) { setError('Ingresa un salario semanal válido.'); return }
    if (minutes(newEmployee.defaultShiftEnd) <= minutes(newEmployee.defaultShiftStart)) { setError('La salida debe ser posterior a la entrada.'); return }
    if (newEmployee.createAccess && !newEmployee.username.trim()) { setError('Escribe un nombre de usuario.'); return }
    if (newEmployee.createAccess && accounts.some(account => account.username.toLowerCase() === newEmployee.username.trim().toLowerCase())) { setError('Ese nombre de usuario ya está ocupado.'); return }

    const nextNumber = Math.max(0, ...staff.map(employee => Number(employee.id.replace('EMP-', '')) || 0)) + 1
    const id = `EMP-${String(nextNumber).padStart(3, '0')}`
    const employee: StaffMember = { id, name: newEmployee.name.trim(), role: newEmployee.role, weeklySalary: salary, defaultShiftStart: newEmployee.defaultShiftStart, defaultShiftEnd: newEmployee.defaultShiftEnd, defaultRestDay: newEmployee.defaultRestDay, status: 'Activo' }
    const newAccount: UserAccount | null = newEmployee.createAccess ? { id: `USR-${Date.now()}`, employeeId: id, username: newEmployee.username.trim().toLowerCase(), role: employee.role, status: 'Activo', permissions: permissionsFor(employee.role) } : null
    onStaffChange(rows => [...rows, employee])
    onSchedulesChange(rows => [...rows, ...Array.from({ length: 28 }, (_, index) => {
      const date = moveDays(TODAY, index)
      const isRest = new Date(`${date}T12:00:00`).getDay() === employee.defaultRestDay
      return { employeeId: id, date, isRest, shiftStart: isRest ? undefined : employee.defaultShiftStart, shiftEnd: isRest ? undefined : employee.defaultShiftEnd }
    })])
    if (newAccount) onAccountsChange(rows => [...rows, newAccount])
    setNewEmployee(null)
    setSelectedId(id)
    setEmployeeDraft(employee)
    setAccessEnabled(newEmployee.createAccess)
    setAccountDraft(newAccount)
    setError('')
    onNotify(`${employee.name} fue agregado al personal`)
  }

  return <section className="page settings-page">
    <section className="page-heading settings-heading"><div><p className="eyebrow">CONTROL DE ACCESO</p><h1>Usuarios y personal</h1><p>Datos laborales, salario semanal y permisos esenciales en una sola pantalla.</p></div><button onClick={() => { setError(''); setNewEmployee(freshEmployee()) }}><Plus size={15}/>Agregar trabajador</button></section>

    <section className="settings-summary">
      <article><span><Users size={14}/>Personal activo</span><strong>{activeEmployees}</strong><small>{staff.length - activeEmployees} inactivos</small></article>
      <article><span><KeyRound size={14}/>Usuarios activos</span><strong>{activeAccounts}</strong><small>{withoutAccess} trabajadores sin acceso</small></article>
      <article><span><WalletCards size={14}/>Nómina base semanal</span><strong>{money(weeklyPayroll)}</strong><small>Antes de faltas y ajustes</small></article>
    </section>

    <div className="settings-layout">
      <aside className="panel settings-roster"><header><div><span>TRABAJADORES</span><h2>{filteredStaff.length} registros</h2></div></header><div className="settings-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar trabajador…"/></div><div className="settings-roster-list">{filteredStaff.map(employee => {
        const account = accounts.find(item => item.employeeId === employee.id)
        return <button key={employee.id} className={selectedId === employee.id ? 'active' : ''} onClick={() => selectEmployee(employee.id)}><span className="settings-avatar">{employee.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span><b>{employee.name}</b><small>{employee.role} · {employee.id}</small></span><em className={employee.status.toLowerCase()}>{employee.status}</em><small className={account?.status === 'Activo' ? 'has-access' : ''}>{account?.status === 'Activo' ? 'Con acceso' : 'Sin acceso'}</small></button>
      })}</div></aside>

      {employeeDraft && <section className="settings-detail">
        <article className="panel employment-card"><header><div><span>DATOS LABORALES</span><h2>{employeeDraft.name}</h2></div><label className={`employee-state ${employeeDraft.status.toLowerCase()}`}><select value={employeeDraft.status} onChange={event => setEmployeeDraft({ ...employeeDraft, status: event.target.value as StaffMember['status'] })}><option>Activo</option><option>Inactivo</option></select></label></header><div className="employment-form"><label><span>Nombre completo</span><input value={employeeDraft.name} onChange={event => setEmployeeDraft({ ...employeeDraft, name: event.target.value })}/></label><label><span>Área o puesto</span><select value={employeeDraft.role} onChange={event => updateEmployeeRole(event.target.value as StaffRole)}>{staffRoles.filter(item => role === 'Dueño' || item !== 'Gerencia').map(item => <option key={item}>{item}</option>)}</select></label><label><span>Salario semanal</span><div className="settings-money"><i>$</i><input type="number" min="0" value={employeeDraft.weeklySalary} onChange={event => setEmployeeDraft({ ...employeeDraft, weeklySalary: Number(event.target.value) })}/></div></label><label><span>Día de descanso habitual</span><select value={employeeDraft.defaultRestDay} onChange={event => setEmployeeDraft({ ...employeeDraft, defaultRestDay: Number(event.target.value) })}>{restDays.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label><label><span>Entrada habitual</span><input type="time" value={employeeDraft.defaultShiftStart} onChange={event => setEmployeeDraft({ ...employeeDraft, defaultShiftStart: event.target.value })}/></label><label><span>Salida habitual</span><input type="time" value={employeeDraft.defaultShiftEnd} onChange={event => setEmployeeDraft({ ...employeeDraft, defaultShiftEnd: event.target.value })}/></label><p className="employment-note"><Clock3 size={14}/>Este horario se usará como base para semanas futuras. No modifica semanas ya publicadas en Personal.</p></div></article>

        <article className="panel access-card"><header><div><span>CUENTA Y PERMISOS</span><h2>Acceso al sistema</h2></div><label className="access-switch"><input type="checkbox" checked={accessEnabled} onChange={event => toggleAccess(event.target.checked)}/><span>{accessEnabled ? 'Acceso activo' : 'Sin acceso'}</span></label></header>{accountDraft && <div className={!accessEnabled ? 'access-body disabled' : 'access-body'}><div className="account-fields"><label><span>Usuario</span><input disabled={!accessEnabled} value={accountDraft.username} onChange={event => setAccountDraft({ ...accountDraft, username: event.target.value })}/></label><label><span>Rol</span><input value={employeeDraft.role} disabled/></label></div><div className="permission-table"><header><span>Módulo</span><span>Nivel de acceso</span></header>{modules.map(module => <label key={module}><span>{module}</span><select disabled={!accessEnabled} value={accountDraft.permissions[module]} onChange={event => setAccountDraft({ ...accountDraft, permissions: { ...accountDraft.permissions, [module]: event.target.value as AccessLevel } })}>{levels.map(level => <option key={level}>{level}</option>)}</select></label>)}</div><p><ShieldCheck size={14}/>Configuración solo aparece para Dueño y Gerencia; no depende de esta tabla.</p></div>}{!accountDraft && <div className="no-account"><KeyRound size={23}/><b>Este trabajador no tiene cuenta</b><span>Activa el acceso para crear su usuario y sus permisos.</span></div>}</article>

        {error && <div className="settings-error"><AlertTriangle size={15}/>{error}</div>}
        <div className="settings-savebar"><span><CheckCircle2 size={14}/>Los cambios son simulados hasta conectar el backend.</span><button onClick={saveProfile}><Save size={14}/>Guardar cambios</button></div>
      </section>}
    </div>

    {newEmployee && <div className="dialog-backdrop" role="presentation"><section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Agregar trabajador"><header><div><span>NUEVO REGISTRO</span><h2>Agregar trabajador</h2><p>Crea el perfil laboral y, si lo necesita, su acceso al sistema.</p></div><button onClick={() => setNewEmployee(null)} aria-label="Cerrar"><X size={18}/></button></header><div className="new-employee-form"><label className="full"><span>Nombre completo</span><input value={newEmployee.name} onChange={event => setNewEmployee({ ...newEmployee, name: event.target.value })}/></label><label><span>Área o puesto</span><select value={newEmployee.role} onChange={event => setNewEmployee({ ...newEmployee, role: event.target.value as StaffRole })}>{staffRoles.filter(item => role === 'Dueño' || item !== 'Gerencia').map(item => <option key={item}>{item}</option>)}</select></label><label><span>Salario semanal</span><input type="number" min="0" value={newEmployee.weeklySalary} onChange={event => setNewEmployee({ ...newEmployee, weeklySalary: event.target.value })}/></label><label><span>Entrada habitual</span><input type="time" value={newEmployee.defaultShiftStart} onChange={event => setNewEmployee({ ...newEmployee, defaultShiftStart: event.target.value })}/></label><label><span>Salida habitual</span><input type="time" value={newEmployee.defaultShiftEnd} onChange={event => setNewEmployee({ ...newEmployee, defaultShiftEnd: event.target.value })}/></label><label className="full"><span>Descanso habitual</span><select value={newEmployee.defaultRestDay} onChange={event => setNewEmployee({ ...newEmployee, defaultRestDay: Number(event.target.value) })}>{restDays.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label><label className="create-access full"><input type="checkbox" checked={newEmployee.createAccess} onChange={event => setNewEmployee({ ...newEmployee, createAccess: event.target.checked })}/><span>Crear acceso al sistema</span></label>{newEmployee.createAccess && <label className="full"><span>Nombre de usuario</span><input value={newEmployee.username} onChange={event => setNewEmployee({ ...newEmployee, username: event.target.value })} placeholder="nombre.apellido"/></label>}{error && <div className="settings-error full"><AlertTriangle size={14}/>{error}</div>}</div><footer><button onClick={() => setNewEmployee(null)}>Cancelar</button><button className="primary-action" onClick={createEmployee}>Agregar trabajador</button></footer></section></div>}
  </section>
}
