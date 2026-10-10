import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, BarChart3, BedDouble, Lightbulb, WalletCards } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { DashboardData, ExpenseCategory, KPI, Role, RoomCode, RoomMonthlyPerformance } from '../types'
import { kpiValue, money, monthlyMetrics, number, percent, shortDate } from '../utils'

type SummaryProps = {
  data: DashboardData
  role: Role
  onOpenRms: (recommendationId?: string) => void
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const ROOM_COLORS = ['#4e6248', '#7d8f6c', '#b99157', '#9b6b58', '#526b7d']
const COST_COLORS = ['#4e6248', '#7d8f6c', '#b99157', '#9b6b58', '#526b7d', '#88715d', '#b9aa96']

function KpiCards({ kpis }: { kpis: KPI[] }) {
  return <section className="kpi-grid">
    {kpis.map(kpi => {
      const difference = kpi.value - kpi.previous
      const relative = kpi.previous ? difference / kpi.previous * 100 : 0
      const neutral = Math.abs(difference) < 0.001
      const comparison = kpi.comparisonMode === 'points'
        ? `${difference >= 0 ? '+' : ''}${number(difference, 1)} pts`
        : `${difference >= 0 ? '+' : ''}${number(relative, 1)}%`
      return <article className="kpi-card" key={kpi.id} title={kpi.helper}>
        <span>{kpi.label}</span>
        <strong>{kpiValue(kpi)}</strong>
        <div className="kpi-comparison">
          <b className={neutral ? 'neutral' : difference > 0 ? 'positive' : 'negative'}>
            {neutral ? '—' : difference > 0 ? '▲' : '▼'} {neutral ? 'Sin cambio' : comparison}
          </b>
          <small>Mes anterior {kpiValue(kpi, kpi.previous)}</small>
        </div>
      </article>
    })}
  </section>
}

export function SummaryView({ data, role, onOpenRms }: SummaryProps) {
  const financialAccess = ['Dueño', 'Gerencia', 'Administración'].includes(role)
  const current = data.monthly.find(row => row.key === '2026-10') ?? data.monthly.at(-1)!
  const previous = data.monthly.find(row => row.key === '2026-09') ?? data.monthly.at(-2)!
  const currentMetrics = monthlyMetrics(current)
  const previousMetrics = monthlyMetrics(previous)
  const executiveKpis: KPI[] = [
    { id: 'revenue', label: 'Ingresos', value: current.revenue, previous: previous.revenue, format: 'mxn', helper: 'Ingresos por hospedaje.' },
    { id: 'occupancy', label: 'Ocupación', value: currentMetrics.occupancy, previous: previousMetrics.occupancy, format: 'percent', comparisonMode: 'points', helper: 'Noches vendidas / disponibles.' },
    { id: 'adr', label: 'ADR', value: currentMetrics.adr, previous: previousMetrics.adr, format: 'mxn', helper: 'Precio promedio por noche vendida.' },
    { id: 'revpar', label: 'RevPAR', value: currentMetrics.revpar, previous: previousMetrics.revpar, format: 'mxn', helper: 'Ingreso por habitación disponible.' },
    { id: 'costs', label: 'Costos', value: current.costs, previous: previous.costs, format: 'mxn', helper: 'Gastos registrados en el periodo.' },
    { id: 'result', label: 'Resultado operativo', value: currentMetrics.operatingResult, previous: previousMetrics.operatingResult, format: 'mxn', helper: 'Ingresos menos costos.' },
  ]
  const nextSeven = data.rateDays.slice(0, 7)
  const occupied = nextSeven.reduce((sum, day) => sum + day.occupied, 0)
  const capacity = nextSeven.length * 17
  const forwardOccupancy = capacity ? occupied / capacity * 100 : 0

  return <div className="page summary-page">
    <section className="page-heading">
      <div><p className="eyebrow">CONTROL EJECUTIVO</p><h1>Resumen</h1><p>Las cifras esenciales del hotel y las decisiones que requieren atención.</p></div>
      <div className="status-strip"><span><i className="dot good"/> Próximos 7 días</span><strong>{number(forwardOccupancy)}%</strong><small>{occupied} de {capacity} noches ocupadas</small></div>
    </section>

    <KpiCards kpis={financialAccess ? executiveKpis : executiveKpis.slice(0, 4)}/>

    <section className="decision-panel">
      <header><div><span>DECISIONES PRIORITARIAS</span><h2>Oportunidades con mayor impacto</h2></div><button onClick={() => onOpenRms()}>Abrir centro RMS <ArrowRight size={14}/></button></header>
      <div className="decision-grid">{data.alerts.slice(0, 3).map(alert => <button className="decision-card" key={alert.id} onClick={() => onOpenRms(alert.recommendationId)}>
        <span className={`severity ${alert.level.toLowerCase()}`}><AlertTriangle size={15}/></span>
        <div><b>{alert.title}</b><p>{alert.message}</p></div>
        <aside><small>Impacto estimado</small><strong>{money(alert.estimatedImpact ?? 0)}</strong><em>{shortDate(alert.date)}</em></aside>
      </button>)}</div>
    </section>

    <section className="grid two">
      <article className="panel">
        <header><div><span>DESEMPEÑO RECIENTE</span><h2>Ingresos y ocupación</h2></div><span className="data-state">REAL</span></header>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.performance} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e4ddd2" vertical={false}/><XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/>
          <YAxis yAxisId="money" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={value => `${Math.round(value / 1000)}k`}/><YAxis yAxisId="percent" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`}/>
          <Tooltip formatter={(value: number, name: string) => name === 'Ocupación' ? percent(value) : money(value)}/><Legend wrapperStyle={{ fontSize: 10 }}/><Bar yAxisId="money" dataKey="ingresos" name="Ingresos" fill="#526b7d"/><Line yAxisId="percent" type="monotone" dataKey="ocupacion" name="Ocupación" stroke="#667858" strokeWidth={2.5}/>
        </ComposedChart></ResponsiveContainer></div>
      </article>
      <article className="panel next-days-panel">
        <header><div><span>PRÓXIMOS 7 DÍAS</span><h2>Ocupación y disponibilidad</h2></div><button onClick={() => onOpenRms()}>Ver 180 días</button></header>
        <div className="next-days-list">{nextSeven.map(day => <button key={day.date} onClick={() => onOpenRms(`${day.date}-CHA`)}><span>{shortDate(day.date)}</span><b>{day.occupied}/17</b><div className="occupancy-track"><i style={{ width: `${day.occupancy}%` }}/></div><strong>{number(day.occupancy, 0)}%</strong><small>{day.available} libres</small></button>)}</div>
      </article>
    </section>
  </div>
}

type IndicatorTab = 'Rendimiento' | 'Habitaciones' | 'Costos'
type RoomMetric = 'revenue' | 'occupancy' | 'adr' | 'revpar'

const aggregateRooms = (rows: RoomMonthlyPerformance[]) => {
  const grouped = new Map<RoomCode, RoomMonthlyPerformance[]>()
  rows.forEach(row => grouped.set(row.code, [...(grouped.get(row.code) ?? []), row]))
  return [...grouped.entries()].map(([code, items]) => {
    const revenue = items.reduce((sum, item) => sum + item.revenue, 0)
    const soldNights = items.reduce((sum, item) => sum + item.soldNights, 0)
    const availableNights = items.reduce((sum, item) => sum + item.availableNights, 0)
    return { code, revenue, soldNights, availableNights, occupancy: soldNights / availableNights * 100, adr: revenue / soldNights, revpar: revenue / availableNights }
  })
}

export function IndicatorsView({ data, role }: { data: DashboardData; role: Role }) {
  const financialAccess = ['Dueño', 'Gerencia', 'Administración'].includes(role)
  const years = [...new Set(data.monthly.map(row => row.year))].sort((a, b) => b - a)
  const [year, setYear] = useState(years[0])
  const [month, setMonth] = useState(10)
  const [tab, setTab] = useState<IndicatorTab>('Rendimiento')
  const [roomCode, setRoomCode] = useState<'TODAS' | RoomCode>('TODAS')
  const [roomMetric, setRoomMetric] = useState<RoomMetric>('revenue')

  const selected = data.monthly.find(row => row.year === year && row.month === month) ?? data.monthly.filter(row => row.year === year).at(-1)!
  const previousMonth = data.monthly.find(row => row.key === `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`) ?? selected
  const previousYear = data.monthly.find(row => row.year === year - 1 && row.month === month) ?? selected
  const selectedMetrics = monthlyMetrics(selected)
  const previousMetrics = monthlyMetrics(previousMonth)
  const yearRows = data.monthly.filter(row => row.year === year).sort((a, b) => a.month - b.month)
  const performanceTrend = yearRows.map(row => {
    const prior = data.monthly.find(item => item.year === year - 1 && item.month === row.month)
    const metrics = monthlyMetrics(row)
    return { month: MONTHS[row.month - 1], revenue: row.revenue, costs: row.costs, result: metrics.operatingResult, occupancy: metrics.occupancy, adr: metrics.adr, revpar: metrics.revpar, previousRevpar: prior ? monthlyMetrics(prior).revpar : 0 }
  })

  const roomPeriodRows = data.roomMonthly.filter(row => row.year === year && row.month === month && (roomCode === 'TODAS' || row.code === roomCode))
  const roomSummary = aggregateRooms(roomPeriodRows)
  const totalRoomRevenue = roomSummary.reduce((sum, room) => sum + room.revenue, 0)
  const roomNames = new Map(data.roomPerformance.map(room => [room.code, room.name]))

  const categoryPeriod = useMemo(() => {
    const grouped = new Map<ExpenseCategory, number>()
    data.expenses.filter(row => row.year === year && row.month === month).forEach(row => grouped.set(row.category, (grouped.get(row.category) ?? 0) + row.amount))
    return [...grouped.entries()].map(([name, value]) => ({ name, value }))
  }, [data.expenses, month, year])
  const costTrend = yearRows.map(row => {
    const categories = Object.fromEntries(data.expenses.filter(expense => expense.year === year && expense.month === row.month).map(expense => [expense.category, expense.amount]))
    return { month: MONTHS[row.month - 1], occupancy: monthlyMetrics(row).occupancy, ...categories }
  })
  const volatility = categoryPeriod.map(category => {
    const values = data.expenses.filter(row => row.year === year && row.category === category.name).map(row => row.amount)
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
    const prior = data.expenses.find(row => row.year === year - 1 && row.month === month && row.category === category.name)?.amount ?? category.value
    return { ...category, variation: prior ? (category.value / prior - 1) * 100 : 0, volatility: average ? deviation / average * 100 : 0 }
  }).sort((a, b) => b.volatility - a.volatility)

  const kpis = [
    { label: 'Ingresos', value: money(selected.revenue), mom: (selected.revenue / previousMonth.revenue - 1) * 100, yoy: (selected.revenue / previousYear.revenue - 1) * 100 },
    { label: 'Ocupación', value: percent(selectedMetrics.occupancy), mom: selectedMetrics.occupancy - previousMetrics.occupancy, yoy: selectedMetrics.occupancy - monthlyMetrics(previousYear).occupancy, points: true },
    { label: 'ADR', value: money(selectedMetrics.adr), mom: (selectedMetrics.adr / previousMetrics.adr - 1) * 100, yoy: (selectedMetrics.adr / monthlyMetrics(previousYear).adr - 1) * 100 },
    { label: 'RevPAR', value: money(selectedMetrics.revpar), mom: (selectedMetrics.revpar / previousMetrics.revpar - 1) * 100, yoy: (selectedMetrics.revpar / monthlyMetrics(previousYear).revpar - 1) * 100 },
    { label: 'Costos', value: financialAccess ? money(selected.costs) : 'Restringido', mom: (selected.costs / previousMonth.costs - 1) * 100, yoy: (selected.costs / previousYear.costs - 1) * 100 },
    { label: 'Resultado', value: financialAccess ? money(selectedMetrics.operatingResult) : 'Restringido', mom: (selectedMetrics.operatingResult / previousMetrics.operatingResult - 1) * 100, yoy: (selectedMetrics.operatingResult / monthlyMetrics(previousYear).operatingResult - 1) * 100 },
  ]

  const bestRoom = [...roomSummary].sort((a, b) => b.revpar - a.revpar)[0]
  const weakRoom = [...roomSummary].sort((a, b) => a.occupancy - b.occupancy)[0]
  const costPerOccupiedRoom = selected.soldNights ? selected.costs / selected.soldNights : 0

  return <div className="page indicators-page">
    <section className="page-heading indicator-heading">
      <div><p className="eyebrow">INTELIGENCIA DEL NEGOCIO</p><h1>Indicadores</h1><p>Compara demanda, precio, habitaciones y costos para tomar decisiones.</p></div>
      <div className="indicator-filters"><label>Año<select value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(item => <option key={item}>{item}</option>)}</select></label><label>Mes<select value={month} onChange={event => setMonth(Number(event.target.value))}>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label></div>
    </section>

    <section className="executive-kpis">{kpis.map(item => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><div><small className={item.mom >= 0 ? 'positive' : 'negative'}>{item.mom >= 0 ? '▲' : '▼'} {item.points ? `${number(Math.abs(item.mom), 1)} pts` : percent(Math.abs(item.mom))} vs mes</small><small className={item.yoy >= 0 ? 'positive' : 'negative'}>{item.yoy >= 0 ? '▲' : '▼'} {item.points ? `${number(Math.abs(item.yoy), 1)} pts` : percent(Math.abs(item.yoy))} vs año</small></div></article>)}</section>

    <nav className="indicator-tabs" aria-label="Secciones de indicadores">{(['Rendimiento', 'Habitaciones', 'Costos'] as IndicatorTab[]).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item === 'Rendimiento' ? <BarChart3 size={16}/> : item === 'Habitaciones' ? <BedDouble size={16}/> : <WalletCards size={16}/>}<span>{item}</span></button>)}</nav>

    {tab === 'Rendimiento' && <PerformanceAnalytics data={performanceTrend} year={year} selected={selected} previousYear={previousYear}/>}
    {tab === 'Habitaciones' && <section className="analytics-section">
      <div className="section-toolbar"><div><span>DESEMPEÑO POR TIPO</span><h2>{MONTHS[month - 1]} {year}</h2></div><label>Habitación<select value={roomCode} onChange={event => setRoomCode(event.target.value as 'TODAS' | RoomCode)}><option value="TODAS">Todas</option>{data.roomPerformance.map(room => <option key={room.code} value={room.code}>{room.code} · {room.name}</option>)}</select></label></div>
      <div className="owner-insight"><Lightbulb size={17}/><p><b>Lectura del periodo:</b> {bestRoom ? `${bestRoom.code} tiene el mejor RevPAR (${money(bestRoom.revpar)}).` : 'Sin datos.'} {weakRoom && bestRoom?.code !== weakRoom.code ? `${weakRoom.code} requiere atención por su ocupación de ${percent(weakRoom.occupancy)}.` : ''}</p></div>
      <div className="analytics-grid room-main-grid"><article className="panel"><header><div><span>COMPARACIÓN</span><h2>Ingreso, ADR y noches vendidas</h2></div></header><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={roomSummary}><CartesianGrid stroke="#e4ddd2" vertical={false}/><XAxis dataKey="code"/><YAxis yAxisId="money" tickFormatter={value => `${Math.round(value / 1000)}k`}/><YAxis yAxisId="nights" orientation="right"/><Tooltip formatter={(value: number, name: string) => name.includes('Noches') ? number(value, 0) : money(value)}/><Legend/><Bar yAxisId="money" dataKey="revenue" name="Ingreso" fill="#526b7d"/><Line yAxisId="money" dataKey="adr" name="ADR" stroke="#b17c45" strokeWidth={2.5}/><Line yAxisId="nights" dataKey="soldNights" name="Noches vendidas" stroke="#667858" strokeWidth={2.5}/></ComposedChart></ResponsiveContainer></div></article>
        <article className="panel"><header><div><span>CONTRIBUCIÓN</span><h2>Distribución del ingreso</h2></div></header><DonutChart data={roomSummary.map(room => ({ name: room.code, value: room.revenue }))} colors={ROOM_COLORS} center={money(totalRoomRevenue)}/></article></div>
      <article className="panel matrix-panel"><header><div><span>COMPORTAMIENTO MENSUAL</span><h2>Qué habitación funciona mejor en cada mes</h2></div><div className="metric-switch">{(['revenue', 'occupancy', 'adr', 'revpar'] as RoomMetric[]).map(metric => <button key={metric} className={roomMetric === metric ? 'active' : ''} onClick={() => setRoomMetric(metric)}>{metric === 'revenue' ? 'Ingreso' : metric === 'occupancy' ? 'Ocupación' : metric.toUpperCase()}</button>)}</div></header><RoomMatrix rows={data.roomMonthly.filter(row => row.year === year && (roomCode === 'TODAS' || row.code === roomCode))} metric={roomMetric} names={roomNames}/></article>
      <article className="panel room-table"><header><div><span>DETALLE DEL PERIODO</span><h2>Rentabilidad por habitación</h2></div></header><div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Noches vendidas</th><th>Ocupación</th><th>ADR</th><th>RevPAR</th><th>Ingreso</th><th>Aporte</th></tr></thead><tbody>{roomSummary.map(room => <tr key={room.code}><td><b>{room.code}</b><small>{roomNames.get(room.code)}</small></td><td>{room.soldNights}</td><td>{percent(room.occupancy)}</td><td>{money(room.adr)}</td><td>{money(room.revpar)}</td><td>{money(room.revenue)}</td><td>{percent(totalRoomRevenue ? room.revenue / totalRoomRevenue * 100 : 0)}</td></tr>)}</tbody></table></div></article>
    </section>}

    {tab === 'Costos' && (financialAccess ? <section className="analytics-section">
      <div className="owner-insight"><Lightbulb size={17}/><p><b>Lectura del periodo:</b> cada noche ocupada cuesta {money(costPerOccupiedRoom)}. La categoría más variable es <b>{volatility[0]?.name}</b> ({percent(volatility[0]?.volatility ?? 0)} de fluctuación); conviene revisar compras o contratos.</p></div>
      <div className="analytics-grid cost-main-grid"><article className="panel"><header><div><span>COSTOS Y DEMANDA</span><h2>¿Los gastos se mueven con la ocupación?</h2></div></header><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={costTrend}><CartesianGrid stroke="#e4ddd2" vertical={false}/><XAxis dataKey="month"/><YAxis yAxisId="money" tickFormatter={value => `${Math.round(value / 1000)}k`}/><YAxis yAxisId="percent" orientation="right" domain={[0, 100]} tickFormatter={value => `${value}%`}/><Tooltip formatter={(value: number, name: string) => name === 'Ocupación' ? percent(value) : money(value)}/><Legend/>{categoryPeriod.map((category, index) => <Bar key={category.name} yAxisId="money" stackId="cost" dataKey={category.name} name={category.name} fill={COST_COLORS[index % COST_COLORS.length]}/>)}<Line yAxisId="percent" dataKey="occupancy" name="Ocupación" stroke="#2e4657" strokeWidth={2.5}/></ComposedChart></ResponsiveContainer></div></article>
        <article className="panel"><header><div><span>DESGLOSE</span><h2>¿En qué se gastó?</h2></div></header><DonutChart data={categoryPeriod} colors={COST_COLORS} center={money(selected.costs)}/></article></div>
      <article className="panel"><header><div><span>CONTROL DE VARIACIONES</span><h2>Gastos que más cambian</h2></div></header><div className="table-scroll"><table><thead><tr><th>Categoría</th><th>{MONTHS[month - 1]} {year}</th><th>Variación anual</th><th>Fluctuación</th><th>Lectura</th></tr></thead><tbody>{volatility.map(row => <tr key={row.name}><td><b>{row.name}</b></td><td>{money(row.value)}</td><td className={row.variation > 0 ? 'negative' : 'positive'}>{row.variation > 0 ? '+' : ''}{percent(row.variation)}</td><td>{percent(row.volatility)}</td><td><span className={`control-tag ${row.volatility > 6 ? 'watch' : ''}`}>{row.volatility > 6 ? 'Revisar' : 'Estable'}</span></td></tr>)}</tbody></table></div></article>
    </section> : <section className="access-note">El desglose de costos está disponible únicamente para Dueño, Gerencia y Administración.</section>)}
  </div>
}

function PerformanceAnalytics({ data, year, selected, previousYear }: { data: Array<Record<string, number | string>>; year: number; selected: DashboardData['monthly'][number]; previousYear: DashboardData['monthly'][number] }) {
  const selectedMetrics = monthlyMetrics(selected)
  const priorMetrics = monthlyMetrics(previousYear)
  const rateSignal = selectedMetrics.occupancy > priorMetrics.occupancy && selectedMetrics.adr < priorMetrics.adr
  const costGrowth = (selected.costs / previousYear.costs - 1) * 100
  return <section className="analytics-section">
    <div className="owner-insight"><Lightbulb size={17}/><p><b>Lectura del periodo:</b> {rateSignal ? 'la ocupación creció, pero el ADR bajó; existe espacio para proteger mejor la tarifa.' : `el RevPAR está ${selectedMetrics.revpar >= priorMetrics.revpar ? 'por encima' : 'por debajo'} del mismo mes del año anterior.`} Los costos cambiaron {percent(Math.abs(costGrowth))} anual.</p></div>
    <div className="analytics-grid performance-grid">
      <article className="panel"><header><div><span>PRECIO VS. DEMANDA</span><h2>Ocupación y ADR mensual</h2></div><span className="data-state">{year}</span></header><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid stroke="#e4ddd2" vertical={false}/><XAxis dataKey="month"/><YAxis yAxisId="percent" domain={[0, 100]} tickFormatter={value => `${value}%`}/><YAxis yAxisId="money" orientation="right" tickFormatter={value => `$${Math.round(value / 100) / 10}k`}/><Tooltip formatter={(value: number, name: string) => name === 'Ocupación' ? percent(value) : money(value)}/><Legend/><Bar yAxisId="percent" dataKey="occupancy" name="Ocupación" fill="#7d8f6c"/><Line yAxisId="money" dataKey="adr" name="ADR" stroke="#9b6b58" strokeWidth={2.5}/></ComposedChart></ResponsiveContainer></div></article>
      <article className="panel"><header><div><span>RENTABILIDAD DEL INVENTARIO</span><h2>RevPAR vs. {year - 1}</h2></div></header><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid stroke="#e4ddd2" vertical={false}/><XAxis dataKey="month"/><YAxis tickFormatter={value => `$${Math.round(value / 100) / 10}k`}/><Tooltip formatter={(value: number) => money(value)}/><Legend/><Line type="monotone" dataKey="previousRevpar" name={`${year - 1}`} stroke="#b9aa96" strokeWidth={2}/><Line type="monotone" dataKey="revpar" name={`${year}`} stroke="#526b7d" strokeWidth={3}/></ComposedChart></ResponsiveContainer></div></article>
    </div>
    <article className="panel financial-trend"><header><div><span>RESULTADO OPERATIVO</span><h2>Ingresos, costos y resultado mensual</h2></div></header><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="#e4ddd2" vertical={false}/><XAxis dataKey="month"/><YAxis tickFormatter={value => `${Math.round(value / 1000)}k`}/><Tooltip formatter={(value: number) => money(value)}/><Legend/><Bar dataKey="revenue" name="Ingresos" fill="#526b7d"/><Bar dataKey="costs" name="Costos" fill="#b99157"/><Bar dataKey="result" name="Resultado" fill="#667858"/></BarChart></ResponsiveContainer></div></article>
  </section>
}

function DonutChart({ data, colors, center }: { data: { name: string; value: number }[]; colors: string[]; center: string }) {
  return <div className="donut-wrap"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2}>{data.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]}/>)}</Pie><Tooltip formatter={(value: number) => money(value)}/><Legend wrapperStyle={{ fontSize: 9 }}/></PieChart></ResponsiveContainer><div className="donut-center"><span>Total</span><b>{center}</b></div></div>
}

function RoomMatrix({ rows, metric, names }: { rows: RoomMonthlyPerformance[]; metric: RoomMetric; names: Map<RoomCode, string> }) {
  const codes = [...new Set(rows.map(row => row.code))]
  const value = (row?: RoomMonthlyPerformance) => {
    if (!row) return '—'
    if (metric === 'revenue') return money(row.revenue)
    if (metric === 'occupancy') return percent(row.soldNights / row.availableNights * 100, 0)
    if (metric === 'adr') return money(row.revenue / row.soldNights)
    return money(row.revenue / row.availableNights)
  }
  return <div className="room-matrix-wrap"><table className="room-matrix"><thead><tr><th>Habitación</th>{MONTHS.map(month => <th key={month}>{month}</th>)}</tr></thead><tbody>{codes.map(code => <tr key={code}><td><b>{code}</b><small>{names.get(code)}</small></td>{MONTHS.map((_, index) => { const row = rows.find(item => item.code === code && item.month === index + 1); const occupancy = row ? row.soldNights / row.availableNights * 100 : 0; return <td key={index} className={occupancy >= 75 ? 'strong' : occupancy < 55 ? 'weak' : ''}>{value(row)}</td> })}</tr>)}</tbody></table></div>
}
