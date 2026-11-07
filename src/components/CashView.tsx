import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Banknote, CalendarDays, ChevronRight, CircleDollarSign,
  CreditCard, FileText, Landmark, Plus, Receipt, Search, Trash2, WalletCards, X,
} from 'lucide-react'
import type {
  CashArea, CashDay, CashMovement, CashMovementCategory, CashMovementType,
  CashPaymentMethod, InventoryItem, PurchaseRequest, Reservation, Role,
} from '../types'
import { longDate, money } from '../utils'
import type { CashNewMovement } from '../services/cashService'

interface CashViewProps {
  role: Role
  reservations: Reservation[]
  movements: CashMovement[]
  days: CashDay[]
  inventory: InventoryItem[]
  purchaseRequests: PurchaseRequest[]
  initialPurchaseRequestId?: string
  onReservationsChange: (updater: (rows: Reservation[]) => Reservation[]) => void
  onMovementsChange: (updater: (rows: CashMovement[]) => CashMovement[]) => void
  onDaysChange: (updater: (rows: CashDay[]) => CashDay[]) => void
  onInventoryChange: (updater: (rows: InventoryItem[]) => InventoryItem[]) => void
  onPurchaseRequestsChange: (updater: (rows: PurchaseRequest[]) => PurchaseRequest[]) => void
  onPurchaseRequestOpened: () => void
  canWrite: boolean
  onCreateCash: (movement: CashNewMovement, movementId: string) => Promise<boolean>
  onPayReservation: (reservationKey: string, amount: number, method: CashPaymentMethod, paymentId: string, category: 'Pago de reserva' | 'Anticipo de reserva') => Promise<boolean>
  onAnnulCash: (movementId: string, reason: string) => Promise<boolean>
  onSaveCashDay: (date: string, fields: { openingCash?: number; countedCash?: number }) => Promise<boolean>
  onCloseCashDay: (date: string, note: string, acceptDifference: boolean) => Promise<boolean>
  onNotify: (message: string) => void
}

