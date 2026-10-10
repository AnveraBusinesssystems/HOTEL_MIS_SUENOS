import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Check, CheckCircle2, ClipboardCheck, Minus, PackageCheck,
  PackageOpen, Plus, Search, ShoppingCart, SlidersHorizontal,
} from 'lucide-react'
import type { InventoryCategory, InventoryItem, Role } from '../types'
import { money } from '../utils'

type InventoryTab = 'Existencias' | 'Conteo' | 'Compra recomendada'
type StockState = 'Agotado' | 'Bajo' | 'Correcto'

type Props = {
  role: Role
  items: InventoryItem[]
  onChange: (updater: (rows: InventoryItem[]) => InventoryItem[]) => void
  onNotify: (message: string) => void
}

const categories: Array<'Todas' | InventoryCategory> = ['Todas', 'Alimentos', 'Bebidas', 'Limpieza', 'Lavandería', 'Amenidades', 'Suministros']

const stockState = (item: InventoryItem): StockState => item.stock <= 0 ? 'Agotado' : item.stock < item.parLevel ? 'Bajo' : 'Correcto'
const formatQuantity = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value)

export function InventoryView({ role, items, onChange, onNotify }: Props) {
  const [tab, setTab] = useState<InventoryTab>('Existencias')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'Todas' | InventoryCategory>('Todas')
  const [stateFilter, setStateFilter] = useState<'Todos' | StockState>('Todos')
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
    onNotify(`Solicitud preparada · ${selectedItems.length} productos`)
  }

  return <section className="page inventory-page">
    <section className="page-heading inventory-heading">
      <div><p className="eyebrow">CONTROL DE EXISTENCIAS</p><h1>Inventario</h1><p>Consulta existencias, registra el conteo físico y prepara la siguiente compra.</p></div>
      <div className="inventory-heading-actions">
        <span><PackageCheck size={14}/><small>Último conteo</small><b>{lastCountLabel}</b></span>
        <button onClick={() => setTab('Conteo')}><ClipboardCheck size={15}/>Hacer conteo</button>
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
      {(['Existencias', 'Conteo', 'Compra recomendada'] as InventoryTab[]).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)} role="tab" aria-selected={tab === item}>{item === 'Existencias' ? <PackageOpen size={15}/> : item === 'Conteo' ? <ClipboardCheck size={15}/> : <ShoppingCart size={15}/>} {item}</button>)}
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
        <div className="table-scroll"><table className="inventory-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Existencia</th><th>Nivel objetivo</th><th>Estado</th><th>Último conteo</th><th></th></tr></thead><tbody>{visibleItems.map(item => {
          const state = stockState(item)
          return <tr key={item.id}><td><b>{item.name}</b><small>{item.id}</small></td><td>{item.category}</td><td><strong>{formatQuantity(item.stock)}</strong> <small className="inline-unit">{item.unit}</small></td><td>{formatQuantity(item.parLevel)} {item.unit}</td><td><span className={`inventory-state ${state.toLowerCase()}`}>{state}</span></td><td>{item.lastUpdated}</td><td><button className="table-action" onClick={() => setTab('Conteo')}>Actualizar</button></td></tr>
        })}</tbody></table></div>
        {!visibleItems.length && <div className="inventory-empty"><Search size={22}/><b>No encontramos productos</b><span>Cambia los filtros o el texto de búsqueda.</span></div>}
      </section>
    </>}

    {tab === 'Conteo' && <section className="inventory-count-layout">
      <article className="panel inventory-count-panel"><header><div><span>CONTEO FÍSICO</span><h2>Actualiza solamente lo que cambió</h2></div><em>{changedCount} modificados</em></header><div className="inventory-count-list">{items.map(item => {
        const draft = countDraft[item.id] ?? ''
        const changed = Number(draft) !== item.stock && draft !== ''
        return <div key={item.id} className={changed ? 'changed' : ''}><span><b>{item.name}</b><small>{item.category} · Anterior: {formatQuantity(item.stock)} {item.unit}</small></span><div className="count-control"><button onClick={() => updateCount(item.id, -1)} aria-label={`Restar ${item.name}`}><Minus size={14}/></button><input type="number" min="0" step="0.01" value={draft} onChange={event => setCountDraft({ ...countDraft, [item.id]: event.target.value })}/><i>{item.unit}</i><button onClick={() => updateCount(item.id, 1)} aria-label={`Sumar ${item.name}`}><Plus size={14}/></button></div>{changed ? <CheckCircle2 size={17} className="count-changed-icon"/> : <span className="count-unchanged">Sin cambio</span>}</div>
      })}</div></article>
      <aside className="panel count-review"><header><div><span>REVISIÓN</span><h2>Antes de guardar</h2></div></header><div><ClipboardCheck size={28}/><b>{changedCount} productos modificados</b><p>El sistema conservará las cantidades que no cambiaste y recalculará la compra sugerida.</p><button className="primary-action" onClick={saveCount}>Guardar conteo</button><button onClick={() => { setCountDraft(Object.fromEntries(items.map(item => [item.id, String(item.stock)]))); setTab('Existencias') }}>Cancelar</button></div></aside>
    </section>}

    {tab === 'Compra recomendada' && <section className="inventory-order-layout">
      <article className="panel recommended-order"><header><div><span>RECOMENDACIÓN SEMANAL</span><h2>{recommended.length} productos por reponer</h2></div><small>Las cantidades pueden editarse antes de solicitar</small></header><div className="recommended-list">{recommended.map(item => <label key={item.id} className={selected.has(item.id) ? 'selected' : ''}><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)}/><span><b>{item.name}</b><small>{item.category} · Hay {formatQuantity(item.stock)} de {formatQuantity(item.parLevel)} {item.unit}</small></span><div><small>COMPRAR</small><input type="number" min="0" step="0.01" value={orderDraft[item.id] ?? ''} onChange={event => setOrderDraft({ ...orderDraft, [item.id]: event.target.value })}/><i>{item.unit}</i></div><strong>{money((Number(orderDraft[item.id]) || 0) * item.lastPrice)}</strong></label>)}</div></article>
      <aside className="panel order-review"><header><div><span>SOLICITUD</span><h2>Resumen de compra</h2></div></header><div className="order-review-body"><span className="order-role">Preparada por <b>{role}</b></span><ul>{selectedItems.map(item => <li key={item.id}><span>{item.name}<small>{orderDraft[item.id]} {item.unit}</small></span><b>{money((Number(orderDraft[item.id]) || 0) * item.lastPrice)}</b></li>)}</ul>{!selectedItems.length && <div className="order-empty"><ShoppingCart size={23}/><span>Selecciona productos para preparar la solicitud.</span></div>}<footer><span><small>ESTIMADO</small><b>{money(estimatedTotal)}</b></span><button className="primary-action" onClick={createRequest}><Check size={15}/>Crear solicitud</button><p>Este botón es demostrativo hasta conectar Caja e Inventario.</p></footer></div></aside>
    </section>}
  </section>
}
