import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Bell, BedDouble, CalendarDays, ChevronDown, DollarSign,
  Gauge, Sparkles, LayoutDashboard, Menu, ReceiptText, RefreshCw,
  Settings, Users, WalletCards
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts'
import { hotelService } from './services/hotelService'
import type { Alert, DailyPerformance, KPI, RateDay, Role, RoomPerformance } from './types'

type DashboardData = {
  kpis: KPI[]
  performance: DailyPerformance[]
  roomPerformance: RoomPerformance[]
  rateDays: RateDay[]
  alerts: Alert[]
}

const menu = [
  ['Resumen', LayoutDashboard, true],
  ['Indicadores', Gauge, true],
  ['Tarifas', DollarSign, true],
  ['Reservas', CalendarDays, false],
  ['Operación diaria', ReceiptText, false],
  ['Habitaciones', BedDouble, false],
  ['Limpieza', Sparkles, false],
  ['Caja', WalletCards, false],
  ['Personal', Users, false],
  ['Configuración', Settings, false],
] as const

const money = (v:number) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(v)
const number = (v:number) => new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(v)
const kpiValue = (k:KPI) => k.format==='mxn' ? money(k.value) : k.format==='percent' ? `${number(k.value)}%` : number(k.value)
const previousValue = (k:KPI) => k.format==='mxn' ? money(k.previous) : k.format==='percent' ? `${number(k.previous)}%` : number(k.previous)

