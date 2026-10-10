import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ClipboardCheck, ClipboardList,
  Minus, PackageCheck, PackageOpen, Plus, Search, ShoppingCart, SlidersHorizontal,
} from 'lucide-react'
import type { InventoryCategory, InventoryItem, PurchaseRequest, Role } from '../types'
import { money } from '../utils'

type InventoryTab = 'Existencias' | 'Conteo' | 'Compra recomendada' | 'Solicitudes'
type StockState = 'Agotado' | 'Bajo' | 'Correcto'

type Props = {
  role: Role
  items: InventoryItem[]
  requests: PurchaseRequest[]
  onChange: (updater: (rows: InventoryItem[]) => InventoryItem[]) => void
  onRequestsChange: (updater: (rows: PurchaseRequest[]) => PurchaseRequest[]) => void
  onOpenCash: (requestId: string) => void
  onNotify: (message: string) => void
}

const categories: Array<'Todas' | InventoryCategory> = ['Todas', 'Alimentos', 'Bebidas', 'Limpieza', 'Lavandería', 'Amenidades', 'Suministros']

const stockState = (item: InventoryItem): StockState => item.stock <= 0 ? 'Agotado' : item.stock < item.parLevel ? 'Bajo' : 'Correcto'
const formatQuantity = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value)

const requestTime = () => new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Cancun', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date())

