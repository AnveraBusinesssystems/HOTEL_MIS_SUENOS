import { useEffect, useMemo, useState } from 'react'
import { CloudUpload, X } from 'lucide-react'
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
  const [publishOpen, setPublishOpen] = useState(false)

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
      <div className="page-heading-actions">
        <span className="simulation-label">DATOS DE DEMOSTRACIÓN</span>
        <button className="cloudbeds-action" onClick={() => setPublishOpen(true)}><CloudUpload size={15}/> Publicar en Cloudbeds</button>
      </div>
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
    {publishOpen && <CloudbedsPublishDialog recommendations={data.recommendations} onClose={() => setPublishOpen(false)} onNotify={onNotify}/>}
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

function CloudbedsPublishDialog({ recommendations, onClose, onNotify }: {
  recommendations: RMSRecommendation[]
  onClose: () => void
  onNotify: (message: string) => void
}) {
  const firstDate = recommendations[0]?.date ?? ''
  const lastDate = recommendations.at(-1)?.date ?? ''
  const defaultEnd = recommendations[29 * roomOrder.length]?.date ?? lastDate
  const [startDate, setStartDate] = useState(firstDate)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [rooms, setRooms] = useState<RoomCode[]>(roomOrder)

  const selectedRates = useMemo(() => recommendations.filter(row => (
    row.date >= startDate && row.date <= endDate && rooms.includes(row.roomCode)
  )), [endDate, recommendations, rooms, startDate])
  const invalidRange = !startDate || !endDate || startDate > endDate

  const toggleRoom = (roomCode: RoomCode) => {
    setRooms(current => current.includes(roomCode)
      ? current.filter(code => code !== roomCode)
      : [...current, roomCode])
  }

  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="publish-dialog" role="dialog" aria-modal="true" aria-labelledby="cloudbeds-title">
      <header>
        <div><span>CONEXIÓN FUTURA</span><h2 id="cloudbeds-title">Publicar tarifas en Cloudbeds</h2><p>Selecciona el periodo y los tipos de habitación que recibirán la tarifa recomendada.</p></div>
        <button aria-label="Cerrar" onClick={onClose}><X size={18}/></button>
      </header>
      <div className="publish-notice"><CloudUpload size={16}/><p><b>Modo de simulación.</b> Todavía no se enviará información a Cloudbeds.</p></div>
      <div className="publish-dates">
        <label>Desde<input type="date" min={firstDate} max={lastDate} value={startDate} onChange={event => setStartDate(event.target.value)}/></label>
        <label>Hasta<input type="date" min={firstDate} max={lastDate} value={endDate} onChange={event => setEndDate(event.target.value)}/></label>
      </div>
      <fieldset className="publish-rooms">
        <legend>Tipos de habitación</legend>
        {roomOrder.map(roomCode => {
          const room = recommendations.find(row => row.roomCode === roomCode)
          return <label key={roomCode}><input type="checkbox" checked={rooms.includes(roomCode)} onChange={() => toggleRoom(roomCode)}/><span><b>{roomCode}</b><small>{room?.roomName}</small></span></label>
        })}
      </fieldset>
      <div className="publish-summary"><span>Tarifas preparadas</span><strong>{invalidRange ? 0 : selectedRates.length}</strong><small>Una tarifa por fecha y tipo de habitación seleccionado.</small></div>
      <footer>
        <button onClick={onClose}>Cancelar</button>
        <button className="primary-action" disabled={invalidRange || rooms.length === 0} onClick={() => {
          onNotify(`Simulación Cloudbeds preparada: ${selectedRates.length} tarifas`)
          onClose()
        }}><CloudUpload size={14}/> Simular publicación</button>
      </footer>
    </section>
  </div>
}
