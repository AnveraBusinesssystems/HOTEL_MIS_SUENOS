import { useEffect, useState } from 'react'
import {
  Bell, BedDouble, CalendarDays, DollarSign, Gauge, LayoutDashboard, Menu,
  ReceiptText, RefreshCw, Settings, Sparkles, Users, WalletCards,
} from 'lucide-react'
import { IndicatorsView, SummaryView } from './components/DashboardViews'
import { RatesView } from './components/RatesView'
import { hotelService } from './services/hotelService'
import type { DashboardData, Role } from './types'

type ActivePage = 'Resumen' | 'Indicadores' | 'RMS / Tarifas'

const menu = [
  ['Resumen', LayoutDashboard, true],
  ['Indicadores', Gauge, true],
  ['RMS / Tarifas', DollarSign, true],
  ['Reservas', CalendarDays, false],
  ['Operación diaria', ReceiptText, false],
  ['Habitaciones', BedDouble, false],
  ['Limpieza', Sparkles, false],
  ['Caja', WalletCards, false],
  ['Personal', Users, false],
  ['Configuración', Settings, false],
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

  const openRms = (recommendationId?: string) => {
    setSelectedRecommendationId(recommendationId)
    setActive('RMS / Tarifas')
  }

  if (!authenticated) return <LoginScreen onLogin={() => { localStorage.setItem('hms_demo_auth', 'true'); setAuthenticated(true) }}/>
  if (loading || !data) return <div className="system-loading"><span>HOTEL MIS SUEÑOS</span><small>Preparando análisis RMS…</small></div>

  return <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">MS</div>{!collapsed && <div><strong>MIS SUEÑOS</strong><span>HOLBOX · RMS</span><small className="build-tag">BUILD 0.3</small></div>}</div>
      <button className="collapse-btn" onClick={() => setCollapsed(value => !value)} aria-label="Contraer navegación"><Menu size={18}/></button>
      <nav>{menu.map(([label, Icon, enabled]) => <button key={label} disabled={!enabled} className={active === label ? 'active' : ''} onClick={() => enabled && setActive(label as ActivePage)}><Icon size={18}/>{!collapsed && <><span>{label}</span>{!enabled && <em>PRÓX.</em>}</>}</button>)}</nav>
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
    <section className="login-brand-panel"><div className="login-monogram">MS</div><small className="login-version">BUILD 0.3</small><p>ISLA HOLBOX · QUINTANA ROO</p><h1>Hotel Mis Sueños</h1><span>Sistema interno de operación y revenue management</span><div className="login-property-line"><b>17</b><small>habitaciones</small></div></section>
    <section className="login-form-panel"><form className="login-form" onSubmit={submit}><p className="eyebrow">ACCESO INTERNO</p><h2>Bienvenido</h2><p className="login-copy">Ingresa la clave temporal para acceder al panel administrativo.</p><label htmlFor="password">Contraseña</label><input id="password" autoFocus type="password" inputMode="numeric" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••"/>{error && <div className="login-error">{error}</div>}<button type="submit">Entrar al sistema</button><small className="demo-note">Acceso temporal de demostración · No sustituye autenticación real</small></form></section>
  </div>
}

export default App