export function InventoryView({ role, items, requests, onChange, onRequestsChange, onOpenCash, onNotify }: Props) {
  const [tab, setTab] = useState<InventoryTab>('Existencias')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'Todas' | InventoryCategory>('Todas')
  const [stateFilter, setStateFilter] = useState<'Todos' | StockState>('Todos')
  const [countCategory, setCountCategory] = useState<InventoryCategory>('Alimentos')
  const [countDraft, setCountDraft] = useState<Record<string, string>>(() => Object.fromEntries(items.map(item => [item.id, String(item.stock)])))
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter(item => item.suggestedPurchase > 0).map(item => item.id)))
  const [orderDraft, setOrderDraft] = useState<Record<string, string>>(() => Object.fromEntries(items.map(item => [item.id, String(item.suggestedPurchase)])))

  useEffect(() => {
    setCountDraft(Object.fromEntries(items.map(item => [item.id, String(item.stock)])))
    setOrderDraft(Object.fromEntries(items.map(item => [item.id, String(item.suggestedPurchase)])))
  }, [items])

  const counts = useMemo(() => ({
    depleted: items.filter(item => stockState(item) === 'Agotado').length,
    low: items.filter(item => stockState(item) === 'Bajo').length,
    order: items.filter(item => item.suggestedPurchase > 0).length,
    value: items.reduce((sum, item) => sum + item.stock * item.lastPrice, 0),
  }), [items])

  const visibleItems = useMemo(() => items.filter(item => {
    const matchesSearch = !search.trim() || `${item.name} ${item.category} ${item.unit}`.toLowerCase().includes(search.trim().toLowerCase())
    const matchesCategory = category === 'Todas' || item.category === category
    const matchesState = stateFilter === 'Todos' || stockState(item) === stateFilter
    return matchesSearch && matchesCategory && matchesState
  }), [category, items, search, stateFilter])

  const recommended = items.filter(item => item.suggestedPurchase > 0)
  const countItems = items.filter(item => item.category === countCategory)
  const selectedItems = recommended.filter(item => selected.has(item.id))
  const estimatedTotal = selectedItems.reduce((sum, item) => sum + (Number(orderDraft[item.id]) || 0) * item.lastPrice, 0)
  const changedCount = items.filter(item => Number(countDraft[item.id]) !== item.stock && countDraft[item.id] !== '').length
  const lastCountLabel = items.some(item => item.lastUpdated === 'Ahora') ? 'Ahora' : 'Hoy · 07:20'

  const updateCount = (id: string, amount: number) => {
    const current = Number(countDraft[id]) || 0
    setCountDraft({ ...countDraft, [id]: String(Math.max(0, Math.round((current + amount) * 100) / 100)) })
  }

  const saveCount = () => {
    if (!changedCount) { onNotify('No hay cantidades modificadas'); return }
    onChange(rows => rows.map(item => {
      const nextStock = Number(countDraft[item.id])
      if (!Number.isFinite(nextStock) || nextStock < 0 || nextStock === item.stock) return item
      return {
        ...item,
        stock: nextStock,
        suggestedPurchase: Math.max(0, Math.ceil(item.parLevel - nextStock)),
        lastUpdated: 'Ahora',
      }
    }))
    onNotify(changedCount === 1 ? 'Conteo guardado · 1 producto actualizado' : `Conteo guardado · ${changedCount} productos actualizados`)
    setTab('Existencias')
  }

  const toggleSelected = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const createRequest = () => {
    if (!selectedItems.length) { onNotify('Selecciona al menos un producto'); return }
    if (selectedItems.some(item => !Number.isFinite(Number(orderDraft[item.id])) || Number(orderDraft[item.id]) <= 0)) {
      onNotify('Todas las cantidades solicitadas deben ser mayores a cero')
      return
    }
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const request: PurchaseRequest = {
      id: `SOL-${date.replaceAll('-', '')}-${String(requests.length + 1).padStart(3, '0')}`,
      createdAt: `Hoy · ${requestTime()}`,
      createdBy: role,
      status: 'Pendiente',
      items: selectedItems.map(item => ({
        product: item.name,
        quantity: Number(orderDraft[item.id]) || 0,
        unit: item.unit,
        estimatedTotal: (Number(orderDraft[item.id]) || 0) * item.lastPrice,
      })),
      estimatedTotal,
    }
    onRequestsChange(rows => [request, ...rows])
    setTab('Solicitudes')
    onNotify(`Solicitud creada · ${selectedItems.length} productos`)
  }

  const acknowledgeRequest = (requestId: string) => {
    onRequestsChange(rows => rows.map(request => request.id === requestId ? {
      ...request, status: 'Tomada en cuenta', acknowledgedBy: role, acknowledgedAt: `Hoy · ${requestTime()}`,
    } : request))
    onNotify('Solicitud tomada en cuenta')
  }

  const canAcknowledge = ['Dueño', 'Gerencia', 'Administración'].includes(role)
  const canRegisterPurchase = ['Dueño', 'Gerencia', 'Administración', 'Recepción'].includes(role)

  return <section className="page inventory-page">
    <section className="page-heading inventory-heading">
      <div><p className="eyebrow">CONTROL DE EXISTENCIAS</p><h1>Inventario</h1><p>Consulta existencias, registra el conteo físico y prepara la siguiente compra.</p></div>
      <div className="inventory-heading-actions">
        <span><PackageCheck size={14}/><small>Último conteo</small><b>{lastCountLabel}</b></span>
        <button onClick={() => { if (role === 'Cocina') setCountCategory('Alimentos'); setTab('Conteo') }}><ClipboardCheck size={15}/>Hacer conteo</button>
        <button className="primary-action" onClick={() => setTab('Compra recomendada')}><ShoppingCart size={15}/>Revisar compra</button>
      </div>
    </section>

    <section className="inventory-summary">
      <article className={counts.depleted ? 'critical' : ''}><span><AlertTriangle size={14}/>Agotados</span><strong>{counts.depleted}</strong><small>Requieren atención inmediata</small></article>
      <article className={counts.low ? 'warning' : ''}><span><PackageOpen size={14}/>Inventario bajo</span><strong>{counts.low}</strong><small>Por debajo del nivel objetivo</small></article>
      <article><span><ShoppingCart size={14}/>Productos por pedir</span><strong>{counts.order}</strong><small>Incluidos en la recomendación</small></article>
      <article><span><PackageCheck size={14}/>Valor aproximado</span><strong>{money(counts.value)}</strong><small>Existencia × último precio</small></article>
    </section>

    <div className="inventory-tabs" role="tablist" aria-label="Vistas de inventario">
      {(['Existencias', 'Conteo', 'Compra recomendada', 'Solicitudes'] as InventoryTab[]).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)} role="tab" aria-selected={tab === item}>{item === 'Existencias' ? <PackageOpen size={15}/> : item === 'Conteo' ? <ClipboardCheck size={15}/> : item === 'Compra recomendada' ? <ShoppingCart size={15}/> : <ClipboardList size={15}/>} {item}{item === 'Solicitudes' && requests.some(request => request.status === 'Pendiente') && <i>{requests.filter(request => request.status === 'Pendiente').length}</i>}</button>)}
    </div>

    {tab === 'Existencias' && <>
      <section className="inventory-toolbar">
        <label className="inventory-search"><span>BUSCAR PRODUCTO</span><div><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, categoría o unidad…"/></div></label>
        <label><span>CATEGORÍA</span><select value={category} onChange={event => setCategory(event.target.value as typeof category)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>ESTADO</span><select value={stateFilter} onChange={event => setStateFilter(event.target.value as typeof stateFilter)}><option>Todos</option><option>Agotado</option><option>Bajo</option><option>Correcto</option></select></label>
        <span className="inventory-result-count"><SlidersHorizontal size={14}/><b>{visibleItems.length}</b> productos</span>
      </section>

      <section className="panel inventory-table-panel">
        <header><div><span>EXISTENCIA ACTUAL</span><h2>Productos registrados</h2></div><small>Las cantidades mostradas son datos de demostración</small></header>
        <div className="table-scroll inventory-desktop-table"><table className="inventory-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Existencia</th><th>Nivel objetivo</th><th>Estado</th><th>Último conteo</th><th></th></tr></thead><tbody>{visibleItems.map(item => {
          const state = stockState(item)
          return <tr key={item.id}><td><b>{item.name}</b><small>{item.id}</small></td><td>{item.category}</td><td><strong>{formatQuantity(item.stock)}</strong> <small className="inline-unit">{item.unit}</small></td><td>{formatQuantity(item.parLevel)} {item.unit}</td><td><span className={`inventory-state ${state.toLowerCase()}`}>{state}</span></td><td>{item.lastUpdated}</td><td><button className="table-action" onClick={() => { setCountCategory(item.category); setTab('Conteo') }}>Actualizar</button></td></tr>
        })}</tbody></table></div>
        <div className="inventory-mobile-list">{visibleItems.map(item => {
          const state = stockState(item)
          return <article key={item.id}><header><span><b>{item.name}</b><small>{item.id} · {item.category}</small></span><em className={`inventory-state ${state.toLowerCase()}`}>{state}</em></header><div><span><small>EXISTENCIA</small><b>{formatQuantity(item.stock)} <i>{item.unit}</i></b></span><span><small>OBJETIVO</small><b>{formatQuantity(item.parLevel)} <i>{item.unit}</i></b></span></div><footer><small>Conteo: {item.lastUpdated}</small><button onClick={() => { setCountCategory(item.category); setTab('Conteo') }}>Contar</button></footer></article>
        })}</div>
        {!visibleItems.length && <div className="inventory-empty"><Search size={22}/><b>No encontramos productos</b><span>Cambia los filtros o el texto de búsqueda.</span></div>}
      </section>
    </>}

    {tab === 'Conteo' && <section className="inventory-count-layout">
      <article className="panel inventory-count-panel"><header><div><span>CONTEO FÍSICO</span><h2>Actualiza solamente lo que cambió</h2></div><em>{changedCount} modificados</em></header><div className="inventory-count-filter"><label><span>SECCIÓN DEL CONTEO</span><select value={countCategory} onChange={event => setCountCategory(event.target.value as InventoryCategory)}>{categories.filter(item => item !== 'Todas').map(item => <option key={item}>{item}</option>)}</select></label><small>{countItems.length} productos en esta sección</small></div><div className="inventory-count-list">{countItems.map(item => {
        const draft = countDraft[item.id] ?? ''
        const changed = Number(draft) !== item.stock && draft !== ''
        return <div key={item.id} className={changed ? 'changed' : ''}><span><b>{item.name}</b><small>{item.category} · Anterior: {formatQuantity(item.stock)} {item.unit}</small></span><div className="count-control"><button onClick={() => updateCount(item.id, -1)} aria-label={`Restar ${item.name}`}><Minus size={14}/></button><input type="number" min="0" step="0.01" value={draft} onChange={event => setCountDraft({ ...countDraft, [item.id]: event.target.value })}/><i>{item.unit}</i><button onClick={() => updateCount(item.id, 1)} aria-label={`Sumar ${item.name}`}><Plus size={14}/></button></div>{changed ? <CheckCircle2 size={17} className="count-changed-icon"/> : <span className="count-unchanged">Sin cambio</span>}</div>
      })}</div><div className="mobile-count-savebar"><span><b>{changedCount}</b><small>modificados</small></span><button className="primary-action" onClick={saveCount}>Guardar conteo</button></div></article>
      <aside className="panel count-review"><header><div><span>REVISIÓN</span><h2>Antes de guardar</h2></div></header><div><ClipboardCheck size={28}/><b>{changedCount} productos modificados</b><p>El sistema conservará las cantidades que no cambiaste y recalculará la compra sugerida.</p><button className="primary-action" onClick={saveCount}>Guardar conteo</button><button onClick={() => { setCountDraft(Object.fromEntries(items.map(item => [item.id, String(item.stock)]))); setTab('Existencias') }}>Cancelar</button></div></aside>
    </section>}

    {tab === 'Compra recomendada' && <section className="inventory-order-layout">
      <article className="panel recommended-order"><header><div><span>RECOMENDACIÓN SEMANAL</span><h2>{recommended.length} productos por reponer</h2></div><small>Las cantidades pueden editarse antes de solicitar</small></header><div className="recommended-list">{recommended.map(item => <label key={item.id} className={selected.has(item.id) ? 'selected' : ''}><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)}/><span><b>{item.name}</b><small>{item.category} · Hay {formatQuantity(item.stock)} de {formatQuantity(item.parLevel)} {item.unit}</small></span><div><small>COMPRAR</small><input type="number" min="0" step="0.01" value={orderDraft[item.id] ?? ''} onChange={event => setOrderDraft({ ...orderDraft, [item.id]: event.target.value })}/><i>{item.unit}</i></div><strong>{money((Number(orderDraft[item.id]) || 0) * item.lastPrice)}</strong></label>)}</div></article>
      <aside className="panel order-review"><header><div><span>SOLICITUD</span><h2>Resumen de compra</h2></div></header><div className="order-review-body"><span className="order-role">Preparada por <b>{role}</b></span><ul>{selectedItems.map(item => <li key={item.id}><span>{item.name}<small>{orderDraft[item.id]} {item.unit}</small></span><b>{money((Number(orderDraft[item.id]) || 0) * item.lastPrice)}</b></li>)}</ul>{!selectedItems.length && <div className="order-empty"><ShoppingCart size={23}/><span>Selecciona productos para preparar la solicitud.</span></div>}<footer><span><small>ESTIMADO</small><b>{money(estimatedTotal)}</b></span><button className="primary-action" onClick={createRequest}><Check size={15}/>Crear solicitud</button><p>La solicitud no modifica existencias hasta confirmar la compra real en Caja.</p></footer></div></aside>
    </section>}

    {tab === 'Solicitudes' && <section className="purchase-requests-view">
      <header className="purchase-requests-heading"><div><span>SEGUIMIENTO</span><h2>Solicitudes de compra</h2><p>La solicitud conserva lo pedido originalmente. La compra real se corrige y confirma desde Caja.</p></div><div><b>{requests.filter(request => request.status === 'Pendiente').length}</b><small>pendientes de revisión</small></div></header>
      <div className="purchase-request-list">{requests.map(request => <article key={request.id} className={`purchase-request-card ${request.status.toLowerCase().replaceAll(' ', '-')}`}>
        <header><div><span>{request.id}</span><h3>{request.items.length} productos solicitados</h3><small>Creada por {request.createdBy} · {request.createdAt}</small></div><em>{request.status}</em></header>
        <div className="purchase-request-items">{request.items.map(item => <div key={`${request.id}-${item.product}`}><span><b>{item.product}</b><small>{formatQuantity(item.quantity)} {item.unit}</small></span><strong>{money(item.estimatedTotal)}</strong></div>)}</div>
        <footer><span><small>ESTIMADO ORIGINAL</small><b>{money(request.estimatedTotal)}</b></span><div>{request.status === 'Pendiente' && canAcknowledge && <button className="primary-action" onClick={() => acknowledgeRequest(request.id)}><Check size={14}/>Tomar en cuenta</button>}{request.status === 'Pendiente' && !canAcknowledge && <small>Esperando revisión de administración</small>}{request.status === 'Tomada en cuenta' && canRegisterPurchase && <button className="primary-action" onClick={() => onOpenCash(request.id)}>Registrar compra real <ArrowRight size={14}/></button>}{request.status === 'Tomada en cuenta' && !canRegisterPurchase && <small>Administración realizará la compra</small>}{request.status === 'Comprada' && <small><CheckCircle2 size={13}/>Compra registrada por {request.purchasedBy}</small>}</div></footer>
        {request.acknowledgedBy && <p className="request-trace">Tomada en cuenta por {request.acknowledgedBy} · {request.acknowledgedAt}</p>}
      </article>)}</div>
    </section>}
  </section>
}
