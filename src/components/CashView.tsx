import { useMemo, useState } from 'react'
import {
  AlertTriangle, Banknote, CalendarDays, ChevronRight, CircleDollarSign,
  CreditCard, FileText, Landmark, Plus, Receipt, Search, Trash2, WalletCards, X,
} from 'lucide-react'
import type {
  CashArea, CashDay, CashMovement, CashMovementCategory, CashMovementType,
  CashPaymentMethod, Reservation, Role,
} from '../types'
import { longDate, money } from '../utils'

interface CashViewProps {
  role: Role
  reservations: Reservation[]
  movements: CashMovement[]
  days: CashDay[]
  onReservationsChange: (updater: (rows: Reservation[]) => Reservation[]) => void
  onMovementsChange: (updater: (rows: CashMovement[]) => CashMovement[]) => void
  onDaysChange: (updater: (rows: CashDay[]) => CashDay[]) => void
  onNotify: (message: string) => void
}

type Draft = {
  type: CashMovementType
  amount: string
  paymentMethod: CashPaymentMethod
  category: CashMovementCategory
  description: string
  reservationId: string
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
const inventoryUnits: Record<string, string> = {
  Huevo: 'Piezas',
  Fruta: 'Kilogramos',
  Café: 'Kilogramos',
  'Agua embotellada': 'Piezas',
  'Papel higiénico': 'Paquetes',
  Toallas: 'Piezas',
  'Productos de limpieza': 'Litros',
  'Otro producto': 'Unidades',
}
const inventoryProducts = Object.keys(inventoryUnits)
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
}

const freshDraft = (type: CashMovementType): Draft => ({
  type,
  amount: '',
  paymentMethod: 'Efectivo',
  category: type === 'Entrada' ? 'Pago de reserva' : 'Compra de inventario',
  description: '',
  reservationId: '',
  purchaseItems: type === 'Salida' ? [newPurchaseItem()] : [],
})

const activeReservation = (reservation: Reservation) => !['Cancelada', 'No show'].includes(reservation.status)
const balance = (reservation: Reservation) => Math.max(0, reservation.total - reservation.paid)

