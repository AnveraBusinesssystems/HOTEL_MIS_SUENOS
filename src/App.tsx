import { useEffect, useState } from 'react'
import {
  Bell, CalendarDays, DollarSign, Gauge, LayoutDashboard, Menu,
  ReceiptText, RefreshCw, Settings, Users, WalletCards,
} from 'lucide-react'
import { IndicatorsView, SummaryView } from './components/DashboardViews'
import { CashView } from './components/CashView'
import { OperationsView } from './components/OperationsView'
import { RatesView } from './components/RatesView'
import { ReservationsView } from './components/ReservationsView'
import { SettingsView } from './components/SettingsView'
import { StaffView } from './components/StaffView'
import { hotelService } from './services/hotelService'
import type { DashboardData, Role } from './types'

type ActivePage = 'Resumen' | 'Indicadores' | 'RMS / Tarifas' | 'Reservas' | 'Operación diaria' | 'Caja' | 'Personal' | 'Configuración'

const menu = [
  ['Resumen', LayoutDashboard, true],
  ['Indicadores', Gauge, true],
  ['RMS / Tarifas', DollarSign, true],
  ['Reservas', CalendarDays, true],
  ['Operación diaria', ReceiptText, true],
  ['Caja', WalletCards, true],
  ['Personal', Users, true],
  ['Configuración', Settings, true],
] as const

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [active, setActive] = useState<ActivePage>('Resumen')
  const [role, setRole] = useState<Role>('Dueño')
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string>()
  const [toast, setToast] = useState('')
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('hms_demo_auth') === 'true')

  const load = async () => {
    setLoading(true)
    setData(await hotelService.getDashboard())
    setLoading(false)
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    if (active === 'Configuración' && !['Dueño', 'Gerencia'].includes(role)) setActive('Resumen')
  }, [active, role])

  const openRms = (recommendationId?: string) => {
    setSelectedRecommendationId(recommendationId)
    setActive('RMS / Tarifas')
  }

  const updateReservations = (updater: (rows: DashboardData['reservations']) => DashboardData['reservations']) => {
    setData(current => current ? { ...current, reservations: updater(current.reservations) } : current)
  }
  const updateRooms = (updater: (rows: DashboardData['roomStates']) => DashboardData['roomStates']) => {
    setData(current => current ? { ...current, roomStates: updater(current.roomStates) } : current)
  }
  const updateTasks = (updater: (rows: DashboardData['operationTasks']) => DashboardData['operationTasks']) => {
    setData(current => current ? { ...current, operationTasks: updater(current.operationTasks) } : current)
  }
  const updateOperationDays = (updater: (rows: DashboardData['operationDays']) => DashboardData['operationDays']) => {
    setData(current => current ? { ...current, operationDays: updater(current.operationDays) } : current)
  }
  const updateTours = (updater: (rows: DashboardData['tours']) => DashboardData['tours']) => {
    setData(current => current ? { ...current, tours: updater(current.tours) } : current)
  }
  const updateCashMovements = (updater: (rows: DashboardData['cashMovements']) => DashboardData['cashMovements']) => {
    setData(current => current ? { ...current, cashMovements: updater(current.cashMovements) } : current)
  }
  const updateCashDays = (updater: (rows: DashboardData['cashDays']) => DashboardData['cashDays']) => {
    setData(current => current ? { ...current, cashDays: updater(current.cashDays) } : current)
  }
  const updateStaffSchedules = (updater: (rows: DashboardData['staffSchedules']) => DashboardData['staffSchedules']) => {
    setData(current => current ? { ...current, staffSchedules: updater(current.staffSchedules) } : current)
  }
  const updateStaffTimeEntries = (updater: (rows: DashboardData['staffTimeEntries']) => DashboardData['staffTimeEntries']) => {
    setData(current => current ? { ...current, staffTimeEntries: updater(current.staffTimeEntries) } : current)
  }
  const updateStaffRequests = (updater: (rows: DashboardData['staffRequests']) => DashboardData['staffRequests']) => {
    setData(current => current ? { ...current, staffRequests: updater(current.staffRequests) } : current)
  }
  const updateStaff = (updater: (rows: DashboardData['staff']) => DashboardData['staff']) => {
    setData(current => current ? { ...current, staff: updater(current.staff) } : current)
  }
  const updateUserAccounts = (updater: (rows: DashboardData['userAccounts']) => DashboardData['userAccounts']) => {
    setData(current => current ? { ...current, userAccounts: updater(current.userAccounts) } : current)
  }

  if (!authenticated) return <LoginScreen onLogin={() => { localStorage.setItem('hms_demo_auth', 'true'); setAuthenticated(true) }}/>
  if (loading || !data) return <div className="system-loading"><span>HOTEL MIS SUEÑOS</span><small>Preparando análisis RMS…</small></div>

  return <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">MS</div>{!collapsed && <div><strong>MIS SUEÑOS</strong><span>HOLBOX · RMS</span><small className="build-tag">BUILD 1.8.0</small></div>}</div>
      <button className="collapse-btn" onClick={() => setCollapsed(value => !value)} aria-label="Contraer navegación"><Menu size={18}/></button>
      <nav>{menu.filter(([label]) => label !== 'Configuración' || ['Dueño', 'Gerencia'].includes(role)).map(([label, Icon, enabled]) => <button key={label} disabled={!enabled} className={active === label ? 'active' : ''} onClick={() => enabled && setActive(label as ActivePage)}><Icon size={18}/>{!collapsed && <><span>{label}</span>{!enabled && <em>PRÓX.</em>}</>}</button>)}</nav>
      {!collapsed && <div className="property-meta"><span>PROPIEDAD</span><strong>17 habitaciones</strong><small>Isla Holbox · Q. Roo</small></div>}
    </aside>

    <main className="main">
      <header className="topbar">
        <strong className="topbar-title">Panel interno · RMS</strong>
        <div className="topbar-right">
          <span className="updated">Actualizado · {new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.generatedAt))}</span>
          <button className="icon-button" onClick={async () => { await load(); setToast('Datos simulados actualizados') }} title="Actualizar datos"><RefreshCw size={16}/></button>
          <div className="notification-wrap"><button className="icon-button" onClick={() => setNotificationsOpen(value => !value)} aria-label="Notificaciones"><Bell size={16}/><i>{data.alerts.length}</i></button>{notificationsOpen && <div className="notification-popover"><header><b>Alertas RMS</b><button onClick={() => setNotificationsOpen(false)} aria-label="Cerrar">×</button></header>{data.alerts.map(alert => <button key={alert.id} onClick={() => { setNotificationsOpen(false); openRms(alert.recommendationId) }}><b>{alert.title}</b><span>{alert.message}</span></button>)}</div>}</div>
          <button className="logout-button" onClick={() => { localStorage.removeItem('hms_demo_auth'); setAuthenticated(false) }}>Salir</button>
          <select value={role} onChange={event => setRole(event.target.value as Role)} aria-label="Rol simulado"><option>Dueño</option><option>Gerencia</option><option>Administración</option><option>Recepción</option><option>Cocina</option><option>Limpieza</option><option>Alberca</option></select>
        </div>
      </header>

      {active === 'Resumen' && <SummaryView data={data} role={role} onOpenRms={openRms}/>}
      {active === 'Indicadores' && <IndicatorsView data={data} role={role}/>}
      {active === 'RMS / Tarifas' && <RatesView data={data} initialRecommendationId={selectedRecommendationId} onNotify={setToast}/>}
      {active === 'Reservas' && <ReservationsView reservations={data.reservations} onChange={updateReservations} onNotify={setToast}/>}
      {active === 'Operación diaria' && <OperationsView
        role={role} reservations={data.reservations} rooms={data.roomStates} tasks={data.operationTasks}
        days={data.operationDays} tours={data.tours} cashMovements={data.cashMovements}
        onReservationsChange={updateReservations} onRoomsChange={updateRooms} onTasksChange={updateTasks}
        onDaysChange={updateOperationDays} onToursChange={updateTours}
        onCashMovementsChange={updateCashMovements} onNotify={setToast}
      />}
      {active === 'Caja' && <CashView
        role={role} reservations={data.reservations} movements={data.cashMovements} days={data.cashDays}
        onReservationsChange={updateReservations} onMovementsChange={updateCashMovements}
        onDaysChange={updateCashDays} onNotify={setToast}
      />}
      {active === 'Personal' && <StaffView
        role={role} staff={data.staff} schedules={data.staffSchedules}
        timeEntries={data.staffTimeEntries} requests={data.staffRequests}
        onSchedulesChange={updateStaffSchedules} onTimeEntriesChange={updateStaffTimeEntries}
        onRequestsChange={updateStaffRequests} onNotify={setToast}
      />}
      {active === 'Configuración' && <SettingsView
        role={role} staff={data.staff} accounts={data.userAccounts}
        onStaffChange={updateStaff} onAccountsChange={updateUserAccounts}
        onSchedulesChange={updateStaffSchedules} onNotify={setToast}
      />}
    </main>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (password === '1010') { setError(''); onLogin(); return }
    setError('Contraseña incorrecta')
  }
  return <div className="login-shell">
    <section className="login-brand-panel"><div className="login-monogram">MS</div><small className="login-version">BUILD 1.8.0</small><p>ISLA HOLBOX · QUINTANA ROO</p><h1>Hotel Mis Sueños</h1><span>Sistema interno de operación y revenue management</span><div className="login-property-line"><b>17</b><small>habitaciones</small></div></section>
    <section className="login-form-panel"><form className="login-form" onSubmit={submit}><p className="eyebrow">ACCESO INTERNO</p><h2>Bienvenido</h2><p className="login-copy">Ingresa la clave temporal para acceder al panel administrativo.</p><label htmlFor="password">Contraseña</label><input id="password" autoFocus type="password" inputMode="numeric" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••"/>{error && <div className="login-error">{error}</div>}<button type="submit">Entrar al sistema</button><small className="demo-note">Acceso temporal de demostración · No sustituye autenticación real</small></form></section>
  </div>
}

export default App
