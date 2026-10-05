import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { DashboardData, RateMetric, RMSRecommendation, RoomCode } from '../types'
import { longDate, money, percent, shortDate, toneForOccupancy } from '../utils'

type Props = {
  data: DashboardData
  initialRecommendationId?: string
  onNotify: (message: string) => void
}

const roomOrder: RoomCode[] = ['NAY', "NA'", 'CHA', 'KAA', 'MUU']

export function RatesView({ data, initialRecommendationId, onNotify }: Props) {
  const [horizon, setHorizon] = useState(30)
  const [metric, setMetric] = useState<RateMetric>('recommendedRate')
  const [selected, setSelected] = useState<RMSRecommendation | null>(null)

  useEffect(() => {
    const target = data.recommendations.find(item => item.id === initialRecommendationId)
    if (target) setSelected(target)
  }, [data.recommendations, initialRecommendationId])

  const dates = useMemo(() => [...new Set(data.recommendations.map(row => row.date))].slice(0, horizon), [data.recommendations, horizon])
  const visible = useMemo(() => data.recommendations.filter(row => dates.includes(row.date)), [data.recommendations, dates])
  const lookup = useMemo(() => new Map(visible.map(row => [`${row.roomCode}|${row.date}`, row])), [visible])
  const averageCurrent = visible.reduce((sum, row) => sum + row.currentRate, 0) / visible.length
  const averageRecommended = visible.reduce((sum, row) => sum + row.recommendedRate, 0) / visible.length
  const occupied = visible.reduce((sum, row) => sum + row.occupied, 0)
  const capacity = visible.reduce((sum, row) => sum + row.capacity, 0)

  const cellValue = (row: RMSRecommendation) => {
    if (metric === 'occupancy') return percent(row.occupancy, 0)
    if (metric === 'difference') return `${row.recommendedRate >= row.currentRate ? '+' : ''}${money(row.recommendedRate - row.currentRate)}`
    return money(row[metric])
  }

  return <div className="page rms-page">
    <section className="page-heading">
      <div><p className="eyebrow">REVENUE MANAGEMENT</p><h1>RMS / Tarifas</h1><p>Vista simple de precio, ocupación y disponibilidad futura.</p></div>
      <span className="simulation-label">DATOS DE DEMOSTRACIÓN</span>
    </section>

    <section className="rms-toolbar">
      <div className="segmented">{[14, 30, 90, 180].map(days => <button key={days} className={horizon === days ? 'active' : ''} onClick={() => setHorizon(days)}>{days} días</button>)}</div>
      <label>Mostrar<select value={metric} onChange={event => setMetric(event.target.value as RateMetric)}><option value="recommendedRate">Tarifa recomendada</option><option value="currentRate">Tarifa actual</option><option value="difference">Diferencia</option><option value="occupancy">Ocupación</option></select></label>
      <div className="rms-legend"><span><i className="low"/>Baja</span><span><i/>Normal</span><span><i className="high"/>Alta</span><span><i className="hot"/>Muy alta</span></div>
    </section>

    <section className="rate-summary rms-summary">
      <div><span>Tarifa promedio actual</span><strong>{money(averageCurrent)}</strong></div>
      <div><span>Tarifa recomendada</span><strong>{money(averageRecommended)}</strong></div>
      <div><span>Ocupación prevista</span><strong>{percent(occupied / capacity * 100)}</strong></div>
      <div><span>Horizonte visible</span><strong>{horizon} días</strong></div>
    </section>

    <section className="panel rms-matrix-panel">
      <header><div><span>CALENDARIO TARIFARIO</span><h2>Precio por tipo de habitación y fecha</h2></div></header>
      <div className="rms-matrix-scroll">
        <div className="rms-matrix" style={{ gridTemplateColumns: `150px repeat(${dates.length}, 104px)` }}>
          <div className="matrix-corner">Tipo / fecha</div>
          {dates.map(date => <div className="matrix-date" key={date}><b>{shortDate(date)}</b><small>{new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(new Date(`${date}T12:00:00`))}</small></div>)}
          {roomOrder.map(roomCode => <MatrixRow key={roomCode} roomCode={roomCode} dates={dates} lookup={lookup} cellValue={cellValue} onSelect={setSelected}/>)}
        </div>
      </div>
      <footer className="matrix-help">Selecciona una celda para ver sus datos. El calendario se conectará después con Google Sheets y el RMS de Python.</footer>
    </section>

    {selected && <SimpleRateDrawer row={selected} onClose={() => setSelected(null)} onNotify={onNotify}/>}
  </div>
}

function MatrixRow({ roomCode, dates, lookup, cellValue, onSelect }: {
  roomCode: RoomCode
  dates: string[]
  lookup: Map<string, RMSRecommendation>
  cellValue: (row: RMSRecommendation) => string
  onSelect: (row: RMSRecommendation) => void
}) {
  const first = lookup.get(`${roomCode}|${dates[0]}`)
  return <>
    <div className="matrix-room"><b>{roomCode}</b><small>{first?.roomName} · {first?.capacity} hab.</small></div>
    {dates.map(date => { const row = lookup.get(`${roomCode}|${date}`)!; return <button key={date} className={`matrix-cell ${toneForOccupancy(row.occupancy)}`} onClick={() => onSelect(row)}>
      <b>{cellValue(row)}</b><small>{row.occupied}/{row.capacity} ocupadas</small>
    </button> })}
  </>
}

function SimpleRateDrawer({ row, onClose, onNotify }: { row: RMSRecommendation; onClose: () => void; onNotify: (message: string) => void }) {
  const [rate, setRate] = useState(row.recommendedRate)
  return <div className="drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="drawer simple-drawer">
      <header><div><span>DETALLE DE TARIFA</span><h2>{row.roomCode} · {longDate(row.date)}</h2><p>{row.roomName}</p></div><button aria-label="Cerrar" onClick={onClose}><X size={18}/></button></header>
      <section className="drawer-stats">
        <div><span>Tarifa actual</span><b>{money(row.currentRate)}</b></div><div><span>Recomendada</span><b>{money(row.recommendedRate)}</b></div>
        <div><span>Ocupación</span><b>{row.occupied}/{row.capacity} · {percent(row.occupancy)}</b></div><div><span>Disponibles</span><b>{row.available}</b></div>
        <div><span>Pickup 7 días</span><b>+{row.pickup7}</b></div><div><span>Demanda</span><b>{row.demand}</b></div>
      </section>
      <section className="explanation"><span>RECOMENDACIÓN</span><p>{row.reason}</p></section>
      <label className="field">Precio a utilizar<input type="number" step="10" value={rate} onChange={event => setRate(Number(event.target.value))}/></label>
      <footer><button onClick={onClose}>Cancelar</button><button className="primary-action" onClick={() => { onNotify(`Simulación: tarifa ${row.roomCode} en ${money(rate)}`); onClose() }}>Guardar simulación</button></footer>
    </aside>
  </div>
}
