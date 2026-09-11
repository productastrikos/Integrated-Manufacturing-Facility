import { useNavigate } from 'react-router-dom'
import { KpiTile, Meter, Panel, StateChip } from '../components/ui'
import { TrendChart } from '../components/TrendChart'
import { useSimulation } from '../simulation/useSimulation'
import { useEquipmentHistory } from './equipmentHistory'
import { areaLayoutById, buildingLayoutById, lineLayoutById } from './layout'
import { useSelection } from './selection'
import { BmsAssetPanel, CameraPanel, FloorPanel, RoomPanel, SafetyAssetPanel, StagePanel, VehiclePanel } from './InfoPanelExtras'
import type { SimulationState } from '../simulation/types'
import { materialStatus, STATUS_COLOR, summarizeInventory } from '../lib/materialsIntelligence'
import { KPI_THRESHOLDS } from '../lib/kpiThresholds'
import {
  AdministrationBody,
  BuildingBodyHeader,
  LoadingDispatchBody,
  MainGateBody,
  MaintenanceAreaBody,
  ProductionOperationsSummary,
  SecurityAreaBody,
  UtilityAreaBody,
} from './BuildingPanels'
import { ZONE_META } from './zoneIntel'
import { buildAttentionFeed } from '../lib/attentionFeed'
import type { SelectionKind } from './selection'

const STATUS_LABEL: Record<string, string> = {
  gate: 'Gate',
  building: 'Building',
  area: 'Area',
}

export function InfoPanel() {
  const { selection, select, clear } = useSelection()
  const state = useSimulation()

  if (!selection || selection.kind === 'site') return <SitePanel state={state} onSelect={select} />
  if (selection.kind === 'building') return <BuildingPanel id={selection.id} state={state} onSelect={select} />
  if (selection.kind === 'floor') return <FloorPanel id={selection.id} state={state} onSelect={select} />
  if (selection.kind === 'room') return <RoomPanel id={selection.id} state={state} onSelect={select} />
  if (selection.kind === 'vehicle') return <VehiclePanel id={selection.id} state={state} />
  if (selection.kind === 'stage') return <StagePanel id={selection.id} state={state} />
  if (selection.kind === 'bms') return <BmsAssetPanel id={selection.id} state={state} />
  if (selection.kind === 'camera') return <CameraPanel id={selection.id} state={state} />
  if (selection.kind === 'safety') return <SafetyAssetPanel id={selection.id} state={state} />
  if (selection.kind === 'area') return <AreaPanel id={selection.id} state={state} onSelect={select} />
  if (selection.kind === 'line') return <LinePanel id={selection.id} state={state} onSelect={select} />
  return <EquipmentPanel id={selection.id} state={state} onBack={clear} />
}

/* ------------------------------------------------------------------ site - */

function SitePanel({ state, onSelect }: { state: SimulationState; onSelect: (k: SelectionKind, id: string) => void }) {
  const { kpis, energy } = state
  const materialsSummary = summarizeInventory(state.materials.materials)
  const worst = buildAttentionFeed(state)[0]

  return (
    <Panel label="Facility Overview" action={<span className="label">{state.site.name}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <p className="text-[12px] text-[var(--app-text-muted)]">
          Click any building, production area, line or equipment in the scene to inspect it. Nothing is
          selected — this is the factory overview.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Facility Health" value={kpis.systemHealthPct.toFixed(0)} unit="%" description="Composite score across production, equipment, safety and security." />
          <KpiTile label="Active Equipment" value={kpis.equipmentRunning} unit={`/ ${kpis.equipmentTotal}`} description="Equipment currently running versus the total across the facility." />
          <KpiTile label="Production Lines" value={kpis.linesRunning} unit={`/ ${kpis.linesTotal}`} description="Production lines currently running versus the total across the facility." />
          <KpiTile label="OEE" value={kpis.oeePct.toFixed(1)} unit="%" description="Overall Equipment Effectiveness across the site." threshold={KPI_THRESHOLDS.oee} />
          <KpiTile label="Material Health" value={materialsSummary.healthPct.toFixed(0)} unit="%" description="Share of materials that are healthy or overstock." />
          <KpiTile label="Energy Consumption" value={energy.currentDemandMw.toFixed(2)} unit="MW" description="Instantaneous site power draw." threshold={KPI_THRESHOLDS.energyDemand} />
        </div>
        <KpiTile label="Critical Alerts" value={state.safetySecurity.criticalAlerts} tone={state.safetySecurity.criticalAlerts > 0 ? 'crit' : 'ok'} description="Equipment currently in a critical fault state." />

        {worst && (
          <div className="border-t border-[var(--app-border)] pt-3">
            <p className="label mb-2">🤖 AI Facility Insight</p>
            <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: 'var(--app-advisory-panel)', color: '#fef9ef' }}>
              <p className="text-[11.5px] leading-relaxed">{worst.description}</p>
            </div>
            <button
              onClick={() => onSelect(worst.twinKind, worst.twinId)}
              className="mt-2 w-full rounded-sm py-1.5 text-[11px] font-bold"
              style={{ background: 'var(--app-accent-bg)', color: 'var(--app-accent)', border: '1px solid var(--app-accent-border)' }}
            >
              INVESTIGATE
            </button>
          </div>
        )}

      </div>
    </Panel>
  )
}