function App() {
  const [data,setData] = useState<DashboardData | null>(null)
  const [active,setActive] = useState('Resumen')
  const [role,setRole] = useState<Role>('Dueño')
  const [collapsed,setCollapsed] = useState(false)
  const [loading,setLoading] = useState(true)
  const [authenticated,setAuthenticated] = useState(() => localStorage.getItem('hms_demo_auth') === 'true')

  const load = async () => {
    setLoading(true)
    setData(await hotelService.getDashboard())
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const financialAccess = ['Dueño','Gerencia','Administración'].includes(role)
  const avgOccupancy = useMemo(() => data ? data.performance.reduce((a,b)=>a+b.ocupacion,0)/data.performance.length : 0,[data])

  if (!authenticated) return <LoginScreen onLogin={()=>{ localStorage.setItem('hms_demo_auth','true'); setAuthenticated(true) }} />

  if (loading || !data) return <div className="system-loading"><span>HOTEL MIS SUEÑOS</span><small>Cargando sistema operativo…</small></div>

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">MS</div>
          {!collapsed && <div><strong>MIS SUEÑOS</strong><span>HOLBOX · RMS</span></div>}
        </div>
        <button className="collapse-btn" onClick={()=>setCollapsed(v=>!v)} aria-label="Contraer navegación"><Menu size={18}/></button>
        <nav>
          {menu.map(([label,Icon,enabled]) => (
            <button key={label} disabled={!enabled} className={active===label?'active':''} onClick={()=>enabled&&setActive(label)}>
              <Icon size={18}/>
              {!collapsed && <><span>{label}</span>{!enabled && <em>PRÓX.</em>}</>}
            </button>
          ))}
        </nav>
        {!collapsed && <div className="property-meta"><span>PROPIEDAD</span><strong>17 habitaciones</strong><small>Isla Holbox · Q. Roo</small></div>}
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="period-controls">
            <button>Este mes <ChevronDown size={14}/></button>
            <button>vs. mes anterior <ChevronDown size={14}/></button>
          </div>
          <div className="topbar-right">
            <span className="updated">Actualizado · hace 1 min</span>
            <button className="icon-button" onClick={load} title="Actualizar datos"><RefreshCw size={16}/></button>
            <button className="icon-button"><Bell size={16}/><i>3</i></button>
            <button className="logout-button" onClick={()=>{ localStorage.removeItem('hms_demo_auth'); setAuthenticated(false) }}>Salir</button>
            <select value={role} onChange={e=>setRole(e.target.value as Role)}>
              <option>Dueño</option><option>Gerencia</option><option>Administración</option><option>Recepción</option>
              <option>Cocina</option><option>Limpieza</option><option>Alberca</option>
            </select>
          </div>
        </header>

        {active === 'Tarifas' ? <RatesView rateDays={data.rateDays}/> : (
          <div className="page">
            <section className="page-heading">
              <div>
                <p className="eyebrow">CONTROL EJECUTIVO</p>
                <h1>{active}</h1>
                <p>Desempeño comercial y operativo de Hotel Mis Sueños Holbox.</p>
              </div>
              <div className="status-strip">
                <span><i className="dot good"/> Operación normal</span>
                <strong>{number(avgOccupancy)}%</strong>
                <small>ocupación promedio 7 días</small>
              </div>
            </section>

            <section className="kpi-grid">
              {data.kpis.map(k => {
                const diff = k.value-k.previous
                const pct = k.previous ? (diff/k.previous)*100 : 0
                return <article className="kpi-card" key={k.id} title={k.helper}>
                  <span>{k.label}</span>
                  <strong>{kpiValue(k)}</strong>
                  <div className="kpi-comparison">
                    <b className={diff>=0?'positive':'negative'}>{diff>=0?'▲':'▼'} {Math.abs(pct).toFixed(1)}%</b>
                    <small>Anterior {previousValue(k)}</small>
                  </div>
                </article>
              })}
            </section>

            <section className="grid two">
              <article className="panel performance-panel">
                <header><div><span>DESEMPEÑO</span><h2>Ingresos y ocupación</h2></div><button>Últimos 7 días</button></header>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.performance} margin={{top:12,right:12,left:0,bottom:0}}>
                      <defs>
                        <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#183b5b" stopOpacity={0.24}/>
                          <stop offset="95%" stopColor="#183b5b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e4e9ee" vertical={false}/>
                      <XAxis dataKey="date" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`}/>
                      <Tooltip formatter={(v:number)=>money(v)} contentStyle={{borderRadius:0,border:'1px solid #cfd7df'}}/>
                      <Area type="monotone" dataKey="ingresos" stroke="#183b5b" strokeWidth={2} fill="url(#income)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="metric-line">
                  <span><i/> Ingresos habitaciones</span>
                  <span>ADR actual <b>{money(data.kpis.find(k=>k.id==='adr')!.value)}</b></span>
                  <span>RevPAR <b>{money(data.kpis.find(k=>k.id==='revpar')!.value)}</b></span>
                </div>
              </article>

              <article className="panel alerts-panel">
                <header><div><span>RMS</span><h2>Alertas y oportunidades</h2></div><strong>{data.alerts.length} ACTIVAS</strong></header>
                <div className="alerts-list">
                  {data.alerts.map(a=><div className="alert-row" key={a.id}>
                    <div className={`severity ${a.level.toLowerCase()}`}><AlertTriangle size={16}/></div>
                    <div className="alert-copy"><div><b>{a.title}</b><span>{a.date}</span></div><p>{a.message}</p><button>{a.action} →</button></div>
                  </div>)}
                </div>
              </article>
            </section>

            <section className="grid two lower">
              <article className="panel">
                <header><div><span>INVENTARIO</span><h2>Desempeño por habitación</h2></div></header>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Tipo</th><th>Hab.</th><th>Ocup.</th><th>ADR</th><th>RevPAR</th><th>Tarifa</th></tr></thead>
                    <tbody>{data.roomPerformance.map(r=><tr key={r.code}>
                      <td><b>{r.code}</b><small>{r.name}</small></td><td>{r.rooms}</td><td>{number(r.occupancy)}%</td>
                      <td>{money(r.adr)}</td><td>{money(r.revpar)}</td><td><b>{money(r.currentRate)}</b></td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </article>

              <article className="panel">
                <header><div><span>PRÓXIMOS DÍAS</span><h2>Ocupación y tarifa</h2></div><button onClick={()=>setActive('Tarifas')}>Abrir tarifas</button></header>
                <div className="chart-wrap small">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.rateDays}>
                      <CartesianGrid stroke="#e4e9ee" vertical={false}/>
                      <XAxis dataKey="date" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis domain={[0,100]} tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{borderRadius:0,border:'1px solid #cfd7df'}}/>
                      <Bar dataKey="occupancy" fill="#183b5b"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            {financialAccess ? <section className="profit-strip">
              <div><span>RESULTADO OPERATIVO · ESTIMACIÓN</span><strong>{money(178420)}</strong></div>
              <div><span>Costos registrados</span><b>{money(236800)}</b></div>
              <div><span>Costos estimados</span><b>{money(71020)}</b></div>
              <div><span>Margen operativo</span><b>36.7%</b></div>
              <em>DATOS INCOMPLETOS</em>
            </section> : <section className="access-note">La información financiera completa no está disponible para el rol <b>{role}</b>.</section>}
          </div>
        )}
      </main>
    </div>
  )
}

function LoginScreen({onLogin}:{onLogin:()=>void}) {
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')

  const submit = (e:React.FormEvent) => {
    e.preventDefault()
    if (password === '1010') {
      setError('')
      onLogin()
      return
    }
    setError('Contraseña incorrecta')
  }

  return <div className="login-shell">
    <section className="login-brand-panel">
      <div className="login-monogram">MS</div>
      <p>ISLA HOLBOX · QUINTANA ROO</p>
      <h1>Hotel Mis Sueños</h1>
      <span>Sistema interno de operación y revenue management</span>
      <div className="login-property-line"><b>17</b><small>habitaciones</small></div>
    </section>
    <section className="login-form-panel">
      <form className="login-form" onSubmit={submit}>
        <p className="eyebrow">ACCESO INTERNO</p>
        <h2>Bienvenido</h2>
        <p className="login-copy">Ingresa la clave temporal para acceder al panel administrativo.</p>
        <label htmlFor="password">Contraseña</label>
        <input id="password" autoFocus type="password" inputMode="numeric" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••" />
        {error && <div className="login-error">{error}</div>}
        <button type="submit">Entrar al sistema</button>
        <small className="demo-note">Acceso temporal de demostración · No sustituye autenticación real</small>
      </form>
    </section>
  </div>
}

function RatesView({rateDays}:{rateDays:RateDay[]}) {
  return <div className="page">
    <section className="page-heading">
      <div><p className="eyebrow">REVENUE MANAGEMENT</p><h1>Tarifas</h1><p>Control diario de precio, ocupación y disponibilidad futura.</p></div>
      <button className="primary-action">Editar rango de fechas</button>
    </section>
    <section className="rate-summary">
      <div><span>Tarifa promedio actual</span><strong>{money(rateDays.reduce((a,b)=>a+b.currentRate,0)/rateDays.length)}</strong></div>
      <div><span>Tarifa recomendada</span><strong>{money(rateDays.reduce((a,b)=>a+b.recommendedRate,0)/rateDays.length)}</strong></div>
      <div><span>Ocupación prevista</span><strong>{number(rateDays.reduce((a,b)=>a+b.occupancy,0)/rateDays.length)}%</strong></div>
      <div><span>Habitaciones por vender</span><strong>{rateDays.reduce((a,b)=>a+b.available,0)}</strong></div>
    </section>
    <section className="panel rate-table-panel">
      <header><div><span>CALENDARIO TARIFARIO</span><h2>Próximas fechas</h2></div><span className="simulation-label">RECOMENDACIÓN SIMULADA</span></header>
      <div className="table-scroll"><table className="rate-table">
        <thead><tr><th>Fecha</th><th>Ocupación</th><th>Disponibles</th><th>ADR</th><th>Tarifa actual</th><th>Recomendada</th><th>Diferencia</th><th>Min.</th><th>Estado</th></tr></thead>
        <tbody>{rateDays.map(d=>{
          const diff=d.recommendedRate-d.currentRate
          return <tr key={d.date}>
            <td><b>{d.date}</b></td><td><span className={`occ-tag ${d.occupancy>=90?'hot':d.occupancy>=80?'high':d.occupancy<60?'low':''}`}>{number(d.occupancy)}%</span></td>
            <td>{d.available}</td><td>{money(d.adr)}</td><td>{money(d.currentRate)}</td><td><b>{money(d.recommendedRate)}</b></td>
            <td className={diff>=0?'positive':'negative'}>{diff>=0?'+':''}{money(diff)}</td><td>{d.minStay} noche{d.minStay>1?'s':''}</td><td><span className="open-state">{d.status}</span></td>
          </tr>
        })}</tbody>
      </table></div>
    </section>
  </div>
}

export default App
