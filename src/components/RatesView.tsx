import { useEffect, useMemo, useState } from 'react'
import { CloudUpload, X } from 'lucide-react'
import type { DashboardData, RateMetric, RMSCalendarEntry, RMSRecommendation, RoomCode } from '../types'
import { longDate, money, percent, shortDate, toneForOccupancy } from '../utils'

type Props = {
  data: DashboardData
  initialRecommendationId?: string
  onNotify: (message: string) => void
}

const roomOrder: RoomCode[] = ['NAY', 'NA', 'CHA', 'KAA', 'MUU']

export function RatesView({ data, initialRecommendationId, onNotify }: Props) {
  const [horizon, setHorizon] = useState(30)
  const [metric, setMetric] = useState<RateMetric>('occupancy')
  const [selected, setSelected] = useState<RMSCalendarEntry | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)

  // Los precios del modelo se integrarán cuando exista un generador de
  // recomendaciones. Nunca utilizar el ADR histórico como tarifa vigente.
  const recommendations = useMemo(
    () => new Map(data.recommendations.map(row => [row.id, row])),
    [data.recommendations],
  )
  const calendar = useMemo(() => data.rmsCalendar.map(row => {
    const recommendation = recommendations.get(row.id)
    return recommendation ? {
      ...row,
      currentRate: recommendation.currentRate,
      recommendedRate: recommendation.recommendedRate,
      pickup7: recommendation.pickup7,
      demand: recommendation.demand,
      reason: recommendation.reason,
    } : row
  }), [data.rmsCalendar, recommendations])

  useEffect(() => {
    const target = calendar.find(row => row.id === initialRecommendationId)
    if (target) setSelected(target)
  }, [calendar, initialRecommendationId])

  const dates = useMemo(
    () => [...new Set(calendar.map(row => row.date))].sort().slice(0, horizon),
    [calendar, horizon],
  )
  const visible = useMemo(() => calendar.filter(row => dates.includes(row.date)), [calendar, dates])
  const lookup = useMemo(() => new Map(visible.map(row => [row.id, row])), [visible])
  const validCurrent = visible.filter(row => row.currentRate != null)
  const validRecommended = visible.filter(row => row.recommendedRate != null)
  const averageCurrent = validCurrent.length
    ? validCurrent.reduce((sum, row) => sum + (row.currentRate ?? 0), 0) / validCurrent.length : null
  const averageRecommended = validRecommended.length
    ? validRecommended.reduce((sum, row) => sum + (row.recommendedRate ?? 0), 0) / validRecommended.length : null
  const occupied = visible.reduce((sum, row) => sum + row.occupied, 0)
  const capacity = visible.reduce((sum, row) => sum + row.capacity, 0)
  const hasRealRates = visible.length > 0 && validRecommended.length === visible.length
    && validCurrent.length === visible.length

  const cellValue = (row: RMSCalendarEntry) => {
    if (metric === 'occupancy') return percent(row.occupancy, 0)
    if (metric === 'recommendedRate') return row.recommendedRate == null ? '—' : money(row.recommendedRate)
    if (metric === 'currentRate') return row.currentRate == null ? '—' : money(row.currentRate)
    if (row.recommendedRate == null || row.currentRate == null) return '—'
    return `${row.recommendedRate >= row.currentRate ? '+' : ''}${money(row.recommendedRate - row.currentRate)}`
  }

  return <div className="page rms-page">
    <section className="page-heading">
      <div><p className="eyebrow">REVENUE MANAGEMENT</p><h1>RMS / Tarifas</h1><p>Vista de ocupación por tipo de habitación y fecha. Las tarifas se conectarán después.</p></div>
      <div className="page-heading-actions">
        <span className="simulation-label">{hasRealRates ? 'TARIFAS DISPONIBLES' : visible.length ? 'OCUPACIÓN CONECTADA · TARIFAS PENDIENTES' : 'SIN DATOS CONECTADOS'}</span>
        <button className="cloudbeds-action" onClick={() => setPublishOpen(true)} disabled={!hasRealRates}><CloudUpload size={15}/> Publicar en Cloudbeds</button>
      </div>
    </section>

    <section className="rms-toolbar">
      <div className="segmented">{[14, 30, 90, 180].map(days => <button key={days} className={horizon === days ? 'active' : ''} onClick={() => setHorizon(days)}>{days} días</button>)}</div>
      <label>Mostrar<select value={metric} onChange={event => setMetric(event.target.value as RateMetric)}><option value="occupancy">Ocupación</option><option value="recommendedRate">Tarifa recomendada</option><option value="currentRate">Tarifa actual</option><option value="difference">Diferencia</option></select></label>
      <div className="rms-legend"><span><i className="low"/>Baja</span><span><i/>Normal</span><span><i className="high"/>Alta</span><span><i className="hot"/>Muy alta</span></div>
    </section>

    <section className="rate-summary rms-summary">
      <div><span>Tarifa promedio actual</span><strong>{averageCurrent == null ? '—' : money(averageCurrent)}</strong></div>
      <div><span>Tarifa recomendada</span><strong>{averageRecommended == null ? '—' : money(averageRecommended)}</strong></div>
      <div><span>Ocupación reservada</span><strong>{capacity ? percent(occupied / capacity * 100) : '—'}</strong></div>
      <div><span>Horizonte visible</span><strong>{dates.length ? `${dates.length} días` : '—'}</strong></div>
    </section>

    <section className="panel rms-matrix-panel">
      <header><div><span>CALENDARIO TARIFARIO</span><h2>Habitaciones y disponibilidad por fecha</h2></div></header>
      {dates.length ? <div className="rms-matrix-scroll">
        <div className="rms-matrix" style={{ gridTemplateColumns: `150px repeat(${dates.length}, 104px)` }}>
          <div className="matrix-corner">Tipo / fecha</div>
          {dates.map(date => <div className="matrix-date" key={date}><b>{shortDate(date)}</b><small>{new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(new Date(`${date}T12:00:00`))}</small></div>)}
          {roomOrder.filter(code => calendar.some(row => row.roomCode === code)).map(code =>
            <MatrixRow key={code} roomCode={code} dates={dates} lookup={lookup} cellValue={cellValue} onSelect={setSelected}/>,
          )}
        </div>
      </div> : <div className="empty-panel-state chart-empty">Las fechas y ocupación aparecerán al conectar Apps Script.</div>}
      <footer className="matrix-help">Selecciona una celda para ver detalles. Los precios vigentes, pickup y recomendaciones requieren fuentes adicionales.</footer>
    </section>

    {selected && <RmsDetailDrawer key={selected.id} row={selected} onClose={() => setSelected(null)}/>}
    {publishOpen && <CloudbedsPublishDialog recommendations={data.recommendations} onClose={() => setPublishOpen(false)} onNotify={onNotify}/>}
  </div>
}