export function CashView({
  role, reservations, movements, days,
  onReservationsChange, onMovementsChange, onDaysChange, onNotify,
}: CashViewProps) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selectedMovement, setSelectedMovement] = useState<CashMovement | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'Todos' | CashMovementType>('Todos')
  const [methodFilter, setMethodFilter] = useState<'Todos' | CashPaymentMethod>('Todos')
  const [counted, setCounted] = useState('')
  const [formError, setFormError] = useState('')

  const canAccess = ['Dueño', 'Gerencia', 'Administración', 'Recepción'].includes(role)
  const canAnnul = ['Dueño', 'Gerencia', 'Administración'].includes(role)
  const day = days.find(item => item.date === selectedDate) ?? { date: selectedDate, openingCash: 0 }
  const dayMovements = movements.filter(item => item.date === selectedDate)
  const activeMovements = dayMovements.filter(item => item.status === 'Registrado')
  const entries = activeMovements.filter(item => item.type === 'Entrada').reduce((sum, item) => sum + item.amount, 0)
  const exits = activeMovements.filter(item => item.type === 'Salida').reduce((sum, item) => sum + item.amount, 0)
  const cashEntries = activeMovements.filter(item => item.type === 'Entrada' && item.paymentMethod === 'Efectivo').reduce((sum, item) => sum + item.amount, 0)
  const cashExits = activeMovements.filter(item => item.type === 'Salida' && item.paymentMethod === 'Efectivo').reduce((sum, item) => sum + item.amount, 0)
  const expectedCash = day.openingCash + cashEntries - cashExits
  const outstanding = reservations.filter(activeReservation).reduce((sum, item) => sum + balance(item), 0)
  const pendingReservations = reservations.filter(item => activeReservation(item) && balance(item) > 0).sort((a, b) => balance(b) - balance(a))

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
    const matchesSearch = !query || [item.id, item.description, item.area, item.category, item.reservationId, item.tourId, item.purchaseId]
      .some(value => value?.toLowerCase().includes(query))
    return matchesSearch && (typeFilter === 'Todos' || item.type === typeFilter) && (methodFilter === 'Todos' || item.paymentMethod === methodFilter)
  }).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))

  if (!canAccess) return <section className="page"><div className="page-heading"><div><p className="eyebrow">CONTROL FINANCIERO</p><h1>Caja</h1><p>Registro operativo de entradas y salidas.</p></div></div><div className="access-note">Tu rol no tiene acceso al movimiento de dinero. Dueño, Gerencia, Administración y Recepción pueden usar este módulo.</div></section>

  const openForm = (type: CashMovementType, reservationId = '') => {
    const next = freshDraft(type)
    if (reservationId) {
      next.reservationId = reservationId
      next.category = 'Pago de reserva'
    }
    setFormError('')
    setDraft(next)
  }

  const switchDraftType = (type: CashMovementType) => setDraft(current => current ? freshDraft(type) : null)

  const saveMovement = () => {
    if (!draft) return
    const isInventoryPurchase = draft.type === 'Salida' && draft.category === 'Compra de inventario'
    const amount = isInventoryPurchase
      ? draft.purchaseItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
      : Number(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0) { setFormError('Ingresa un monto válido mayor a cero.'); return }
    const linksReservation = draft.type === 'Entrada' && ['Pago de reserva', 'Anticipo de reserva'].includes(draft.category)
    const reservation = reservations.find(item => item.id === draft.reservationId)
    if (linksReservation && !reservation) { setFormError('Selecciona la reserva que está pagando.'); return }
    if (reservation && amount > balance(reservation)) { setFormError(`El pago no puede exceder el saldo de ${money(balance(reservation))}.`); return }
    if (isInventoryPurchase && draft.purchaseItems.some(item => !item.product || !item.unit || Number(item.quantity) <= 0 || Number(item.total) <= 0)) {
      setFormError('Completa producto, cantidad y total en cada renglón de la compra.'); return
    }
    if (!draft.description.trim()) { setFormError('Agrega un concepto breve para identificar el movimiento.'); return }

    const sameDayCount = movements.filter(item => item.date === selectedDate).length + 1
    const stamp = selectedDate.replaceAll('-', '')
    const movement: CashMovement = {
      id: `MOV-${stamp}-${String(sameDayCount).padStart(3, '0')}`,
      date: selectedDate,
      time: currentTime(),
      type: draft.type,
      amount,
      paymentMethod: draft.paymentMethod,
      area: areaForCategory[draft.category],
      category: draft.category,
      description: draft.description.trim(),
      status: 'Registrado',
      createdBy: role,
      reservationId: linksReservation ? draft.reservationId : undefined,
      purchaseId: draft.type === 'Salida' ? `COMP-${stamp}-${String(movements.filter(item => item.date === selectedDate && item.type === 'Salida').length + 1).padStart(3, '0')}` : undefined,
      purchaseItems: isInventoryPurchase ? draft.purchaseItems.map(item => ({ product: item.product, quantity: Number(item.quantity), unit: item.unit, total: Number(item.total) })) : undefined,
    }
    onMovementsChange(rows => [movement, ...rows])
    if (reservation) onReservationsChange(rows => rows.map(item => item.id === reservation.id ? { ...item, paid: Math.min(item.total, item.paid + amount) } : item))
    setDraft(null)
    onNotify(`${draft.type} registrada · ${money(amount)}`)
  }

  const saveCount = () => {
    const value = Number(counted)
    if (!Number.isFinite(value) || value < 0) { onNotify('Ingresa un conteo de efectivo válido'); return }
    onDaysChange(rows => rows.some(item => item.date === selectedDate)
      ? rows.map(item => item.date === selectedDate ? { ...item, countedCash: value } : item)
      : [...rows, { date: selectedDate, openingCash: 0, countedCash: value }])
    setCounted('')
    onNotify('Conteo de efectivo registrado')
  }

  const annul = (movement: CashMovement) => {
    onMovementsChange(rows => rows.map(item => item.id === movement.id ? { ...item, status: 'Anulado', annulledBy: role, annulledAt: `${selectedDate} ${currentTime()}` } : item))
    if (movement.reservationId && movement.type === 'Entrada') {
      onReservationsChange(rows => rows.map(item => item.id === movement.reservationId ? { ...item, paid: Math.max(0, item.paid - movement.amount) } : item))
    }
    setSelectedMovement(null)
    onNotify('Movimiento anulado; el historial se conservó')
  }

  const difference = day.countedCash === undefined ? undefined : day.countedCash - expectedCash

  return <section className="page cash-page">
    <section className="page-heading cash-heading">
      <div><p className="eyebrow">CONTROL FINANCIERO OPERATIVO</p><h1>Caja</h1><p>Todo movimiento real de dinero, con responsable y trazabilidad.</p></div>
      <div className="cash-heading-actions">
        <label><span>FECHA DE OPERACIÓN</span><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}/></label>
        <button className="cash-add expense" onClick={() => openForm('Salida')}><Receipt size={15}/> Registrar gasto</button>
        <button className="cash-add income" onClick={() => openForm('Entrada')}><Plus size={15}/> Registrar entrada</button>
      </div>
    </section>

    <section className="cash-summary">
      <article><span><CircleDollarSign size={14}/> Entradas</span><strong className="positive">{money(entries)}</strong><small>{activeMovements.filter(item => item.type === 'Entrada').length} movimientos</small></article>
      <article><span><Receipt size={14}/> Salidas</span><strong className="negative">{money(exits)}</strong><small>{activeMovements.filter(item => item.type === 'Salida').length} movimientos</small></article>
      <article><span><Landmark size={14}/> Flujo neto</span><strong className={entries - exits >= 0 ? 'positive' : 'negative'}>{money(entries - exits)}</strong><small>Entradas menos salidas</small></article>
      <article><span><Banknote size={14}/> Efectivo esperado</span><strong>{money(expectedCash)}</strong><small>Incluye fondo inicial de {money(day.openingCash)}</small></article>
      <article><span><FileText size={14}/> Pendiente en reservas</span><strong>{money(outstanding)}</strong><small>{pendingReservations.length} reservas con saldo</small></article>
    </section>

    <section className="cash-method-strip">
      {methodTotals.map(({ method, entries: methodEntries, exits: methodExits }) => <article key={method}>
        <span>{method === 'Efectivo' ? <Banknote size={14}/> : method === 'Tarjeta' ? <CreditCard size={14}/> : <Landmark size={14}/>} {method}</span>
        <div><b>{money(methodEntries)}</b><small>entradas</small></div><div><b>{money(methodExits)}</b><small>salidas</small></div>
      </article>)}
      <p><AlertTriangle size={14}/><span>Los tours se controlan en su módulo independiente y no se mezclan con Caja hasta registrar su pago real.</span></p>
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
          <div><span>Fondo inicial</span><b>{money(day.openingCash)}</b></div><div><span>Movimiento neto</span><b>{money(cashEntries - cashExits)}</b></div><div className="expected"><span>Efectivo esperado</span><b>{money(expectedCash)}</b></div>
          {day.countedCash !== undefined && <div className="count-result"><span>Efectivo contado</span><b>{money(day.countedCash)}</b><em className={difference === 0 ? 'positive' : 'negative'}>{difference === 0 ? 'Caja cuadrada' : `Diferencia ${money(difference ?? 0)}`}</em></div>}
          <label><span>REGISTRAR CONTEO</span><div><input type="number" min="0" value={counted} onChange={event => setCounted(event.target.value)} placeholder="0.00"/><button onClick={saveCount}>Guardar</button></div></label>
        </div></section>

        <section className="panel cash-breakdown"><header><div><span>SALIDAS</span><h2>Gasto por categoría</h2></div></header><div>{expensesByCategory.length ? expensesByCategory.map(([category, amount]) => <p key={category}><span>{category}</span><b>{money(amount)}</b></p>) : <small>Sin gastos registrados este día.</small>}</div></section>

        <section className="panel pending-payments"><header><div><span>COBRANZA</span><h2>Mayores saldos pendientes</h2></div></header><div>{pendingReservations.slice(0, 4).map(reservation => <button key={reservation.id} onClick={() => openForm('Entrada', reservation.id)}><span><b>{reservation.guestName}</b><small>{reservation.roomNumber ?? reservation.roomType} · {reservation.id}</small></span><strong>{money(balance(reservation))}</strong><Plus size={14}/></button>)}</div></section>
      </aside>
    </section>

    {draft && <MovementDialog draft={draft} reservations={pendingReservations} error={formError} onChange={setDraft} onSwitchType={switchDraftType} onClose={() => setDraft(null)} onSave={saveMovement}/>} 
    {selectedMovement && <MovementDetail movement={selectedMovement} canAnnul={canAnnul} onClose={() => setSelectedMovement(null)} onAnnul={() => annul(selectedMovement)}/>} 
  </section>
}