/* -------------------------------------------------------------- building - */

const CATEGORY_EMOJI: Record<string, string> = {
  security: '🛡️',
  facilities: '🏢',
  production: '🏭',
  materials: '📦',
  utilities: '⚡',
  maintenance: '🔧',
  logistics: '🚚',
}

function BuildingPanel({ id, state, onSelect }: { id: string; state: SimulationState; onSelect: (k: 'area', id: string) => void }) {
  const navigate = useNavigate()
  const layout = buildingLayoutById(id)
  const building = state.buildings.find((b) => b.id === id)
  if (!layout || !building) return null

  const isProduction = id === 'BLD-PROD'
  const isWarehouse = id === 'BLD-WARE'
  const meta = ZONE_META[id]
  const areasInBuilding = state.areas.filter((a) => a.buildingId === id)

  return (
    <Panel label={STATUS_LABEL[layout.building.kind] ?? 'Facility'} action={<span className="label">{id}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="flex items-center gap-1.5 text-[15px] font-semibold">
            {meta && <span aria-hidden="true">{CATEGORY_EMOJI[meta.category]}</span>}
            {building.name}
          </div>
          <div className="mt-1.5">
            <BuildingBodyHeader id={id} state={state} />
          </div>
        </div>

        {isProduction && <ProductionOperationsSummary state={state} />}
        {isWarehouse && <WarehouseInventorySection state={state} onOpenMaterials={() => navigate('/app/materials')} />}
        {id === 'BLD-SEC' && <SecurityAreaBody state={state} />}
        {id === 'BLD-GATE' && <MainGateBody state={state} />}
        {id === 'BLD-ADMIN' && <AdministrationBody state={state} />}
        {id === 'BLD-UTIL' && <UtilityAreaBody state={state} />}
        {id === 'BLD-LOAD' && <LoadingDispatchBody state={state} />}
        {id === 'BLD-MAINT' && <MaintenanceAreaBody state={state} />}

        {areasInBuilding.length > 0 && (
          <div className="border-t border-[var(--app-border)] pt-3">
            <p className="label mb-2">Production areas</p>
            <ul className="flex flex-col gap-1">
              {areasInBuilding.map((a) => (
                <li key={a.id}>
                  <button
                    className="w-full rounded-sm border border-[var(--app-border)] px-2.5 py-1.5 text-left text-[12px] hover:border-[var(--app-accent-border)]"
                    onClick={() => onSelect('area', a.id)}
                  >
                    {a.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  )
}

/**
 * The Digital Twin's Warehouse info panel gets the same live inventory
 * read Materials & Logistics shows — health, stock, category breakdown
 * and the logical zones the module filters by — so clicking the physical
 * warehouse in the 3D scene is a real entry point into the material
 * intelligence system, not just a static building card.
 */
function WarehouseInventorySection({ state, onOpenMaterials }: { state: SimulationState; onOpenMaterials: () => void }) {
  const { materials, suppliers, inboundShipments, outboundShipments } = state.materials
  const summary = summarizeInventory(materials)
  const capacity = materials.reduce((a, m) => a + m.capacity, 0)
  const used = materials.reduce((a, m) => a + m.stockLevel, 0)
  const storagePct = capacity > 0 ? (used / capacity) * 100 : 0

  const categories = ['Raw Material', 'Component', 'Packaging', 'Consumable'] as const
  const totalValue = materials.reduce((a, m) => a + m.stockLevel * m.unitValue, 0)

  return (
    <div className="border-t border-[var(--app-border)] pt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="label">Warehouse — Main Facility</p>
        <button onClick={onOpenMaterials} className="text-[10.5px] font-bold" style={{ color: 'var(--app-info)' }}>
          OPEN MATERIALS →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Inventory Health" value={summary.healthPct.toFixed(0)} unit="%" tone={summary.critical + summary.outOfStock > 0 ? 'crit' : summary.low > 0 ? 'warn' : 'ok'} description="Share of materials that are healthy or overstock, not requiring procurement." />
        <KpiTile label="Total Stock" value={Math.round(used).toLocaleString()} unit="units" description="Sum of on-hand stock across every material in the warehouse." />
        <KpiTile label="Low Stock" value={summary.low} tone={summary.low > 0 ? 'warn' : 'ok'} description="Materials at or below their reorder point." />
        <KpiTile label="Critical" value={summary.critical + summary.outOfStock} tone={summary.critical + summary.outOfStock > 0 ? 'crit' : 'ok'} description="Materials critically low or fully out of stock." />
      </div>

      <div className="mt-2">
        <div className="flex items-baseline justify-between">
          <span className="label">Storage Capacity</span>
          <span className="tnum text-[12px] font-medium">{storagePct.toFixed(0)}%</span>
        </div>
        <div className="mt-1.5">
          <Meter value={storagePct} max={100} tone={storagePct > 90 ? 'var(--app-warning)' : 'var(--app-success)'} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
        <span>Inbound: {inboundShipments.filter((s) => s.status !== 'arrived').length} shipments</span>
        <span>Outbound: {outboundShipments.length} shipments</span>
        <span>Inventory value: ${(totalValue / 1_000_000).toFixed(2)}M</span>
        <span>Suppliers: {suppliers.length}</span>
      </div>

      <div className="mt-3">
        <p className="label mb-2">Inventory Breakdown</p>
        <div className="flex flex-col gap-1.5">
          {categories.map((cat) => {
            const inCat = materials.filter((m) => m.category === cat)
            const value = inCat.reduce((a, m) => a + m.stockLevel * m.unitValue, 0)
            const pct = totalValue > 0 ? (value / totalValue) * 100 : 0
            return (
              <div key={cat} className="flex items-center gap-2">
                <span className="w-24 flex-shrink-0 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
                  {cat}
                </span>
                <div className="flex-1">
                  <Meter value={pct} max={100} tone="var(--app-accent)" />
                </div>
                <span className="tnum w-9 flex-shrink-0 text-right text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
                  {pct.toFixed(0)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3">
        <p className="label mb-2">Warehouse Zones</p>
        <div className="grid grid-cols-2 gap-1.5">
          {['Zone A', 'Zone B', 'Zone C', 'Zone D'].map((zone) => {
            const inZone = materials.filter((m) => m.warehouseZone === zone)
            const cap = inZone.reduce((a, m) => a + m.capacity, 0)
            const stk = inZone.reduce((a, m) => a + m.stockLevel, 0)
            const pct = cap > 0 ? (stk / cap) * 100 : 0
            const worst = inZone.reduce<string>((acc, m) => {
              const s = materialStatus(m)
              if (s === 'critical' || s === 'out_of_stock') return 'critical'
              if (s === 'low' && acc !== 'critical') return 'low'
              return acc
            }, 'healthy')
            return (
              <div key={zone} className="rounded-sm px-2 py-1.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold">{zone}</span>
                  <span className="text-[10px]" style={{ color: STATUS_COLOR[worst as keyof typeof STATUS_COLOR] }}>
                    {worst === 'critical' ? '🔴' : worst === 'low' ? '⚠' : '●'}
                  </span>
                </div>
                <span className="text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
                  {inZone[0]?.category ?? '—'} · {pct.toFixed(0)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ area - */

function AreaPanel({ id, state, onSelect }: { id: string; state: SimulationState; onSelect: (k: 'line', id: string) => void }) {
  const layout = areaLayoutById(id)
  const area = state.areas.find((a) => a.id === id)
  if (!layout || !area) return null

  const lines = state.lines.filter((l) => l.areaId === id)
  const equipmentIds = lines.flatMap((l) => l.equipmentIds)
  const equipment = equipmentIds.map((eid) => state.equipment[eid]).filter(Boolean)
  const avgHealth = equipment.length ? equipment.reduce((a, e) => a + e.health, 0) / equipment.length : 0

  return (
    <Panel label="Production Area" action={<span className="label">{id}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div className="text-[15px] font-semibold">{area.name}</div>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Lines" value={lines.length} description="Production lines located in this area." />
          <KpiTile label="Equipment" value={equipment.length} description="Total equipment units across this area's lines." />
          <KpiTile label="Avg Health" value={avgHealth.toFixed(0)} unit="/ 100" description="Average health score across all equipment in this area." />
          <KpiTile
            label="Warning / Critical"
            value={equipment.filter((e) => e.status === 'warning' || e.status === 'critical').length}
            tone={equipment.some((e) => e.status === 'critical') ? 'crit' : equipment.some((e) => e.status === 'warning') ? 'warn' : 'ok'}
            description="Equipment in this area currently outside normal operating range."
          />
        </div>

        <div className="border-t border-[var(--app-border)] pt-3">
          <p className="label mb-2">Production lines</p>
          <ul className="flex flex-col gap-1.5">
            {lines.map((l) => (
              <li key={l.id}>
                <button
                  className="flex w-full items-center justify-between gap-2 rounded-sm border border-[var(--app-border)] px-2.5 py-1.5 text-left hover:border-[var(--app-accent-border)]"
                  onClick={() => onSelect('line', l.id)}
                >
                  <span className="truncate text-[12px]">{l.name}</span>
                  <StateChip status={l.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ line - */

function LinePanel({ id, state, onSelect }: { id: string; state: SimulationState; onSelect: (k: 'equipment', id: string) => void }) {
  const navigate = useNavigate()
  const layout = lineLayoutById(id)
  const line = state.lines.find((l) => l.id === id)
  if (!layout || !line) return null

  const equipment = line.equipmentIds.map((eid) => state.equipment[eid]).filter(Boolean)
  // The bottleneck read is the weakest link on the line, not a canned
  // sentence — whichever unit has the lowest health is the one actually
  // dragging performance down.
  const bottleneck = [...equipment].sort((a, b) => a.health - b.health)[0]
  const oeePct = (line.availabilityPct / 100) * (line.performancePct / 100) * (line.qualityPct / 100) * 100
  const belowBaseline = 100 - line.performancePct

  return (
    <Panel label="Production Line" action={<StateChip status={line.status} />}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div className="text-[15px] font-semibold">{line.name}</div>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile
            label="Output"
            value={Math.round(line.outputUnits).toLocaleString()}
            unit={`/ ${line.targetUnits.toLocaleString()}`}
            description="Units produced on this line this session, against its shift target."
          />
          <KpiTile label="Availability" value={line.availabilityPct.toFixed(0)} unit="%" description="Share of scheduled time this line was available to run." />
          <KpiTile label="Performance" value={line.performancePct.toFixed(0)} unit="%" description="This line's actual cycle rate versus its ideal cycle rate." />
          <KpiTile label="Quality" value={line.qualityPct.toFixed(1)} unit="%" description="Share of output from this line meeting quality specification." />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">Downtime</span>
            <span className="tnum text-[12px]">{line.downtimeMinutes.toFixed(1)} min</span>
          </div>
        </div>

        <div className="border-t border-[var(--app-border)] pt-3">
          <p className="label mb-2">Equipment on this line</p>
          <ul className="flex flex-col gap-1.5">
            {equipment.map((e) => (
              <li key={e.id}>
                <button
                  className="flex w-full items-center justify-between gap-2 rounded-sm border border-[var(--app-border)] px-2.5 py-1.5 text-left hover:border-[var(--app-accent-border)]"
                  onClick={() => onSelect('equipment', e.id)}
                >
                  <span className="truncate font-[family-name:var(--font-mono)] text-[11px] text-[var(--app-accent)]">{e.id}</span>
                  <StateChip status={e.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {belowBaseline > 5 && (
          <div className="border-t border-[var(--app-border)] pt-3">
            <p className="label mb-2">🤖 AI Analysis</p>
            <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: 'var(--app-advisory-panel)', color: '#fef9ef' }}>
              <p className="text-[11.5px] leading-relaxed">
                {line.name} is operating {belowBaseline.toFixed(1)}% below its ideal cycle rate.
                {bottleneck && (
                  <>
                    {' '}
                    Potential bottleneck: <b>{bottleneck.name}</b>, currently at {bottleneck.health.toFixed(0)}/100 health.
                  </>
                )}
              </p>
            </div>
            {bottleneck && (
              <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                Confidence: {Math.min(95, Math.round(60 + (100 - bottleneck.health) * 0.4))}% — based on this unit having the lowest health score among {line.name}'s equipment.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => navigate('/app/operations')}
            className="flex-1 rounded-sm py-1.5 text-[11px] font-bold"
            style={{ background: 'var(--app-accent-bg)', color: 'var(--app-accent)', border: '1px solid var(--app-accent-border)' }}
          >
            INVESTIGATE
          </button>
          <button onClick={() => navigate('/app/security')} className="flex-1 rounded-sm py-1.5 text-[11px] font-semibold" style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
            VIEW CCTV
          </button>
        </div>

        <p className="tnum text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
          OEE {oeePct.toFixed(1)}%
        </p>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------ equipment - */

/** Standard preventive-maintenance interval this facility plans equipment around — the single number "last serviced" and "next due" both derive from. */
const MAINTENANCE_CYCLE_DAYS = 90

function EquipmentPanel({ id, state, onBack }: { id: string; state: SimulationState; onBack: () => void }) {
  const navigate = useNavigate()
  const eq = state.equipment[id]
  const history = useEquipmentHistory(id)
  const alert = state.attention.find((a) => a.equipmentId === id)
  if (!eq) return null

  const line = state.lines.find((l) => l.id === eq.lineId)

  const DAY_MS = 86_400_000
  const nextMaintenance = new Date(Date.now() + eq.maintenanceDueInDays * DAY_MS)
  const lastMaintenance = new Date(Date.now() - (MAINTENANCE_CYCLE_DAYS - eq.maintenanceDueInDays) * DAY_MS)

  // Read the same recent vibration window a maintenance planner would —
  // rising vibration against a flat/falling baseline is the textbook early
  // sign of bearing or alignment wear, so that's what the prediction is fit to.
  const recentVibration = history.slice(-24).map((h) => h.vibrationMmS)
  const vibrationRising = recentVibration.length >= 4 && recentVibration.at(-1)! > recentVibration[0] * 1.05
  const maintenanceRiskPct = Math.min(95, Math.max(5, Math.round((eq.vibrationMmS / 5) * 60 + (100 - eq.health) * 0.35)))

  return (
    <Panel label="Equipment" action={<StateChip status={eq.status} />}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--app-accent)]">{eq.id}</div>
          <div className="text-[15px] font-semibold">{eq.name}</div>
          <div className="label mt-0.5">{line?.name ?? eq.lineId}</div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">Health</span>
            <span className="tnum text-[13px] font-medium">{eq.health.toFixed(1)} / 100</span>
          </div>
          <div className="mt-1.5">
            <Meter value={eq.health} max={100} tone={eq.health < 75 ? 'var(--app-warning)' : 'var(--app-success)'} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile
            label="Temperature"
            value={eq.temperatureC.toFixed(1)}
            unit="°C"
            tone={eq.temperatureC > 90 ? 'crit' : eq.temperatureC > 80 ? 'warn' : 'neutral'}
            description="Surface temperature reading. Warning above 80°C, critical above 90°C."
          />
          <KpiTile
            label="Vibration"
            value={eq.vibrationMmS.toFixed(2)}
            unit="mm/s"
            tone={eq.vibrationMmS > 5 ? 'crit' : eq.vibrationMmS > 3 ? 'warn' : 'neutral'}
            description="Vibration velocity. Warning above 3 mm/s, critical above 5 mm/s — an early indicator of bearing or alignment wear."
          />
          <KpiTile label="Power" value={eq.powerKw.toFixed(1)} unit="kW" description="Instantaneous power draw of this unit." />
          <KpiTile label="Speed" value={Math.round(eq.speedRpm)} unit="RPM" description="Current rotational or cycle speed." />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Operating Hours" value={Math.round(eq.operatingHours).toLocaleString()} unit="h" description="Cumulative run time since commissioning." />
          <KpiTile
            label="Maintenance"
            value={eq.status === 'maintenance' ? 'In progress' : eq.maintenanceDueInDays <= 0 ? 'Overdue' : `${eq.maintenanceDueInDays}d`}
            tone={eq.status === 'maintenance' ? 'neutral' : eq.maintenanceDueInDays <= 0 ? 'crit' : eq.maintenanceDueInDays < 10 ? 'warn' : 'neutral'}
            description="Time until the next scheduled maintenance window for this unit."
          />
          <KpiTile
            label="Last Maintenance"
            value={lastMaintenance.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            description={`Derived from the standard ${MAINTENANCE_CYCLE_DAYS}-day preventive cycle this facility plans around.`}
          />
          <KpiTile
            label="Next Maintenance"
            value={nextMaintenance.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            tone={eq.maintenanceDueInDays <= 0 ? 'crit' : eq.maintenanceDueInDays < 10 ? 'warn' : 'neutral'}
            description="Scheduled date for this unit's next maintenance window."
          />
        </div>

        <KpiTile
          label="Performance Contribution"
          value={eq.loadPct.toFixed(0)}
          unit="% load"
          sub="of target line throughput"
          description="This unit's current load as a share of its target — how hard it's working right now."
        />

        {alert && (
          <div className="border-l-2 px-3 py-2" style={{ borderColor: 'var(--app-warning)', background: 'var(--app-warning-bg)' }}>
            <div className="label" style={{ color: 'var(--app-warning)' }}>
              Alert
            </div>
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--app-text)' }}>
              {alert.reason}
            </p>
          </div>
        )}

        <div id={`sensor-history-${eq.id}`} className="border-t border-[var(--app-border)] pt-1">
          <p className="label mb-1 px-0.5">Sensor History — Last 4h</p>
          <div className="grid grid-cols-1 divide-y divide-[var(--app-border)]">
            <TrendChart
              label="Temperature"
              unit="°C"
              data={history.map((h) => h.temperatureC)}
              pointLabels={history.map((h) => h.label)}
              xAxisCaption="time (last 4h)"
              xAxisStart={history[0]?.label ?? '−4h'}
              color="var(--app-warning)"
              height={72}
              threshold={KPI_THRESHOLDS.temperature}
            />
            <TrendChart
              label="Vibration"
              unit="mm/s"
              data={history.map((h) => h.vibrationMmS)}
              pointLabels={history.map((h) => h.label)}
              xAxisCaption="time (last 4h)"
              xAxisStart={history[0]?.label ?? '−4h'}
              color="var(--app-danger)"
              height={72}
              formatter={(v) => v.toFixed(2)}
              threshold={KPI_THRESHOLDS.vibration}
            />
            <TrendChart
              label="Power"
              unit="kW"
              data={history.map((h) => h.powerKw)}
              pointLabels={history.map((h) => h.label)}
              xAxisCaption="time (last 4h)"
              xAxisStart={history[0]?.label ?? '−4h'}
              color="var(--app-accent)"
              height={72}
            />
            <TrendChart
              label="Health"
              unit="/ 100"
              data={history.map((h) => h.health)}
              pointLabels={history.map((h) => h.label)}
              xAxisCaption="time (last 4h)"
              xAxisStart={history[0]?.label ?? '−4h'}
              color="var(--app-success)"
              height={72}
              threshold={KPI_THRESHOLDS.equipmentHealth}
            />
          </div>
        </div>

        <div className="border-t border-[var(--app-border)] pt-3">
          <p className="label mb-2">🤖 AI Prediction</p>
          <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: 'var(--app-advisory-panel)', color: '#fef9ef' }}>
            <p className="text-[11.5px] leading-relaxed">
              {vibrationRising
                ? 'Vibration is trending above the normal operating baseline.'
                : eq.vibrationMmS > 3
                  ? 'Vibration is currently elevated but has not trended upward over the last 24 readings.'
                  : 'Vibration is within its normal operating baseline — no early wear signal detected.'}
            </p>
          </div>
          <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            Probability of maintenance requirement: {maintenanceRiskPct}%
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/app/maintenance?attn=${encodeURIComponent(eq.id)}`)}
            className="flex-1 rounded-sm py-1.5 text-[11px] font-bold"
            style={{ background: 'var(--app-accent-bg)', color: 'var(--app-accent)', border: '1px solid var(--app-accent-border)' }}
          >
            VIEW MAINTENANCE
          </button>
          <button
            onClick={() => document.getElementById(`sensor-history-${eq.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex-1 rounded-sm py-1.5 text-[11px] font-semibold"
            style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
          >
            VIEW SENSOR DATA
          </button>
        </div>

        <button className="app-btn h-9 text-[12px]" onClick={onBack}>
          ← Clear selection
        </button>
      </div>
    </Panel>
  )
}