function MatrixRow({ roomCode, dates, lookup, cellValue, onSelect }: {
  roomCode: RoomCode
  dates: string[]
  lookup: Map<string, RMSCalendarEntry>
  cellValue: (row: RMSCalendarEntry) => string
  onSelect: (row: RMSCalendarEntry) => void
}) {
  const first = lookup.get(`${dates[0]}-${roomCode}`)
  return <>
    <div className="matrix-room"><b>{roomCode}</b><small>{first?.roomName} · {first?.capacity ?? '—'} hab.</small></div>
    {dates.map(date => {
      const row = lookup.get(`${date}-${roomCode}`)
      return row
        ? <button key={date} className={`matrix-cell ${toneForOccupancy(row.occupancy)}`} onClick={() => onSelect(row)}>
            <b>{cellValue(row)}</b><small>{row.occupied}/{row.capacity} ocupadas</small>
          </button>
        : <div key={date} className="matrix-cell">—</div>
    })}
  </>
}

function RmsDetailDrawer({ row, onClose }: { row: RMSCalendarEntry; onClose: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="drawer simple-drawer">
      <header><div><span>DETALLE RMS</span><h2>{row.roomCode} · {longDate(row.date)}</h2><p>{row.roomName}</p></div><button aria-label="Cerrar" onClick={onClose}><X size={18}/></button></header>
      <section className="drawer-stats">
        <div><span>Tarifa actual</span><b>{row.currentRate == null ? 'Pendiente' : money(row.currentRate)}</b></div>
        <div><span>Recomendada</span><b>{row.recommendedRate == null ? 'Pendiente' : money(row.recommendedRate)}</b></div>
        <div><span>Ocupación reservada</span><b>{row.occupied}/{row.capacity} · {percent(row.occupancy)}</b></div>
        <div><span>Disponibles</span><b>{row.available}</b></div>
        <div><span>Pickup 7 días</span><b>{row.pickup7 == null ? 'Sin histórico' : `+${row.pickup7}`}</b></div>
        <div><span>Demanda</span><b>{row.demand ?? 'Sin pronóstico'}</b></div>
      </section>
      {row.overbooked && <section className="explanation"><span>ATENCIÓN</span><p>Las habitaciones reservadas superan la capacidad activa de esta categoría.</p></section>}
      <section className="explanation"><span>RECOMENDACIÓN</span><p>{row.reason ?? 'El motor de optimización de tarifas todavía no está conectado.'}</p></section>
      <footer><button onClick={onClose}>Cerrar</button></footer>
    </aside>
  </div>
}

function CloudbedsPublishDialog({ recommendations, onClose, onNotify }: {
  recommendations: RMSRecommendation[]
  onClose: () => void
  onNotify: (message: string) => void
}) {
  const dates = [...new Set(recommendations.map(row => row.date))].sort()
  const firstDate = dates[0] ?? ''
  const lastDate = dates.at(-1) ?? ''
  const defaultEnd = dates[Math.min(29, dates.length - 1)] ?? ''
  const [startDate, setStartDate] = useState(firstDate)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [rooms, setRooms] = useState<RoomCode[]>(roomOrder)
  const selectedRates = useMemo(() => recommendations.filter(row =>
    row.date >= startDate && row.date <= endDate && rooms.includes(row.roomCode),
  ), [endDate, recommendations, rooms, startDate])
  const invalidRange = !startDate || !endDate || startDate > endDate
  const toggleRoom = (roomCode: RoomCode) => setRooms(current =>
    current.includes(roomCode) ? current.filter(code => code !== roomCode) : [...current, roomCode],
  )

  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="publish-dialog" role="dialog" aria-modal="true" aria-labelledby="cloudbeds-title">
      <header><div><span>CONEXIÓN FUTURA</span><h2 id="cloudbeds-title">Publicar tarifas en Cloudbeds</h2><p>Preparación de una futura publicación por fecha y categoría.</p></div><button aria-label="Cerrar" onClick={onClose}><X size={18}/></button></header>
      <div className="publish-notice"><CloudUpload size={16}/><p><b>Conexión pendiente.</b> No se enviará información a Cloudbeds.</p></div>
      <div className="publish-dates">
        <label>Desde<input type="date" min={firstDate} max={lastDate} value={startDate} onChange={event => setStartDate(event.target.value)}/></label>
        <label>Hasta<input type="date" min={firstDate} max={lastDate} value={endDate} onChange={event => setEndDate(event.target.value)}/></label>
      </div>
      <fieldset className="publish-rooms"><legend>Tipos de habitación</legend>{roomOrder.map(roomCode =>
        <label key={roomCode}><input type="checkbox" checked={rooms.includes(roomCode)} onChange={() => toggleRoom(roomCode)}/><span><b>{roomCode}</b><small>{recommendations.find(row => row.roomCode === roomCode)?.roomName}</small></span></label>,
      )}</fieldset>
      <div className="publish-summary"><span>Tarifas preparadas</span><strong>{invalidRange ? 0 : selectedRates.length}</strong><small>Una tarifa por día y tipo de habitación seleccionado.</small></div>
      <footer><button onClick={onClose}>Cancelar</button><button className="primary-action" disabled={invalidRange || !selectedRates.length || !rooms.length} onClick={() => { onNotify(`Publicación preparada: ${selectedRates.length} tarifas; falta conectar Cloudbeds`); onClose() }}><CloudUpload size={14}/> Preparar publicación</button></footer>
    </section>
  </div>
}
