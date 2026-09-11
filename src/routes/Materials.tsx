import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ICONS, Icon, KpiTile, LiveBadge, Meter, Panel } from '../components/ui'
import { TrendChart } from '../components/TrendChart'
import { ViewInTwin } from '../components/ViewInTwin'
import { useSimulation } from '../simulation/useSimulation'
import { pushNotification } from '../lib/notifications'
import { clearScenarioAlert, useScenarioAlert } from '../simulation/scenarioAlertState'
import { ScenarioRowBadge } from '../components/ScenarioRowBadge'
import type { Material, PurchaseOrder, PurchaseOrderPriority, PurchaseOrderStatus, Supplier } from '../simulation/types'
import {
  INVENTORY_THRESHOLDS,
  STATUS_COLOR,
  STATUS_LABEL,
  materialStatus,
  materialValue,
  procurementRequired,
  recommendationReason,
  recommendedOrderQty,
  stockCoverDays,
  summarizeInventory,
  type MaterialStatus,
} from '../lib/materialsIntelligence'
import { generateDailySeries } from '../lib/weeklySeries'

const CATEGORIES = ['Raw Material', 'Component', 'Packaging', 'Consumable'] as const
const ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone D'] as const
const STATUS_ORDER: MaterialStatus[] = ['out_of_stock', 'critical', 'low', 'healthy', 'overstock']
const STATUS_SUMMARY_KEY: Record<MaterialStatus, (s: ReturnType<typeof summarizeInventory>) => number> = {
  out_of_stock: (s) => s.outOfStock,
  critical: (s) => s.critical,
  low: (s) => s.low,
  healthy: (s) => s.healthy,
  overstock: (s) => s.overstock,
}

const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  'pending-approval': 'Pending Approval',
  ordered: 'Ordered',
  'partially-received': 'Partially Received',
  received: 'Received',
  delayed: 'Delayed',
}
const PO_STATUS_COLOR: Record<PurchaseOrderStatus, string> = {
  draft: 'var(--app-text-faint)',
  'pending-approval': 'var(--app-info)',
  ordered: 'var(--app-accent)',
  'partially-received': 'var(--app-warning)',
  received: 'var(--app-success)',
  delayed: 'var(--app-danger)',
}
const SHIPMENT_STATUS_ICON: Record<string, string> = { 'on-time': '●', delayed: '▲', arrived: '●', unloading: '●' }
const SHIPMENT_STATUS_COLOR: Record<string, string> = {
  'on-time': 'var(--app-success)',
  delayed: 'var(--app-warning)',
  arrived: 'var(--app-info)',
  unloading: 'var(--app-accent)',
}

type Tab = 'inventory' | 'procurement' | 'inbound' | 'outbound' | 'suppliers'

