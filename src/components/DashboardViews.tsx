import { AlertTriangle, ArrowRight, CalendarRange, TrendingUp } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { DashboardData, KPI, Role } from '../types'
import { kpiValue, money, monthlyMetrics, number, percent, shortDate } from '../utils'

type SummaryProps = {
  data: DashboardData
  role: Role
  onOpenRms: (recommendationId?: string) => void
}

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
          <small>Anterior {kpiValue(kpi, kpi.previous)}</small>
        </div>
      </article>
    })}
  </section>
}

export function SummaryView({ data, role, onOpenRms }: SummaryProps) {
  const financialAccess = ['Dueño', 'Gerencia', 'Administración'].includes(role)
  const nextSeven = data.rateDays.slice(0, 7)
  const occupied = nextSeven.reduce((sum, day) => sum + day.occupied, 0)
  const capacity = nextSeven.length * 17
  const forwardOccupancy = capacity ? occupied / capacity * 100 : 0
  const revenue = data.kpis.find(kpi => kpi.id === 'revenue')?.value ?? 0
  const result = revenue - data.costs.registered - data.costs.estimated

  return <div className="page">
    <section className="page-heading">
      <div><p className="eyebrow">CONTROL EJECUTIVO</p><h1>Resumen</h1><p>Lo ocurrido, lo esperado y las decisiones que requieren atención.</p></div>
      <div className="status-strip">
        <span><i className="dot good"/> Próximos 7 días</span>
        <strong>{number(forwardOccupancy)}%</strong>
        <small>{occupied} de {capacity} noches ocupadas</small>
      </div>
    </section>

    <KpiCards kpis={data.kpis}/>

    <section className="decision-panel">
      <header>
        <div><span>DECISIONES PRIORITARIAS</span><h2>Oportunidades con mayor impacto</h2></div>
        <button onClick={() => onOpenRms()}>Abrir centro RMS <ArrowRight size={14}/></button>
      </header>
      <div className="decision-grid">
        {data.alerts.slice(0, 3).map(alert => <button className="decision-card" key={alert.id} onClick={() => onOpenRms(alert.recommendationId)}>
          <span className={`severity ${alert.level.toLowerCase()}`}><AlertTriangle size={15}/></span>
          <div><b>{alert.title}</b><p>{alert.message}</p></div>
          <aside><small>Impacto estimado</small><strong>{money(alert.estimatedImpact ?? 0)}</strong><em>{shortDate(alert.date)}</em></aside>
        </button>)}
      </div>
    </section>

    <section className="grid two">
      <article className="panel performance-panel">
        <header><div><span>DESEMPEÑO RECIENTE</span><h2>Ingresos y ocupación</h2></div><span className="data-state">REAL</span></header>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.performance} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e4ddd2" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="money" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={value => `${Math.round(value / 1000)}k`}/>
              <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`}/>
              <Tooltip formatter={(value: number, name: string) => name === 'Ocupación' ? percent(value) : money(value)}/>
              <Legend wrapperStyle={{ fontSize: 10 }}/>
              <Bar yAxisId="money" dataKey="ingresos" name="Ingresos" fill="#243f5c" radius={[2, 2, 0, 0]}/>
              <Line yAxisId="percent" type="monotone" dataKey="ocupacion" name="Ocupación" stroke="#83936f" strokeWidth={2.5} dot={{ r: 3 }}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel next-days-panel">
        <header><div><span>PRÓXIMOS 7 DÍAS</span><h2>Ocupación y disponibilidad</h2></div><button onClick={() => onOpenRms()}>Ver 180 días</button></header>
        <div className="next-days-list">
          {nextSeven.map(day => <button key={day.date} onClick={() => onOpenRms(`${day.date}-CHA`)}>
            <span>{shortDate(day.date)}</span>
            <b>{day.occupied}/17</b>
            <div className="occupancy-track"><i style={{ width: `${day.occupancy}%` }}/></div>
            <strong>{number(day.occupancy, 0)}%</strong>
            <small>{day.available} libres</small>
          </button>)}
        </div>
      </article>
    </section>

    <section className="grid two lower">
      <article className="panel">
        <header><div><span>TIPOS DE HABITACIÓN</span><h2>Desempeño del mes</h2></div></header>
        <div className="table-scroll"><table>
          <thead><tr><th>Tipo</th><th>Hab.</th><th>Ocup.</th><th>ADR</th><th>RevPAR</th><th>Tarifa</th></tr></thead>
          <tbody>{data.roomPerformance.map(room => <tr key={room.code}>
            <td><b>{room.code}</b><small>{room.name}</small></td><td>{room.rooms}</td><td>{percent(room.occupancy)}</td>
            <td>{money(room.adr)}</td><td>{money(room.revpar)}</td><td><b>{money(room.currentRate)}</b></td>
          </tr>)}</tbody>
        </table></div>
      </article>
      <article className="panel">
        <header><div><span>FORECAST</span><h2>Ocupación próximos días</h2></div><span className="data-state forecast">PRONÓSTICO</span></header>
        <div className="chart-wrap small"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={nextSeven}><CartesianGrid stroke="#e4ddd2" vertical={false}/><XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 9 }} axisLine={false} tickLine={false}/><YAxis domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false}/><Tooltip formatter={(value: number) => percent(value)}/><Bar dataKey="occupancy" name="Ocupación" fill="#243f5c"/></BarChart>
        </ResponsiveContainer></div>
      </article>
    </section>

    {financialAccess ? <section className="profit-strip">
      <div><span>RESULTADO OPERATIVO · ESTIMACIÓN</span><strong>{money(result)}</strong></div>
      <div><span>Costos registrados</span><b>{money(data.costs.registered)}</b></div>
      <div><span>Costos estimados</span><b>{money(data.costs.estimated)}</b></div>
      <div><span>Margen estimado</span><b>{percent(result / revenue * 100)}</b></div>
      <em>DATOS INCOMPLETOS</em>
    </section> : <section className="access-note">La información financiera completa no está disponible para el rol <b>{role}</b>.</section>}
  </div>
}

export function IndicatorsView({ data, role }: { data: DashboardData; role: Role }) {
  const financialAccess = ['Dueño', 'Gerencia', 'Administración'].includes(role)
  const current = data.monthly.find(row => row.key === '2026-10') ?? data.monthly.at(-1)!
  const previous = data.monthly.find(row => row.key === '2026-09')!
  const lastYear = data.monthly.find(row => row.key === '2025-10')!
  const currentMetrics = monthlyMetrics(current)
  const rows2026 = data.monthly.filter(row => row.year === 2026)
  const comparison = rows2026.map(row => {
    const prior = data.monthly.find(item => item.year === 2025 && item.month === row.month)!
    return { month: row.label.split(' ')[0], actual: row.revenue, previous: prior.revenue }
  })

  const reviewRows = [current, previous, lastYear]
  const bestRoom = [...data.roomPerformance].sort((a, b) => b.revpar - a.revpar)[0]
  const lowRoom = [...data.roomPerformance].sort((a, b) => a.occupancy - b.occupancy)[0]
  const yoy = (current.revenue / lastYear.revenue - 1) * 100
  const mom = (current.revenue / previous.revenue - 1) * 100

  return <div className="page">
    <section className="page-heading">
      <div><p className="eyebrow">ANÁLISIS DE DESEMPEÑO</p><h1>Indicadores</h1><p>Comparación mensual y anual con métricas calculadas desde una sola fuente.</p></div>
      <div className="status-strip"><span><CalendarRange size={13}/> Revisión seleccionada</span><strong>Oct 2026</strong><small>Real + pronóstico de cierre</small></div>
    </section>

    <section className="review-banner">
      <div><span>Ingresos del mes</span><strong>{money(current.revenue)}</strong><small>Pronóstico {money(current.forecastRevenue)}</small></div>
      <div><span>Ocupación</span><strong>{percent(currentMetrics.occupancy)}</strong><small>Pronóstico {percent(current.forecastOccupancy)}</small></div>
      <div><span>ADR</span><strong>{money(currentMetrics.adr)}</strong><small>{current.soldNights} noches vendidas</small></div>
      <div><span>RevPAR</span><strong>{money(currentMetrics.revpar)}</strong><small>{current.availableNights} disponibles</small></div>
      <div><span>Resultado estimado</span><strong>{financialAccess ? money(currentMetrics.operatingResult) : 'Restringido'}</strong><small>{financialAccess ? `${percent(currentMetrics.margin)} de margen` : 'Solo administración'}</small></div>
    </section>

    <section className="grid two indicators-grid">
      <article className="panel">
        <header><div><span>COMPARACIÓN ANUAL</span><h2>Ingresos 2026 vs. 2025</h2></div><span className="data-state">MENSUAL</span></header>
        <div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={comparison}><CartesianGrid stroke="#e4ddd2" vertical={false}/><XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={value => `${Math.round(value / 1000)}k`}/><Tooltip formatter={(value: number) => money(value)}/><Legend wrapperStyle={{ fontSize: 10 }}/><Area type="monotone" dataKey="previous" name="2025" stroke="#9b8d7c" fill="#ded5c9" fillOpacity={0.45}/><Area type="monotone" dataKey="actual" name="2026" stroke="#243f5c" fill="#243f5c" fillOpacity={0.14}/></AreaChart>
        </ResponsiveContainer></div>
      </article>
      <article className="panel insights-panel">
        <header><div><span>LECTURA AUTOMÁTICA</span><h2>Qué cambió este mes</h2></div><TrendingUp size={17}/></header>
        <ul>
          <li><b>{mom >= 0 ? 'Crecimiento mensual' : 'Caída mensual'}</b><span>Los ingresos cambiaron {percent(Math.abs(mom))} frente a septiembre.</span></li>
          <li><b>{yoy >= 0 ? 'Mejora anual' : 'Retroceso anual'}</b><span>Octubre está {percent(Math.abs(yoy))} {yoy >= 0 ? 'arriba' : 'abajo'} del mismo mes de 2025.</span></li>
          <li><b>Mejor RevPAR: {bestRoom.code}</b><span>{bestRoom.name} genera {money(bestRoom.revpar)} por habitación disponible.</span></li>
          <li><b>Atención: {lowRoom.code}</b><span>Es el tipo con menor ocupación, con {percent(lowRoom.occupancy)}.</span></li>
        </ul>
      </article>
    </section>

    <section className="panel monthly-review">
      <header><div><span>REVISIÓN MENSUAL</span><h2>Mes actual, mes anterior y año anterior</h2></div><span className="data-state forecast">REAL / FORECAST</span></header>
      <div className="table-scroll"><table>
        <thead><tr><th>Periodo</th><th>Ingresos</th><th>Ocupación</th><th>ADR</th><th>RevPAR</th><th>Reservas</th><th>Cancelación</th><th>Costos</th><th>Resultado</th></tr></thead>
        <tbody>{reviewRows.map(row => { const metric = monthlyMetrics(row); return <tr key={row.key}>
          <td><b>{row.label}</b>{row.key === current.key && <small>Pronóstico cierre: {money(row.forecastRevenue)}</small>}</td>
          <td>{money(row.revenue)}</td><td>{percent(metric.occupancy)}</td><td>{money(metric.adr)}</td><td>{money(metric.revpar)}</td><td>{row.bookings}</td><td>{percent(metric.cancellationRate)}</td><td>{financialAccess ? money(row.costs) : '—'}</td><td>{financialAccess ? money(metric.operatingResult) : '—'}</td>
        </tr>})}</tbody>
      </table></div>
    </section>
  </div>
}