type Draft = {
  type: CashMovementType
  amount: string
  paymentMethod: CashPaymentMethod
  category: CashMovementCategory
  description: string
  reservationId: string
  purchaseRequestId: string
  purchaseItems: Array<{ id: string; product: string; quantity: string; unit: string; total: string }>
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

const currentTime = () => new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Cancun', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date())

const incomeCategories: CashMovementCategory[] = ['Pago de reserva', 'Anticipo de reserva', 'Venta de restaurante', 'Otro ingreso']
const expenseCategories: CashMovementCategory[] = ['Compra de inventario', 'Mantenimiento', 'Lavandería', 'Servicios', 'Reembolso', 'Gastos externos', 'Retiro de efectivo', 'Otro gasto']
const methods: CashPaymentMethod[] = ['Efectivo', 'Tarjeta', 'Transferencia']
const fallbackInventoryUnits: Record<string, string> = {
  Huevo: 'Piezas',
  Fruta: 'Kilogramos',
  Café: 'Kilogramos',
  'Agua embotellada': 'Piezas',
  'Papel higiénico': 'Paquetes',
  Toallas: 'Piezas',
  'Productos de limpieza': 'Litros',
  'Otro producto': 'Unidades',
}
const newPurchaseItem = () => ({ id: crypto.randomUUID(), product: '', quantity: '', unit: '', total: '' })
const areaForCategory: Record<CashMovementCategory, CashArea> = {
  'Pago de reserva': 'Reservas',
  'Anticipo de reserva': 'Reservas',
  'Venta de restaurante': 'Restaurante',
  'Otro ingreso': 'Recepción',
  'Compra de inventario': 'Administración',
  Mantenimiento: 'Mantenimiento',
  Lavandería: 'Lavandería',
  Servicios: 'Administración',
  Reembolso: 'Recepción',
  'Gastos externos': 'Administración',
  'Retiro de efectivo': 'Administración',
  'Otro gasto': 'Otros',
  'Cobro de tour': 'Recepción',
  'Pago a proveedor de tour': 'Administración',
  'Comisión de tour a recepción': 'Administración',
  'Sin clasificar': 'Otros',
}

const freshDraft = (type: CashMovementType): Draft => ({
  type,
  amount: '',
  paymentMethod: 'Efectivo',
  category: type === 'Entrada' ? 'Pago de reserva' : 'Compra de inventario',
  description: '',
  reservationId: '',
  purchaseRequestId: '',
  purchaseItems: type === 'Salida' ? [newPurchaseItem()] : [],
})

const activeReservation = (reservation: Reservation) => !['Cancelada', 'No show'].includes(reservation.status)
const balance = (reservation: Reservation) => Math.max(0, reservation.total - reservation.paid)

export function CashView({
  role, reservations, movements, days, inventory, purchaseRequests, initialPurchaseRequestId,
  onReservationsChange, onMovementsChange, onDaysChange, onInventoryChange,
  onPurchaseRequestsChange, onPurchaseRequestOpened, canWrite, onCreateCash, onPayReservation, onAnnulCash, onSaveCashDay, onCloseCashDay, onNotify,
}: CashViewProps) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selectedMovement, setSelectedMovement] = useState<CashMovement | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'Todos' | CashMovementType>('Todos')
  const [methodFilter, setMethodFilter] = useState<'Todos' | CashPaymentMethod>('Todos')
  const [counted, setCounted] = useState('')
  const [openingDraft, setOpeningDraft] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [acceptDifference, setAcceptDifference] = useState(false)
  const [saving, setSaving] = useState(false)
  const retry = useRef<{ key: string; id: string } | null>(null)
  const [formError, setFormError] = useState('')

  const canAccess = ['Dueño', 'Gerencia', 'Administración', 'Recepción'].includes(role)
  const canAnnul = ['Dueño', 'Gerencia', 'Administración'].includes(role)
  const recordedDay = days.find(item => item.date === selectedDate)
  const day = recordedDay ?? { date: selectedDate, openingCash: 0 }
  const isClosed = recordedDay?.closed === true
  const dayMovements = movements.filter(item => item.date === selectedDate)
  const activeMovements = dayMovements.filter(item => item.status === 'Registrado')
  const entries = activeMovements.filter(item => item.type === 'Entrada').reduce((sum, item) => sum + item.amount, 0)
  const exits = activeMovements.filter(item => item.type === 'Salida').reduce((sum, item) => sum + item.amount, 0)
  const cashEntries = activeMovements.filter(item => item.type === 'Entrada' && item.paymentMethod === 'Efectivo').reduce((sum, item) => sum + item.amount, 0)
  const cashExits = activeMovements.filter(item => item.type === 'Salida' && item.paymentMethod === 'Efectivo').reduce((sum, item) => sum + item.amount, 0)
  const expectedCash = recordedDay ? day.openingCash + cashEntries - cashExits : null
  const knownReservations = reservations.filter(item => activeReservation(item) && item.paymentKnown !== false)
  const outstanding = knownReservations.reduce((sum, item) => sum + balance(item), 0)
  const unknownBalances = reservations.filter(item => activeReservation(item) && item.paymentKnown === false).length
  const pendingReservations = knownReservations.filter(item => balance(item) > 0).sort((a, b) => balance(b) - balance(a))
  const readyPurchaseRequests = purchaseRequests.filter(item => item.status === 'Tomada en cuenta')
  const hasCashData = movements.length > 0 || days.length > 0
  const allowCashWrite = canWrite && !isClosed

  const openPurchaseRequest = (request: PurchaseRequest) => {
    const next = freshDraft('Salida')
    next.category = 'Compra de inventario'
    next.purchaseRequestId = request.id
    next.description = `Compra basada en ${request.id}`
    next.purchaseItems = request.items.map(item => ({
      id: crypto.randomUUID(),
      product: item.product,
      quantity: String(item.quantity),
      unit: item.unit,
      total: '',
    }))
    onNotify('La compra de inventario requiere conectar su flujo de escritura en Inventory. No se registró un gasto.')
    setDraft(null)
  }

  useEffect(() => {
    if (!initialPurchaseRequestId) return
    const request = purchaseRequests.find(item => item.id === initialPurchaseRequestId)
    if (request?.status === 'Tomada en cuenta') openPurchaseRequest(request)
    onPurchaseRequestOpened()
  }, [initialPurchaseRequestId])

  const methodTotals = methods.map(method => ({
    method,
    entries: activeMovements.filter(item => item.type === 'Entrada' && item.paymentMethod === method).reduce((sum, item) => sum + item.amount, 0),
    exits: activeMovements.filter(item => item.type === 'Salida' && item.paymentMethod === method).reduce((sum, item) => sum + item.amount, 0),
  }))

  const expensesByCategory = useMemo(() => {
    const totals = new Map<CashMovementCategory, number>()
    activeMovements.filter(item => item.type === 'Salida').forEach(item => totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount))
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [activeMovements])

  const filtered = dayMovements.filter(item => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [item.id, item.description, item.area, item.category, item.reservationId, item.tourId, item.purchaseId, item.purchaseRequestId]
      .some(value => value?.toLowerCase().includes(query))
    return matchesSearch && (typeFilter === 'Todos' || item.type === typeFilter) && (methodFilter === 'Todos' || item.paymentMethod === methodFilter)
  }).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))

  if (!canAccess) return <section className="page"><div className="page-heading"><div><p className="eyebrow">CONTROL FINANCIERO</p><h1>Caja</h1><p>Registro operativo de entradas y salidas.</p></div></div><div className="access-note">Tu rol no tiene acceso al movimiento de dinero. Dueño, Gerencia, Administración y Recepción pueden usar este módulo.</div></section>

  const openForm = (type: CashMovementType, reservationId = '') => {
    if (!allowCashWrite) { onNotify('Caja está cerrada o falta conectar Apps Script'); return }
    const next = freshDraft(type)
    if (reservationId) {
      next.reservationId = reservationId
      next.category = 'Pago de reserva'
    }
    setFormError('')
    setDraft(next)
  }

  const switchDraftType = (type: CashMovementType) => setDraft(current => current ? freshDraft(type) : null)

  const saveMovement = async () => {
    if (!draft || saving || !allowCashWrite) return
    const amount = Number(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(Math.round(amount * 100) - amount * 100) > .00001) {
      setFormError('Ingresa un monto válido de hasta dos decimales.')
      return
    }
    const linksReservation = draft.type === 'Entrada' && ['Pago de reserva', 'Anticipo de reserva'].includes(draft.category)
    const reservation = reservations.find(item => item.subReservationId === draft.reservationId)
    if (linksReservation && (!reservation || reservation.paymentKnown === false)) {
      setFormError('Selecciona una reserva conciliada con monto pagado conocido.')
      return
    }
    if (reservation && amount > balance(reservation)) {
      setFormError(`El pago supera el saldo de ${money(balance(reservation))}.`)
      return
    }
    if (!draft.description.trim()) {
      setFormError('Indica un concepto para el movimiento.')
      return
    }
    const allowedIndependent = draft.type === 'Entrada'
      ? ['Venta de restaurante', 'Otro ingreso']
      : ['Mantenimiento','Lavandería','Servicios','Gastos externos','Retiro de efectivo','Otro gasto']
    if (!linksReservation && !allowedIndependent.includes(draft.category)) {
      setFormError('Este movimiento requiere conectar Inventario, Tours o el flujo especializado correspondiente.')
      return
    }
    const key = JSON.stringify({draft,selectedDate,amount})
    const id = retry.current?.key === key ? retry.current.id : 'HMS-CASH-' + crypto.randomUUID()
    retry.current = {key,id}
    setSaving(true)
    try {
      const ok = linksReservation && reservation
        ? await onPayReservation(reservation.subReservationId,amount,draft.paymentMethod,id,
            draft.category as 'Pago de reserva' | 'Anticipo de reserva')
        : await onCreateCash({
            type:draft.type,date:selectedDate,amount,paymentMethod:draft.paymentMethod,
            category:draft.category,description:draft.description.trim(),
          },id)
      if (ok) {
        retry.current = null
        setDraft(null)
        onNotify(`${draft.type} registrada en Google Sheets · ${money(amount)}`)
      } else setFormError('No se confirmó el registro del movimiento.')
    } catch (error) {
      console.warn('Movimiento de caja no confirmado',error)
      setFormError('No se confirmó el movimiento. Verifica si se registró antes de intentar otra operación.')
    } finally { setSaving(false) }
  }

  const saveOpening = async () => {
    if (saving || !allowCashWrite) return
    if (openingDraft.trim() === '' || !Number.isFinite(Number(openingDraft)) || Number(openingDraft) < 0) {
      onNotify('Ingresa un fondo inicial válido, incluido cero si corresponde.')
      return
    }
    setSaving(true)
    try {
      await onSaveCashDay(selectedDate,{openingCash:Number(openingDraft)})
      setOpeningDraft('')
      onNotify('Fondo inicial guardado')
    } catch (error) {
      console.warn(error);onNotify('No se guardó el fondo inicial')
    } finally { setSaving(false) }
  }

  const saveCount = async () => {
    if (saving || !allowCashWrite || !recordedDay) return
    if (counted.trim()==='' || !Number.isFinite(Number(counted)) || Number(counted)<0) {
      onNotify('Ingresa un conteo de efectivo válido.')
      return
    }
    setSaving(true)
    try {
      await onSaveCashDay(selectedDate,{countedCash:Number(counted)})
      setCounted('')
      onNotify('Conteo de efectivo guardado')
    } catch (error) {
      console.warn(error);onNotify('No se guardó el conteo')
    } finally { setSaving(false) }
  }

  const closeDay = async () => {
    if (!recordedDay || recordedDay.countedCash===undefined || saving || isClosed) return
    if (difference != null && Math.abs(difference) > .009 && (!acceptDifference || !closeNote.trim())) {
      onNotify('Explica y acepta expresamente la diferencia antes de cerrar.')
      return
    }
    setSaving(true)
    try {
      await onCloseCashDay(selectedDate,closeNote,acceptDifference)
      setCloseNote('')
      setAcceptDifference(false)
      onNotify('Cierre de Caja registrado en Google Sheets')
    } catch (error) {
      console.warn(error);onNotify('No se pudo cerrar el día de Caja')
    } finally {setSaving(false)}
  }

  const annul = async (movement: CashMovement) => {
    if (saving || !canAnnul || !allowCashWrite) return
    const independent = !movement.reservationId && !movement.tourId && !movement.purchaseId &&
      !['Pago de reserva','Anticipo de reserva','Compra de inventario','Cobro de tour',
        'Pago a proveedor de tour','Comisión de tour a recepción'].includes(movement.category)
    if (!independent) {
      onNotify('La anulación requiere conciliarse desde el módulo de origen.')
      return
    }
    setSaving(true)
    try {
      await onAnnulCash(movement.id,'Anulación administrativa desde Caja')
      setSelectedMovement(null)
      onNotify('Movimiento anulado; el historial permanece')
    } catch (error) {
      console.warn(error);onNotify('No se confirmó la anulación')
    } finally {setSaving(false)}
  }

  const difference = day.countedCash === undefined || expectedCash === null ? undefined : day.countedCash - expectedCash

  return <section className="page cash-page">
    <section className="page-heading cash-heading">
      <div><p className="eyebrow">CONTROL FINANCIERO OPERATIVO</p><h1>Caja</h1><p>Todo movimiento real de dinero, con responsable y trazabilidad.</p></div>
      <div className="cash-heading-actions">
        <label><span>FECHA DE OPERACIÓN</span><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}/></label>
        <button className="cash-add expense" disabled={!allowCashWrite} onClick={() => openForm('Salida')}><Receipt size={15}/> Registrar gasto</button>
        <button className="cash-add income" disabled={!allowCashWrite} onClick={() => openForm('Entrada')}><Plus size={15}/> Registrar entrada</button>
      </div>
    </section>

    <section className="cash-summary">
      <article><span><CircleDollarSign size={14}/> Entradas</span><strong className="positive">{hasCashData ? money(entries) : '—'}</strong><small>{hasCashData ? `${activeMovements.filter(item => item.type === 'Entrada').length} movimientos` : 'Sin datos'}</small></article>
      <article><span><Receipt size={14}/> Salidas</span><strong className="negative">{hasCashData ? money(exits) : '—'}</strong><small>{hasCashData ? `${activeMovements.filter(item => item.type === 'Salida').length} movimientos` : 'Sin datos'}</small></article>
      <article><span><Landmark size={14}/> Flujo neto</span><strong className={hasCashData ? entries - exits >= 0 ? 'positive' : 'negative' : ''}>{hasCashData ? money(entries - exits) : '—'}</strong><small>{hasCashData ? 'Entradas menos salidas' : 'Sin datos'}</small></article>
      <article><span><Banknote size={14}/> Efectivo esperado</span><strong>{expectedCash !== null ? money(expectedCash) : '—'}</strong><small>{recordedDay ? `Incluye fondo inicial de ${money(day.openingCash)}` : 'Fondo inicial sin registrar'}</small></article>
      <article><span><FileText size={14}/> Pendiente en reservas</span><strong>{knownReservations.length ? money(outstanding) : '—'}</strong><small>{`${pendingReservations.length} con saldo conocido · ${unknownBalances} sin conciliar`}</small></article>
    </section>

    <section className="cash-method-strip">
      {methodTotals.map(({ method, entries: methodEntries, exits: methodExits }) => <article key={method}>
        <span>{method === 'Efectivo' ? <Banknote size={14}/> : method === 'Tarjeta' ? <CreditCard size={14}/> : <Landmark size={14}/>} {method}</span>
        <div><b>{hasCashData ? money(methodEntries) : '—'}</b><small>entradas</small></div><div><b>{hasCashData ? money(methodExits) : '—'}</b><small>salidas</small></div>
      </article>)}
      <p><AlertTriangle size={14}/><span>Los pagos de tours aparecen aquí cuando están registrados en MOVIMIENTOS_CAJA; las operaciones de Tours pendientes siguen sin escritura.</span></p>
    </section>

    <section className="cash-layout">
      <section className="panel cash-ledger">
        <header><div><span>MOVIMIENTOS DEL DÍA</span><h2>{longDate(selectedDate)}</h2></div><b>{filtered.length} registros</b></header>
        <div className="cash-toolbar">
          <label className="cash-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar concepto, ID o reserva"/></label>
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as typeof typeFilter)}><option>Todos</option><option>Entrada</option><option>Salida</option></select>
          <select value={methodFilter} onChange={event => setMethodFilter(event.target.value as typeof methodFilter)}><option>Todos</option>{methods.map(item => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="table-scroll"><table className="cash-table"><thead><tr><th>Hora / ID</th><th>Concepto / categoría</th><th>Método</th><th>Entrada</th><th>Salida</th><th>Responsable</th><th></th></tr></thead><tbody>
          {filtered.map(item => <tr key={item.id} className={item.status === 'Anulado' ? 'annulled' : ''} onClick={() => setSelectedMovement(item)}>
            <td><b>{item.time}</b><small>{item.id}</small></td><td><b>{item.description}</b><small>{item.category}{item.tourId ? ` · ${item.tourId}` : item.reservationId ? ` · ${item.reservationId}` : ''}</small></td><td><span className={`cash-method ${item.paymentMethod.toLowerCase()}`}>{item.paymentMethod}</span></td><td className="money-cell positive">{item.type === 'Entrada' ? money(item.amount) : '—'}</td><td className="money-cell negative">{item.type === 'Salida' ? money(item.amount) : '—'}</td><td>{item.createdBy}{item.status === 'Anulado' && <small className="annulled-label">ANULADO</small>}</td><td><button className="row-open" aria-label="Ver movimiento"><ChevronRight size={15}/></button></td>
          </tr>)}
        </tbody></table></div>
        {!filtered.length && <div className="cash-empty"><WalletCards size={24}/><b>Sin movimientos</b><span>No hay registros que coincidan con los filtros.</span></div>}
      </section>

      <aside className="cash-side">
        <section className="panel cash-control"><header><div><span>CONTROL DE EFECTIVO</span><h2>Conteo del día</h2></div></header><div className="cash-control-body">
          <div><span>Fondo inicial</span><b>{recordedDay ? money(day.openingCash) : 'Sin registro'}</b></div><div><span>Movimiento neto</span><b>{hasCashData ? money(cashEntries - cashExits) : '—'}</b></div><div className="expected"><span>Efectivo esperado</span><b>{expectedCash !== null ? money(expectedCash) : '—'}</b></div>
          {day.countedCash !== undefined && <div className="count-result"><span>Efectivo contado</span><b>{money(day.countedCash)}</b><em className={difference === 0 ? 'positive' : 'negative'}>{difference === 0 ? 'Caja cuadrada' : `Diferencia ${money(difference ?? 0)}`}</em></div>}
          <label><span>FONDO INICIAL</span><div><input type="number" min="0" step="0.01" disabled={isClosed || saving || !canWrite} value={openingDraft} onChange={event => setOpeningDraft(event.target.value)} placeholder={recordedDay ? money(day.openingCash) : 'Registrar apertura'}/><button disabled={isClosed || saving || !canWrite} onClick={() => void saveOpening()}>Guardar fondo</button></div></label>
          <label><span>REGISTRAR CONTEO</span><div><input type="number" min="0" step="0.01" disabled={!recordedDay || isClosed || saving || !canWrite} value={counted} onChange={event => setCounted(event.target.value)} placeholder="0.00"/><button disabled={!recordedDay || isClosed || saving || !canWrite} onClick={() => void saveCount()}>Guardar conteo</button></div></label>
          <label><span>CIERRE DEL DÍA</span><div><input value={closeNote} disabled={!recordedDay || isClosed || saving || !canWrite} onChange={event => setCloseNote(event.target.value)} placeholder="Nota de cierre / justificación"/></div></label>
          {difference !== undefined && Math.abs(difference) > .009 && <label><input type="checkbox" disabled={isClosed || saving} checked={acceptDifference} onChange={event => setAcceptDifference(event.target.checked)}/> Acepto la diferencia de efectivo indicada</label>}
          <button className="primary-action" disabled={!recordedDay || recordedDay.countedCash === undefined || isClosed || saving || !canWrite} onClick={() => void closeDay()}>{isClosed ? 'Día cerrado' : 'Cerrar caja del día'}</button>
        </div></section>

        <section className="panel cash-breakdown"><header><div><span>SALIDAS</span><h2>Gasto por categoría</h2></div></header><div>{expensesByCategory.length ? expensesByCategory.map(([category, amount]) => <p key={category}><span>{category}</span><b>{money(amount)}</b></p>) : <small>Sin gastos registrados este día.</small>}</div></section>

        <section className="panel cash-purchase-requests"><header><div><span>COMPRAS AUTORIZADAS</span><h2>Solicitudes listas</h2></div><b>{readyPurchaseRequests.length}</b></header><div>{readyPurchaseRequests.length ? readyPurchaseRequests.map(request => <button key={request.id} disabled title="Compras se conectan en Inventario" onClick={() => openPurchaseRequest(request)}><span><b>{request.id}</b><small>{request.items.length} productos · solicitó {request.createdBy}</small></span><strong>{money(request.estimatedTotal)}</strong><ChevronRight size={14}/></button>) : <small>No hay solicitudes tomadas en cuenta.</small>}</div></section>

        <section className="panel pending-payments"><header><div><span>COBRANZA</span><h2>Mayores saldos pendientes</h2></div></header><div>{pendingReservations.slice(0, 4).map(reservation => <button key={reservation.id} onClick={() => openForm('Entrada', reservation.subReservationId)}><span><b>{reservation.guestName}</b><small>{reservation.roomNumber ?? reservation.roomType} · {reservation.id}</small></span><strong>{money(balance(reservation))}</strong><Plus size={14}/></button>)}</div></section>
      </aside>
    </section>

    {draft && <MovementDialog draft={draft} reservations={pendingReservations} inventory={inventory} error={formError} saving={saving} canWrite={allowCashWrite} onChange={setDraft} onSwitchType={switchDraftType} onClose={() => {setDraft(null);retry.current=null}} onSave={() => void saveMovement()}/>}
    {selectedMovement && <MovementDetail movement={selectedMovement} canAnnul={canAnnul && allowCashWrite && !saving} onClose={() => setSelectedMovement(null)} onAnnul={() => void annul(selectedMovement)}/>}
  </section>
}

function MovementDialog({ draft, reservations, inventory, error, saving, canWrite, onChange, onSwitchType, onClose, onSave }: {
  draft: Draft
  reservations: Reservation[]
  inventory: InventoryItem[]
  error: string
  saving: boolean
  canWrite: boolean
  onChange: (draft: Draft) => void
  onSwitchType: (type: CashMovementType) => void
  onClose: () => void
  onSave: () => void
}) {
  const categories = draft.type === 'Entrada' ? incomeCategories : expenseCategories
  const linkedReservation = reservations.find(item => item.subReservationId === draft.reservationId)
  const needsReservation = draft.type === 'Entrada' && ['Pago de reserva', 'Anticipo de reserva'].includes(draft.category)
  const isInventory = draft.type === 'Salida' && draft.category === 'Compra de inventario'
  const invoiceTotal = draft.purchaseItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
  const inventoryUnits = { ...fallbackInventoryUnits, ...Object.fromEntries(inventory.map(item => [item.name, item.unit])) }
  const inventoryProducts = Object.keys(inventoryUnits)
  const changeCategory = (category: CashMovementCategory) => onChange({
    ...draft,
    category,
    reservationId: '',
    purchaseRequestId: category === 'Compra de inventario' ? draft.purchaseRequestId : '',
    purchaseItems: category === 'Compra de inventario'
      ? draft.purchaseItems.length ? draft.purchaseItems : [newPurchaseItem()]
      : [],
  })
  const updatePurchaseItem = (id: string, changes: Partial<Draft['purchaseItems'][number]>) => onChange({
    ...draft,
    purchaseItems: draft.purchaseItems.map(item => item.id === id ? { ...item, ...changes } : item),
  })
  const removePurchaseItem = (id: string) => onChange({
    ...draft,
    purchaseItems: draft.purchaseItems.filter(item => item.id !== id),
  })
  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="cash-dialog">
    <header><div><span>NUEVO MOVIMIENTO</span><h2>{draft.type === 'Entrada' ? 'Registrar entrada de dinero' : 'Registrar gasto'}</h2><p>El movimiento quedará ligado al usuario y no podrá eliminarse.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={17}/></button></header>
    <div className="cash-type-switch"><button className={draft.type === 'Entrada' ? 'active income' : ''} onClick={() => onSwitchType('Entrada')}>Entrada</button><button className={draft.type === 'Salida' ? 'active expense' : ''} onClick={() => onSwitchType('Salida')}>Salida</button></div>
    <div className="cash-form">
      {draft.purchaseRequestId && <div className="linked-purchase-request full"><FileText size={16}/><p><b>Compra ligada a {draft.purchaseRequestId}</b><span>Esta factura es editable: ajusta, elimina o añade productos según lo comprado realmente. La solicitud original no cambiará.</span></p></div>}
      <label className="full"><span>Categoría</span><select value={draft.category} onChange={event => changeCategory(event.target.value as CashMovementCategory)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      {needsReservation && <label className="full"><span>Reserva pendiente de pago</span><select value={draft.reservationId} onChange={event => onChange({ ...draft, reservationId: event.target.value })}><option value="">Seleccionar reserva…</option>{reservations.map(item => <option key={item.subReservationId} value={item.subReservationId}>{item.guestName} · {item.roomNumber ?? item.roomType} · saldo {money(balance(item))}</option>)}</select></label>}
      {linkedReservation && <div className="reservation-payment-preview full"><span><small>Huésped</small><b>{linkedReservation.guestName}</b></span><span><small>Total</small><b>{money(linkedReservation.total)}</b></span><span><small>Pagado</small><b>{money(linkedReservation.paid)}</b></span><span><small>Saldo máximo</small><b>{money(balance(linkedReservation))}</b></span></div>}
      {isInventory ? <section className="invoice-items full">
        <header><div><span>PRODUCTO</span><span>CANTIDAD</span><span>UNIDAD</span><span>TOTAL</span><span></span></div></header>
        {draft.purchaseItems.map((item, index) => <div className="invoice-item" key={item.id}>
          <select aria-label={`Producto ${index + 1}`} value={item.product} onChange={event => updatePurchaseItem(item.id, { product: event.target.value, unit: inventoryUnits[event.target.value] ?? '' })}><option value="">Seleccionar producto…</option>{inventoryProducts.map(product => <option key={product}>{product}</option>)}</select>
          <input aria-label={`Cantidad ${index + 1}`} type="number" min="0" step="any" value={item.quantity} onChange={event => updatePurchaseItem(item.id, { quantity: event.target.value })} placeholder="0"/>
          <input className="invoice-unit" aria-label={`Unidad ${index + 1}`} value={item.unit} readOnly placeholder="Automática"/>
          <div className="invoice-line-total"><i>$</i><input aria-label={`Total ${index + 1}`} type="number" min="0" step="any" value={item.total} onChange={event => updatePurchaseItem(item.id, { total: event.target.value })} placeholder="0.00"/></div>
          <button type="button" disabled={draft.purchaseItems.length === 1} onClick={() => removePurchaseItem(item.id)} aria-label={`Quitar producto ${index + 1}`}><Trash2 size={14}/></button>
        </div>)}
        <footer><button type="button" onClick={() => onChange({ ...draft, purchaseItems: [...draft.purchaseItems, newPurchaseItem()] })}><Plus size={14}/> Añadir producto</button><div><span>TOTAL DE LA FACTURA</span><strong>{money(invoiceTotal)}</strong></div></footer>
      </section> : <label><span>Monto total</span><div className="amount-input"><i>$</i><input type="number" min="0" max={linkedReservation ? balance(linkedReservation) : undefined} value={draft.amount} onChange={event => onChange({ ...draft, amount: event.target.value })} placeholder="0.00"/></div></label>}
      <label className={isInventory ? 'full invoice-payment-method' : ''}><span>Método de pago {isInventory && 'de toda la factura'}</span><select value={draft.paymentMethod} onChange={event => onChange({ ...draft, paymentMethod: event.target.value as CashPaymentMethod })}>{methods.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="full"><span>Concepto / motivo</span><textarea value={draft.description} onChange={event => onChange({ ...draft, description: event.target.value })} placeholder={draft.type === 'Entrada' ? 'Ej. Pago restante de hospedaje' : 'Ej. Compra de insumos para desayunos'}/></label>
      {error && <div className="cash-form-error full"><AlertTriangle size={14}/>{error}</div>}
    </div>
    <footer><button onClick={onClose}>Cancelar</button><button className="primary-action" disabled={saving || !canWrite} onClick={onSave}>{saving ? 'Guardando…' : `Registrar ${draft.type.toLowerCase()}`}</button></footer>
  </section></div>
}

function MovementDetail({ movement, canAnnul, onClose, onAnnul }: { movement: CashMovement; canAnnul: boolean; onClose: () => void; onAnnul: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside className="drawer cash-detail">
    <header><div><span>DETALLE DEL MOVIMIENTO</span><h2>{movement.description}</h2><p>{movement.id}</p></div><button onClick={onClose} aria-label="Cerrar"><X size={18}/></button></header>
    <section className={`movement-amount ${movement.type.toLowerCase()}`}><span>{movement.type}</span><strong>{movement.type === 'Entrada' ? '+' : '−'} {money(movement.amount)}</strong><small className={movement.status === 'Anulado' ? 'annulled-label' : ''}>{movement.status}</small></section>
    <section className="drawer-section cash-detail-grid"><div><small>Fecha</small><b>{longDate(movement.date)} · {movement.time}</b></div><div><small>Método</small><b>{movement.paymentMethod}</b></div><div><small>Categoría</small><b>{movement.category}</b></div><div><small>Registrado por</small><b>{movement.createdBy}</b></div>{movement.reservationId && <div><small>Reserva</small><b>{movement.reservationId}</b></div>}{movement.tourId && <div><small>Tour</small><b>{movement.tourId}</b></div>}{movement.purchaseRequestId && <div><small>Solicitud original</small><b>{movement.purchaseRequestId}</b></div>}{movement.purchaseId && <div><small>ID de compra</small><b>{movement.purchaseId}</b></div>}</section>
    {Boolean(movement.purchaseItems?.length) && <section className="drawer-section purchase-detail"><span className="drawer-label">PRODUCTOS DE LA COMPRA</span><div className="purchase-detail-head"><span>Producto</span><span>Cantidad</span><span>Unidad</span><span>Total</span></div>{movement.purchaseItems?.map((item, index) => <div className="purchase-detail-row" key={`${item.product}-${index}`}><b>{item.product}</b><span>{item.quantity}</span><span>{item.unit}</span><strong>{money(item.total)}</strong></div>)}</section>}
    {movement.tourId && movement.status === 'Registrado' && <section className="annulment-note"><AlertTriangle size={15}/><p>Este movimiento se originó en Tours. Las correcciones se harán desde ese flujo para mantener Caja y el tour sincronizados.</p></section>}
    {movement.status === 'Anulado' && <section className="annulment-note"><AlertTriangle size={15}/><p>Anulado por {movement.annulledBy}. El registro se conserva para auditoría.</p></section>}
    <footer><button onClick={onClose}>Cerrar</button>{canAnnul && movement.status === 'Registrado' && !movement.tourId && <button className="danger-action" onClick={onAnnul}>Anular movimiento</button>}</footer>
  </aside></div>
}