export default function Materials() {
  const state = useSimulation()
  const navigate = useNavigate()
  const { materials: materialsState } = state
  const { materials, suppliers, purchaseOrders: enginePOs, inboundShipments, outboundShipments } = materialsState

  const [searchParams] = useSearchParams()
  const attnId = searchParams.get('attn')
  const scenarioAlert = useScenarioAlert()

  const [tab, setTab] = useState<Tab>('inventory')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<MaterialStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORIES)[number] | 'all'>('all')
  const [supplierFilter, setSupplierFilter] = useState<string | 'all'>('all')
  const [zoneFilter, setZoneFilter] = useState<(typeof ZONES)[number] | 'all'>('all')
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(attnId)
  const [poDraftMaterial, setPoDraftMaterial] = useState<Material | null>(null)
  const [localPOs, setLocalPOs] = useState<PurchaseOrder[]>([])

  const purchaseOrders = useMemo(() => [...localPOs, ...enginePOs], [localPOs, enginePOs])
  const summary = useMemo(() => summarizeInventory(materials), [materials])
  const required = useMemo(() => procurementRequired(materials), [materials])
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])

  const pendingPOCount = purchaseOrders.filter((p) => p.status !== 'received' && p.status !== 'draft').length
  const supplierDelayCount = suppliers.reduce((a, s) => a + s.delayedOrders, 0)
  const openInboundCount = inboundShipments.filter((s) => s.status !== 'arrived').length

  // Days until this material should be reordered so the PO lands before
  // stock actually runs out — cover minus the supplier's own lead time.
  function reorderInDays(m: Material): number {
    return Math.max(0, stockCoverDays(m) - m.leadTimeDays)
  }
  function reorderByText(m: Material): string {
    const days = reorderInDays(m)
    if (days <= 0) return 'Order now'
    return `Within ${days.toFixed(1)}d`
  }

  const lowStockList = useMemo(() => {
    const rows = materials
      .filter((m) => materialStatus(m) === 'low')
      .sort((a, b) => stockCoverDays(a) - stockCoverDays(b))
      .map((m) => [
        `${m.name} (${m.warehouseZone})`,
        `${Math.round(m.stockLevel).toLocaleString()} ${m.unit}`,
        `${stockCoverDays(m).toFixed(1)}d`,
        reorderByText(m),
        `${m.leadTimeDays}d`,
      ])
    return {
      title: 'Low Stock Materials',
      columns: ['Material', 'Stock On Hand', 'Cover', 'Reorder By', 'Lead Time'],
      rows,
      emptyText: 'No materials are currently below their reorder point.',
      note: 'Cover is days remaining at current daily consumption. "Reorder By" already accounts for the supplier lead time, so stock never actually hits zero if ordered within that window.',
    }
  }, [materials])

  const outOfStockList = useMemo(() => {
    const rows = materials
      .filter((m) => materialStatus(m) === 'out_of_stock')
      .map((m) => [
        `${m.name} (${m.warehouseZone})`,
        `${m.dailyConsumption.toFixed(0)} ${m.unit}/day`,
        supplierById.get(m.supplierId)?.name ?? m.supplierId,
        `${m.leadTimeDays}d`,
        `${recommendedOrderQty(m).toLocaleString()} ${m.unit}`,
      ])
    return {
      title: 'Out of Stock Materials',
      columns: ['Material', 'Daily Use', 'Supplier', 'Lead Time', 'Recommended Order'],
      rows,
      emptyText: 'No materials are currently at zero stock.',
      note: 'These materials have zero units on hand right now — any dependent line is running on borrowed time or already constrained. Recommended order quantity restores about 14 days of cover.',
    }
  }, [materials, supplierById])

  const pendingPurchasesList = useMemo(() => {
    const rows = purchaseOrders
      .filter((p) => p.status !== 'received' && p.status !== 'draft')
      .slice(0, 12)
      .map((p) => {
        const m = materialById.get(p.materialId)
        return [p.poNumber, m?.name ?? p.materialId, PO_STATUS_LABEL[p.status], `${p.quantity.toLocaleString()} ${p.unit}`, p.expectedDelivery]
      })
    return {
      title: 'Pending Purchase Orders',
      columns: ['PO Number', 'Material', 'Status', 'Quantity', 'Expected'],
      rows,
      emptyText: 'No purchase orders are currently pending.',
    }
  }, [purchaseOrders, materialById])

  const inboundList = useMemo(() => {
    const rows = inboundShipments
      .filter((s) => s.status !== 'arrived')
      .map((s) => {
        const m = materialById.get(s.materialId)
        return [s.truck, m?.name ?? s.materialId, `${s.quantity.toLocaleString()} ${s.unit}`, s.gate, s.status === 'delayed' ? 'Delayed' : s.etaLabel]
      })
    return {
      title: 'Inbound Shipments',
      columns: ['Truck', 'Material', 'Quantity', 'Gate', 'ETA'],
      rows,
      emptyText: 'No shipments currently in transit.',
    }
  }, [inboundShipments, materialById])

  const inventoryValueList = useMemo(() => {
    const rows = CATEGORIES.map((cat) => {
      const inCat = materials.filter((m) => m.category === cat)
      const value = inCat.reduce((a, m) => a + materialValue(m), 0)
      const units = inCat.reduce((a, m) => a + m.stockLevel, 0)
      return [cat, Math.round(units).toLocaleString(), `$${(value / 1000).toFixed(0)}k`]
    })
    return {
      title: 'Inventory Value by Category',
      columns: ['Category', 'Units On Hand', 'Value'],
      rows,
      note: 'Value is on-hand stock at recorded unit price — it does not include incoming or on-order quantities.',
    }
  }, [materials])

  const stockCoverList = useMemo(() => {
    const rows = [...materials]
      .sort((a, b) => stockCoverDays(a) - stockCoverDays(b))
      .slice(0, 8)
      .map((m) => [
        `${m.name} (${m.warehouseZone})`,
        `${stockCoverDays(m).toFixed(1)}d`,
        `${m.dailyConsumption.toFixed(0)} ${m.unit}/day`,
        reorderByText(m),
      ])
    return {
      title: 'Stock Cover — Lowest Coverage First',
      columns: ['Material', 'Cover', 'Daily Use', 'Reorder By'],
      rows,
      note: 'The eight materials with the least runway at current consumption, worst first.',
    }
  }, [materials])

  const supplierDelaysList = useMemo(() => {
    const rows = suppliers
      .filter((s) => s.delayedOrders > 0)
      .sort((a, b) => b.delayedOrders - a.delayedOrders)
      .map((s) => [s.name, s.delayedOrders, `${s.onTimePct.toFixed(0)}%`, s.reliability])
    return {
      title: 'Suppliers With Delayed Orders',
      columns: ['Supplier', 'Delayed Orders', 'On-Time Rate', 'Reliability'],
      rows,
      emptyText: 'No suppliers currently have delayed orders.',
    }
  }, [suppliers])

  const filtered = materials.filter((m) => {
    if (statusFilter !== 'all' && materialStatus(m) !== statusFilter) return false
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false
    if (supplierFilter !== 'all' && m.supplierId !== supplierFilter) return false
    if (zoneFilter !== 'all' && m.warehouseZone !== zoneFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!m.name.toLowerCase().includes(q) && !m.materialCode.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Frozen at mount — a 30-day inventory trend is a slow multi-week story;
  // recomputing it from the live total every tick would make the whole
  // shape jump instead of reading as history.
  const [monthlySeries] = useState(() => generateDailySeries('inventory-total-units', summary.totalUnits))

  const selectedMaterial = selectedMaterialId ? materialById.get(selectedMaterialId) ?? null : null

  function openCreatePO(material: Material) {
    setPoDraftMaterial(material)
  }

  function handleCreatePO(po: PurchaseOrder) {
    setLocalPOs((prev) => [po, ...prev])
    setPoDraftMaterial(null)
    setTab('procurement')

    const material = materialById.get(po.materialId)
    const supplier = supplierById.get(po.supplierId)
    pushNotification({
      type: 'success',
      title: `Purchase order ${po.poNumber} placed`,
      message: `${po.quantity.toLocaleString()} ${po.unit} of ${material?.name ?? po.materialId} from ${supplier?.name ?? po.supplierId} · expected ${new Date(po.expectedDelivery).toLocaleDateString()}.`,
      href: '/app/materials',
      hrefLabel: 'VIEW PROCUREMENT →',
    })

    // Ordering stock for the exact material the active scenario preview is
    // about counts as handling it — clear the preview so the banner, the
    // Digital Twin ring and every KPI badge it was showing all drop
    // together, the same way they all appeared together off one store.
    if (scenarioAlert?.materialId === po.materialId) {
      clearScenarioAlert()
      pushNotification({
        type: 'info',
        title: 'Scenario preview resolved',
        message: `${material?.name ?? po.materialId} now has a purchase order in flight, so the "${scenarioAlert.scenarioLabel}" preview has been cleared everywhere it was shown.`,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Materials &amp; Logistics</h1>
          <p className="page-subtitle">Inventory, procurement and material flow intelligence</p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      {/* --------------------------------------------------- KPI command bar -- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <KpiTile icon={<Icon d={ICONS.box} />} label="Total Inventory" value={Math.round(summary.totalUnits).toLocaleString()} unit="units" description="Sum of on-hand stock across every tracked material." />
        <KpiTile icon={<Icon d={ICONS.alert} />} label="Low Stock" value={summary.low} tone={summary.low > 0 ? 'warn' : 'ok'} description="Materials at or below their reorder point, or under 7 days of cover." detailList={lowStockList} roadmap={[]} />
        <KpiTile icon={<Icon d={ICONS.ban} />} label="Out of Stock" value={summary.outOfStock} tone={summary.outOfStock > 0 ? 'crit' : 'ok'} description="Materials with zero stock on hand." detailList={outOfStockList} roadmap={[]} />
        <KpiTile icon={<Icon d={ICONS.clipboard} />} label="Pending Purchases" value={pendingPOCount} unit="orders" description="Purchase orders not yet received (pending approval, ordered, partially received or delayed)." detailList={pendingPurchasesList} roadmap={[]} />
        <KpiTile icon={<Icon d={ICONS.trend} />} label="Inbound" value={openInboundCount} unit="shipments" description="Shipments not yet arrived at the warehouse." detailList={inboundList} roadmap={[]} />
        <KpiTile icon={<Icon d={ICONS.dollar} />} label="Inventory Value" value={`$${(summary.totalValue / 1_000_000).toFixed(2)}M`} description="On-hand stock valued at unit price." detailList={inventoryValueList} roadmap={[]} />
        <KpiTile icon={<Icon d={ICONS.hourglass} />} label="Stock Cover" value={Number.isFinite(summary.avgStockCoverDays) ? summary.avgStockCoverDays.toFixed(1) : '—'} unit="days" description="Average days of coverage remaining across all materials, at current consumption." detailList={stockCoverList} roadmap={[]} />
        <KpiTile icon={<Icon d={ICONS.clock} />} label="Supplier Delays" value={supplierDelayCount} tone={supplierDelayCount > 0 ? 'warn' : 'ok'} description="Currently delayed orders across all suppliers." detailList={supplierDelaysList} roadmap={[]} />
      </div>

      {/* ------------------------------------------------------- inventory health -- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Panel label="Inventory Health">
          <div className="flex flex-col gap-4 p-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(statusFilter === s ? 'all' : s)
                    setTab('inventory')
                  }}
                  className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left"
                  style={{
                    background: 'var(--app-surface-soft)',
                    border: `1px solid ${statusFilter === s ? STATUS_COLOR[s] : 'var(--app-border)'}`,
                  }}
                >
                  <span className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider" style={{ color: STATUS_COLOR[s] }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[s], display: 'inline-block' }} />
                    {STATUS_LABEL[s]}
                  </span>
                  <span className="tnum text-[18px] font-bold" style={{ color: 'var(--app-text)' }}>
                    {STATUS_SUMMARY_KEY[s](summary)}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <p className="mb-2 flex items-baseline justify-between">
                <span className="label">Inventory Level — Last 30 Days</span>
                <span className="tnum text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
                  {summary.healthPct.toFixed(0)}% healthy
                </span>
              </p>
              <TrendChart
                label="Total Inventory"
                unit="units"
                data={monthlySeries.map((p) => p.v)}
                color="var(--app-accent)"
                formatter={(v) => Math.round(v).toLocaleString()}
                height={110}
                xAxisCaption="date (last 30 days)"
                xAxisStart="−30d"
                hoverUnit="d ago"
                variant="wave"
              />
            </div>

            <div>
              <p className="label mb-2">Warehouse Zones</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ZONES.map((zone) => {
                  const inZone = materials.filter((m) => m.warehouseZone === zone)
                  const cap = inZone.reduce((a, m) => a + m.capacity, 0)
                  const used = inZone.reduce((a, m) => a + m.stockLevel, 0)
                  const pct = cap > 0 ? (used / cap) * 100 : 0
                  const worst = inZone.some((m) => materialStatus(m) === 'critical' || materialStatus(m) === 'out_of_stock')
                    ? 'critical'
                    : inZone.some((m) => materialStatus(m) === 'low')
                      ? 'low'
                      : 'healthy'
                  return (
                    <button
                      key={zone}
                      onClick={() => {
                        setZoneFilter(zoneFilter === zone ? 'all' : zone)
                        setTab('inventory')
                      }}
                      className="flex flex-col gap-1.5 rounded-lg px-2.5 py-2 text-left"
                      style={{ background: 'var(--app-surface-soft)', border: `1px solid ${zoneFilter === zone ? 'var(--app-accent-border)' : 'var(--app-border)'}` }}
                    >
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--app-text)' }}>
                        {zone}
                      </span>
                      <span className="text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
                        {inZone[0]?.category ?? '—'}
                      </span>
                      <Meter value={pct} max={100} tone={worst === 'critical' ? 'var(--app-danger)' : worst === 'low' ? 'var(--app-warning)' : 'var(--app-success)'} />
                      <span className="tnum text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                        {pct.toFixed(0)}% capacity
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Panel>

        {/* ------------------------------------------------- procurement required -- */}
        <Panel label="Procurement Required" action={<span className="label">{required.length} items</span>}>
          {required.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
              <span className="text-[13px]" style={{ color: 'var(--app-text-muted)' }}>
                Nothing requires procurement right now
              </span>
              <span className="text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
                Every material is above its reorder point and within a healthy coverage window
              </span>
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {required.map((m) => {
                const status = materialStatus(m)
                const cover = stockCoverDays(m)
                const supplier = supplierById.get(m.supplierId)
                const qty = recommendedOrderQty(m)
                return (
                  <li key={m.id} className="flex flex-col gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="status-chip" style={{ color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status], background: 'transparent' }}>
                          {STATUS_LABEL[status]}
                        </span>
                        <button onClick={() => setSelectedMaterialId(m.id)} className="text-[12.5px] font-semibold hover:underline" style={{ color: 'var(--app-text)' }}>
                          {m.name}
                        </button>
                      </div>
                      <button
                        onClick={() => openCreatePO(m)}
                        className="flex-shrink-0 rounded-sm px-2.5 py-1 text-[10px] font-bold"
                        style={{ background: status === 'low' ? 'var(--app-surface-soft)' : STATUS_COLOR[status], color: status === 'low' ? 'var(--app-text)' : '#0a0a0a', border: `1px solid ${STATUS_COLOR[status]}` }}
                      >
                        {status === 'low' ? 'REVIEW' : 'CREATE PURCHASE ORDER'}
                      </button>
                    </div>
                    <div className="tnum grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4" style={{ color: 'var(--app-text-muted)' }}>
                      <span>
                        Stock: {m.stockLevel.toFixed(0)} {m.unit}
                      </span>
                      <span>
                        Daily use: {m.dailyConsumption.toFixed(0)} {m.unit}/day
                      </span>
                      <span style={{ color: STATUS_COLOR[status] }}>Cover: {Number.isFinite(cover) ? `${cover.toFixed(1)}d` : '—'}</span>
                      <span>Recommended: {qty.toLocaleString()}</span>
                      <span>Supplier: {supplier?.name ?? m.supplierId}</span>
                      <span>Lead time: {m.leadTimeDays}d</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------------------- tabs -- */}
      <div className="flex flex-wrap gap-1.5">
        {(['inventory', 'procurement', 'inbound', 'outbound', 'suppliers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-sm px-3 py-1.5 text-[12px] font-semibold capitalize"
            style={{
              background: tab === t ? 'var(--app-accent-bg)' : 'var(--app-surface-soft)',
              color: tab === t ? 'var(--app-accent)' : 'var(--app-text-muted)',
              border: `1px solid ${tab === t ? 'var(--app-accent-border)' : 'var(--app-border)'}`,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <Panel label="Material Stock Status" action={<span className="label">{filtered.length} of {materials.length}</span>}>
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--app-border)' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials…"
              className="min-w-[160px] flex-1 rounded-sm px-2.5 py-1.5 text-[12px]"
              style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
            />
            <Select value={statusFilter} onChange={(v) => setStatusFilter(v as MaterialStatus | 'all')} options={['all', ...STATUS_ORDER]} labels={{ all: 'All statuses', ...STATUS_LABEL }} />
            <Select value={categoryFilter} onChange={(v) => setCategoryFilter(v as (typeof CATEGORIES)[number] | 'all')} options={['all', ...CATEGORIES]} labels={{ all: 'All categories' }} />
            <Select value={supplierFilter} onChange={(v) => setSupplierFilter(v)} options={['all', ...suppliers.map((s) => s.id)]} labels={{ all: 'All suppliers', ...Object.fromEntries(suppliers.map((s) => [s.id, s.name])) }} />
            {zoneFilter !== 'all' && (
              <button onClick={() => setZoneFilter('all')} className="text-[11px] font-medium" style={{ color: 'var(--app-accent)' }}>
                {zoneFilter} ✕
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Material', 'Category', 'Current Stock', 'Reorder Point', 'Daily Consumption', 'Stock Cover', 'Incoming', 'Supplier', 'Status', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const status = materialStatus(m)
                  const cover = stockCoverDays(m)
                  const supplier = supplierById.get(m.supplierId)
                  const isScenarioTarget = scenarioAlert?.materialId === m.id
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMaterialId(m.id)}
                      className="cursor-pointer"
                      style={{
                        borderBottom: '1px solid var(--app-border)',
                        background: isScenarioTarget ? 'var(--app-danger-bg)' : attnId === m.id ? 'var(--app-accent-bg)' : undefined,
                        outline: isScenarioTarget ? '1px solid var(--app-danger-border)' : undefined,
                        outlineOffset: isScenarioTarget ? -1 : undefined,
                      }}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: 'var(--app-text)' }} className="font-medium">
                            {m.name}
                          </span>
                          {isScenarioTarget && <ScenarioRowBadge note={scenarioAlert!.whatIsHappening} />}
                        </div>
                        <div className="tnum text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                          {m.materialCode}
                        </div>
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {m.category}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text)' }}>
                        {m.stockLevel.toFixed(0)} {m.unit}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                        {m.reorderLevel.toLocaleString()}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                        {m.dailyConsumption.toFixed(0)}/day
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: STATUS_COLOR[status] }}>
                        {Number.isFinite(cover) ? `${cover.toFixed(1)}d` : '—'}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                        {m.incomingQuantity > 0 ? m.incomingQuantity.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {supplier?.name ?? m.supplierId}
                      </td>
                      <td className="px-3 py-2">
                        <span className="status-chip" style={{ color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status], background: 'transparent' }}>
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedMaterialId(m.id)
                          }}
                          className="text-[10.5px] font-bold"
                          style={{ color: 'var(--app-info)' }}
                        >
                          DETAILS
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-[12px]" style={{ color: 'var(--app-text-faint)' }}>
                      No materials match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'procurement' && (
        <Panel label="Purchase Orders" action={<span className="label">{purchaseOrders.length} orders</span>}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Purchase Order', 'Material', 'Supplier', 'Quantity', 'Order Date', 'Expected Delivery', 'Status', 'Priority'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => {
                  const material = materialById.get(po.materialId)
                  const supplier = supplierById.get(po.supplierId)
                  return (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                      <td className="tnum px-3 py-2 font-[family-name:var(--font-mono)]" style={{ color: 'var(--app-accent)' }}>
                        {po.poNumber}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text)' }}>
                        {material?.name ?? po.materialId}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {supplier?.name ?? po.supplierId}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {po.quantity.toLocaleString()} {po.unit}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                        {new Date(po.orderedAt).toLocaleDateString()}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                        {new Date(po.expectedDelivery).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className="status-chip" style={{ color: PO_STATUS_COLOR[po.status], borderColor: PO_STATUS_COLOR[po.status], background: 'transparent' }}>
                          {PO_STATUS_LABEL[po.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 capitalize" style={{ color: po.priority === 'urgent' ? 'var(--app-danger)' : po.priority === 'high' ? 'var(--app-warning)' : 'var(--app-text-muted)' }}>
                        {po.priority}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'inbound' && (
        <Panel label="Inbound Materials" action={<span className="label">{inboundShipments.length} shipments</span>}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Supplier', 'Material', 'Quantity', 'Truck', 'Gate', 'ETA', 'Destination', 'Status', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inboundShipments.map((s) => {
                  const material = materialById.get(s.materialId)
                  const supplier = supplierById.get(s.supplierId)
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text)' }}>
                        {supplier?.name ?? s.supplierId}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {material?.name ?? s.materialId}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {s.quantity.toLocaleString()} {s.unit}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                        {s.truck}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                        {s.gate}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                        {s.etaLabel}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {s.destinationZone}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5" style={{ color: SHIPMENT_STATUS_COLOR[s.status] }}>
                          <span aria-hidden="true">{SHIPMENT_STATUS_ICON[s.status]}</span>
                          {s.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{s.vehicleId && <ViewInTwin kind="vehicle" id={s.vehicleId} label="Twin" />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'outbound' && (
        <Panel label="Outbound Shipments" action={<span className="label">{outboundShipments.length} dispatches</span>}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Dispatch', 'Destination', 'Product', 'Quantity', 'Truck', 'ETA', 'Status', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outboundShipments.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <td className="tnum px-3 py-2 font-[family-name:var(--font-mono)]" style={{ color: 'var(--app-accent)' }}>
                      {s.dispatchNumber}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--app-text)' }}>
                      {s.destination}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                      {s.product}
                    </td>
                    <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                      {s.quantity.toLocaleString()} {s.unit}
                    </td>
                    <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                      {s.truck}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--app-text-faint)' }}>
                      {s.etaLabel}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5" style={{ color: SHIPMENT_STATUS_COLOR[s.status] }}>
                        <span aria-hidden="true">{SHIPMENT_STATUS_ICON[s.status]}</span>
                        {s.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{s.vehicleId && <ViewInTwin kind="vehicle" id={s.vehicleId} label="Twin" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'suppliers' && (
        <Panel label="Supplier Performance" action={<span className="label">{suppliers.length} suppliers</span>}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Supplier', 'On-Time %', 'Active Orders', 'Avg Lead Time', 'Delayed Orders', 'Reliability', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--app-text)' }}>
                      {s.name}
                    </td>
                    <td className="tnum px-3 py-2" style={{ color: s.onTimePct >= 90 ? 'var(--app-success)' : s.onTimePct >= 80 ? 'var(--app-warning)' : 'var(--app-danger)' }}>
                      {s.onTimePct.toFixed(1)}%
                    </td>
                    <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                      {s.activeOrders}
                    </td>
                    <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                      {s.avgLeadTimeDays.toFixed(1)} days
                    </td>
                    <td className="tnum px-3 py-2" style={{ color: s.delayedOrders > 0 ? 'var(--app-warning)' : 'var(--app-text-faint)' }}>
                      {s.delayedOrders}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="status-chip"
                        style={
                          s.reliability === 'Excellent'
                            ? { color: 'var(--app-success)', borderColor: 'var(--app-success)', background: 'transparent' }
                            : s.reliability === 'Good'
                              ? { color: 'var(--app-info)', borderColor: 'var(--app-info)', background: 'transparent' }
                              : { color: 'var(--app-warning)', borderColor: 'var(--app-warning)', background: 'transparent' }
                        }
                      >
                        {s.reliability}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          setSupplierFilter(s.id)
                          setTab('inventory')
                        }}
                        className="text-[10.5px] font-bold"
                        style={{ color: 'var(--app-info)' }}
                      >
                        VIEW MATERIALS
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {selectedMaterial && (
        <MaterialDetailPanel
          material={selectedMaterial}
          supplier={supplierById.get(selectedMaterial.supplierId)}
          onClose={() => setSelectedMaterialId(null)}
          onCreatePO={() => openCreatePO(selectedMaterial)}
          onOpenTwin={() => navigate('/app/digital-twin?focus=building:BLD-WARE')}
        />
      )}

      {poDraftMaterial && (
        <CreatePOModal material={poDraftMaterial} supplier={supplierById.get(poDraftMaterial.supplierId)} onCancel={() => setPoDraftMaterial(null)} onCreate={handleCreatePO} />
      )}
    </div>
  )
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (v: string) => void; options: string[]; labels: Record<string, string> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-sm px-2 py-1.5 text-[11.5px]"
      style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o] ?? o}
        </option>
      ))}
    </select>
  )
}

/* ---------------------------------------------------------- material detail -- */

function MaterialDetailPanel({
  material,
  supplier,
  onClose,
  onCreatePO,
  onOpenTwin,
}: {
  material: Material
  supplier: Supplier | undefined
  onClose: () => void
  onCreatePO: () => void
  onOpenTwin: () => void
}) {
  const status = materialStatus(material)
  const cover = stockCoverDays(material)
  const qty = recommendedOrderQty(material)

  const [series] = useState(() => generateDailySeries(`material-${material.id}`, material.stockLevel))

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[1000]" onClick={onClose} aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <div
        className="kpi-side-panel animate-slide-in-right"
        style={{
          position: 'fixed',
          top: 'var(--app-header-h)',
          right: 0,
          bottom: 0,
          width: 'min(480px, 100vw)',
          background: 'var(--app-panel)',
          borderLeft: '1px solid var(--app-border)',
          boxShadow: 'var(--app-shadow-lg)',
          overflowY: 'auto',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${material.name} details`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--app-border)', position: 'sticky', top: 0, background: 'var(--app-panel)', zIndex: 1 }}>
          <div className="min-w-0">
            <p className="label">{material.materialCode} · {material.category}</p>
            <p className="mt-0.5 text-[17px] font-bold" style={{ color: 'var(--app-text)' }}>
              {material.name.toUpperCase()}
            </p>
            <span className="status-chip mt-2" style={{ color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status], background: 'transparent' }}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            <DetailStat label="Current Stock" value={`${material.stockLevel.toFixed(0)} ${material.unit}`} />
            <DetailStat label="Reorder Point" value={`${material.reorderLevel.toLocaleString()} ${material.unit}`} />
            <DetailStat label="Daily Consumption" value={`${material.dailyConsumption.toFixed(0)} ${material.unit}`} />
            <DetailStat label="Stock Cover" value={Number.isFinite(cover) ? `${cover.toFixed(1)} days` : '—'} color={STATUS_COLOR[status]} />
            <DetailStat label="Incoming" value={material.incomingQuantity > 0 ? `${material.incomingQuantity.toLocaleString()} ${material.unit}` : 'None scheduled'} />
            <DetailStat label="Supplier" value={supplier?.name ?? material.supplierId} />
            <DetailStat label="Lead Time" value={`${material.leadTimeDays} days`} />
            <DetailStat label="Warehouse" value={material.warehouseZone} />
          </div>

          <p className="label mb-2 mt-4">Used By</p>
          <div className="flex flex-wrap gap-1.5">
            {material.productionLines.length === 0 && (
              <span className="text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
                Not currently linked to a production line.
              </span>
            )}
            {material.productionLines.map((l) => (
              <span key={l} className="status-chip status-chip-info">
                {l}
              </span>
            ))}
          </div>

          <p className="label mb-2 mt-5">Stock Trend — Last 30 Days</p>
          <div className="kpi-modal-card" style={{ padding: '10px 10px 4px' }}>
            <TrendChart
              label="Stock Level"
              unit={material.unit}
              data={series.map((p) => p.v)}
              color={STATUS_COLOR[status]}
              formatter={(v) => v.toFixed(0)}
              height={110}
              threshold={{ warning: material.reorderLevel, critical: material.minimumStock, direction: 'below', unit: ` ${material.unit}` }}
              xAxisCaption="date (last 30 days)"
              xAxisStart="−30d"
              hoverUnit="d ago"
            />
          </div>

          <p className="label mb-2 mt-5">AI Forecast</p>
          <div className="flex items-start gap-2.5 rounded-lg p-3" style={{ background: 'var(--app-advisory-panel)', color: '#fef9ef' }}>
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <div className="text-[12px] leading-relaxed">
              <p>
                Expected stockout: <b className="tnum">{Number.isFinite(cover) ? `${cover.toFixed(1)} days` : 'no measurable draw'}</b>
                {material.productionLines.length > 0 && (
                  <>
                    {' '}
                    — <b>{material.productionLines.join(', ')}</b> may be affected if replenishment is delayed.
                  </>
                )}
              </p>
              <p className="mt-2">{recommendationReason(material)}</p>
              {qty > 0 && (
                <p className="mt-2">
                  Recommended purchase: <b className="tnum">{qty.toLocaleString()}</b> {material.unit}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={onCreatePO} className="flex-1 rounded-sm py-2 text-[11.5px] font-bold" style={{ background: 'var(--app-accent)', color: '#0a0a0a' }}>
              CREATE PURCHASE ORDER
            </button>
            <button onClick={onOpenTwin} className="rounded-sm px-3 py-2 text-[11.5px] font-semibold" style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
              View Warehouse in Twin
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function DetailStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-sm p-2.5" style={{ background: 'var(--app-surface-soft)' }}>
      <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
        {label}
      </p>
      <p className="tnum mt-0.5 text-[13px] font-semibold" style={{ color: color ?? 'var(--app-text)' }}>
        {value}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ create PO modal -- */

let poCounter = 200

function CreatePOModal({
  material,
  supplier,
  onCancel,
  onCreate,
}: {
  material: Material
  supplier: Supplier | undefined
  onCancel: () => void
  onCreate: (po: PurchaseOrder) => void
}) {
  const status = materialStatus(material)
  const [qty, setQty] = useState(() => recommendedOrderQty(material) || material.reorderLevel)
  const [priority, setPriority] = useState<PurchaseOrderPriority>(status === 'critical' || status === 'out_of_stock' ? 'urgent' : status === 'low' ? 'high' : 'standard')

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onCancel])

  function submit() {
    poCounter++
    const po: PurchaseOrder = {
      id: `PO-LOCAL-${poCounter}`,
      poNumber: `PO-2026-${String(poCounter).padStart(5, '0')}`,
      materialId: material.id,
      supplierId: material.supplierId,
      quantity: qty,
      unit: material.unit,
      orderedAt: new Date().toISOString(),
      expectedDelivery: new Date(Date.now() + material.leadTimeDays * 86_400_000).toISOString(),
      status: 'pending-approval',
      priority,
      reason: recommendationReason(material),
    }
    onCreate(po)
  }

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto p-6" style={{ background: 'rgba(0, 0, 0, 0.55)' }} onClick={onCancel}>
      <div
        className="kpi-modal-card mt-16 w-full max-w-md"
        style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', borderRadius: 12, boxShadow: 'var(--app-shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create purchase order"
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <p className="text-[15px] font-semibold" style={{ color: 'var(--app-text)' }}>
            Create Purchase Order
          </p>
          <button onClick={onCancel} className="icon-btn" aria-label="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 text-[12.5px]">
          <FormRow label="Material" value={`${material.name} (${material.materialCode})`} />
          <FormRow label="Supplier" value={supplier?.name ?? material.supplierId} />
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: 'var(--app-text-faint)' }}>Quantity</span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value.replace(/[^0-9]/g, '')) || 0))}
                className="tnum w-24 rounded-sm px-2 py-1 text-right"
                style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
              />
              <span style={{ color: 'var(--app-text-faint)' }}>{material.unit}</span>
            </div>
          </div>
          <FormRow label="Required By" value={new Date(Date.now() + INVENTORY_THRESHOLDS.criticalDays * 86_400_000).toLocaleDateString()} />
          <FormRow label="Estimated Delivery" value={new Date(Date.now() + material.leadTimeDays * 86_400_000).toLocaleDateString()} />
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: 'var(--app-text-faint)' }}>Priority</span>
            <div className="flex gap-1.5">
              {(['standard', 'high', 'urgent'] as PurchaseOrderPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="rounded-sm px-2 py-1 text-[10.5px] font-semibold capitalize"
                  style={{
                    background: priority === p ? 'var(--app-accent-bg)' : 'var(--app-surface-soft)',
                    color: priority === p ? 'var(--app-accent)' : 'var(--app-text-faint)',
                    border: `1px solid ${priority === p ? 'var(--app-accent-border)' : 'var(--app-border)'}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ color: 'var(--app-text-faint)' }}>Reason</p>
            <p className="mt-1 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              {recommendationReason(material)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onCancel} className="flex-1 rounded-sm py-2 text-[11.5px] font-semibold" style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
            Cancel
          </button>
          <button onClick={submit} className="flex-1 rounded-sm py-2 text-[11.5px] font-bold" style={{ background: 'var(--app-accent)', color: '#0a0a0a' }}>
            Create Purchase Order
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function FormRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: 'var(--app-text-faint)' }}>{label}</span>
      <span className="font-medium" style={{ color: 'var(--app-text)' }}>
        {value}
      </span>
    </div>
  )
}