function MovementDialog({ draft, reservations, error, onChange, onSwitchType, onClose, onSave }: {
  draft: Draft
  reservations: Reservation[]
  error: string
  onChange: (draft: Draft) => void
  onSwitchType: (type: CashMovementType) => void
  onClose: () => void
  onSave: () => void
}) {
  const categories = draft.type === 'Entrada' ? incomeCategories : expenseCategories
  const linkedReservation = reservations.find(item => item.id === draft.reservationId)
  const needsReservation = draft.type === 'Entrada' && ['Pago de reserva', 'Anticipo de reserva'].includes(draft.category)
  const isInventory = draft.type === 'Salida' && draft.category === 'Compra de inventario'
  const invoiceTotal = draft.purchaseItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
  const changeCategory = (category: CashMovementCategory) => onChange({
    ...draft,
    category,
    reservationId: '',
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
    <header><div><span>NUEVO MOVIMIENTO</span><h2>{draft.type === 'Entrada' ? 'Registrar entrada de dinero' : 'Registrar gasto'}</h2><p>El movimiento quedará ligado al usuario y no podrá eliminarse.</p></div><button onClick={onClose}><X size={17}/></button></header>
    <div className="cash-type-switch"><button className={draft.type === 'Entrada' ? 'active income' : ''} onClick={() => onSwitchType('Entrada')}>Entrada</button><button className={draft.type === 'Salida' ? 'active expense' : ''} onClick={() => onSwitchType('Salida')}>Salida</button></div>
    <div className="cash-form">
      <label className="full"><span>Categoría</span><select value={draft.category} onChange={event => changeCategory(event.target.value as CashMovementCategory)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      {needsReservation && <label className="full"><span>Reserva pendiente de pago</span><select value={draft.reservationId} onChange={event => onChange({ ...draft, reservationId: event.target.value })}><option value="">Seleccionar reserva…</option>{reservations.map(item => <option key={item.id} value={item.id}>{item.guestName} · {item.roomNumber ?? item.roomType} · saldo {money(balance(item))}</option>)}</select></label>}
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
    <footer><button onClick={onClose}>Cancelar</button><button className="primary-action" onClick={onSave}>Registrar {draft.type.toLowerCase()}</button></footer>
  </section></div>
}

function MovementDetail({ movement, canAnnul, onClose, onAnnul }: { movement: CashMovement; canAnnul: boolean; onClose: () => void; onAnnul: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside className="drawer cash-detail">
    <header><div><span>DETALLE DEL MOVIMIENTO</span><h2>{movement.description}</h2><p>{movement.id}</p></div><button onClick={onClose}><X size={18}/></button></header>
    <section className={`movement-amount ${movement.type.toLowerCase()}`}><span>{movement.type}</span><strong>{movement.type === 'Entrada' ? '+' : '−'} {money(movement.amount)}</strong><small className={movement.status === 'Anulado' ? 'annulled-label' : ''}>{movement.status}</small></section>
    <section className="drawer-section cash-detail-grid"><div><small>Fecha</small><b>{longDate(movement.date)} · {movement.time}</b></div><div><small>Método</small><b>{movement.paymentMethod}</b></div><div><small>Categoría</small><b>{movement.category}</b></div><div><small>Registrado por</small><b>{movement.createdBy}</b></div>{movement.reservationId && <div><small>Reserva</small><b>{movement.reservationId}</b></div>}{movement.tourId && <div><small>Tour</small><b>{movement.tourId}</b></div>}{movement.purchaseId && <div><small>ID de compra</small><b>{movement.purchaseId}</b></div>}</section>
    {Boolean(movement.purchaseItems?.length) && <section className="drawer-section purchase-detail"><span className="drawer-label">PRODUCTOS DE LA COMPRA</span><div className="purchase-detail-head"><span>Producto</span><span>Cantidad</span><span>Unidad</span><span>Total</span></div>{movement.purchaseItems?.map((item, index) => <div className="purchase-detail-row" key={`${item.product}-${index}`}><b>{item.product}</b><span>{item.quantity}</span><span>{item.unit}</span><strong>{money(item.total)}</strong></div>)}</section>}
    {movement.tourId && movement.status === 'Registrado' && <section className="annulment-note"><AlertTriangle size={15}/><p>Este movimiento se originó en Tours. Las correcciones se harán desde ese flujo para mantener Caja y el tour sincronizados.</p></section>}
    {movement.status === 'Anulado' && <section className="annulment-note"><AlertTriangle size={15}/><p>Anulado por {movement.annulledBy}. El registro se conserva para auditoría.</p></section>}
    <footer><button onClick={onClose}>Cerrar</button>{canAnnul && movement.status === 'Registrado' && !movement.tourId && <button className="danger-action" onClick={onAnnul}>Anular movimiento</button>}</footer>
  </aside></div>
}
