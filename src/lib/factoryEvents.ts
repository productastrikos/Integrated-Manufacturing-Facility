import type { SimulationState } from '../simulation/types'
import { sparePartForEquipment, sparePartStatus } from './spareParts'
import { materialStatus, stockCoverDays } from './materialsIntelligence'
import type { UtilityKey } from './utilityInfo'
import { UTILITY_INFO } from './utilityInfo'

/**
 * The cross-module event engine.
 *
 * One thing changes in the factory — an asset fails, a material runs out, a
 * supplier slips — and the consequence is never confined to one module.
 * This file is where that propagation is written down once: given the live
 * factory state and an event, it derives what happens to production, OEE,
 * maintenance, spare parts, inventory, quality, utilities and the twin.
 *
 * It is deliberately a pure derivation over `SimulationState`. It never
 * mutates the live state and holds no state of its own, so the same
 * function can answer "what is this failure doing right now" for the
 * dashboards and "what would this failure do" for a simulation scenario,
 * and the two can never drift apart.
 */

export type ImpactModule =
  | 'twin'
  | 'production'
  | 'equipment'
  | 'maintenance'
  | 'materials'
  | 'quality'
  | 'utilities'
  | 'workforce'
  | 'safety'
  | 'security'

export const MODULE_LABEL: Record<ImpactModule, string> = {
  twin: 'Digital Twin',
  production: 'Production & Operations',
  equipment: 'Equipment',
  maintenance: 'Maintenance',
  materials: 'Materials & Logistics',
  quality: 'Quality',
  utilities: 'Utilities & BMS',
  workforce: 'Workforce',
  safety: 'Safety',
  security: 'Security',
}

export type ImpactSeverity = 'info' | 'warning' | 'critical'

/** One module's share of a single event's consequences. */
export type Impact = {
  module: ImpactModule
  headline: string
  detail: string
  severity: ImpactSeverity
  /** Present when the event moves a number the module actually publishes. */
  kpi?: { label: string; before: string; after: string }
  link?: { to: string; label: string }
}

export type FactoryEvent =
  | { type: 'EQUIPMENT_FAILURE'; equipmentId: string; downtimeHours: number }
  | { type: 'MATERIAL_SHORTAGE'; materialId: string }
  | { type: 'SUPPLIER_DELAY'; supplierId: string; delayDays: number }
  | { type: 'UTILITY_FAILURE'; utility: UtilityKey }
  | { type: 'PRODUCTION_TARGET_CHANGE'; deltaPct: number }

/**
 * A full cascade, shaped around the four questions an operator actually
 * asks — the same structure Sia answers in, so an event explained here and
 * an event explained by the assistant read identically.
 */
export type EventCascade = {
  title: string
  /** One-line statement of the triggering change. */
  summary: string
  impacts: Impact[]
  whatIsHappening: string
  whyIsItHappening: string
  whatWillHappenNext: string
  whatShouldWeDo: string
}

/* ------------------------------------------------------- shared reads -- */

/** Nominal shift length used to turn a planned unit target into a planned rate. */
const SHIFT_MINUTES = 8 * 60

/**
 * Units/min attributable to a single line, apportioned from the measured
 * site rate by that line's share of planned capacity, plus the basis that
 * figure came from.
 *
 * Capacity (targetUnits) is the right basis for the split rather than
 * accumulated outputUnits: output only accrues while a line is actually
 * producing, so a line that has been idle or degraded carries almost none
 * of it and would apportion to ~0 units/min — reporting "0 units forgone"
 * for a line that demonstrably does produce when it runs.
 */
export function lineRatePerMin(state: SimulationState, lineId: string): { rate: number; basis: 'measured' | 'planned' } {
  const line = state.lines.find((l) => l.id === lineId)
  if (!line) return { rate: 0, basis: 'planned' }

  // Apportion across the lines actually contributing to the site rate —
  // dividing by every line, including stopped ones, would under-state each
  // running line's true share.
  const producing = state.lines.filter((l) => l.status === 'running' || l.status === 'warning')
  const pool = producing.some((l) => l.id === lineId) ? producing : state.lines
  const totalCapacity = pool.reduce((a, l) => a + l.targetUnits, 0)
  const share = totalCapacity > 0 ? line.targetUnits / totalCapacity : 1 / Math.max(1, pool.length)

  // The rolling history buffer is per-session and starts empty, and on the
  // very first tick there is no elapsed time to average over either. Rather
  // than reporting a measured rate of zero — and with it a meaningless "0
  // units forgone" — fall back to the line's planned rate and say so.
  const last = state.history[state.history.length - 1]
  if (last?.productionRatePerMin) return { rate: last.productionRatePerMin * share, basis: 'measured' }
  if (state.tick > 0 && state.kpis.outputUnits > 0) {
    return { rate: (state.kpis.outputUnits / state.tick) * 60 * share, basis: 'measured' }
  }
  return { rate: line.targetUnits / SHIFT_MINUTES, basis: 'planned' }
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/* --------------------------------------------------- equipment failure -- */

function equipmentFailureCascade(state: SimulationState, equipmentId: string, downtimeHours: number): EventCascade {
  const eq = state.equipment[equipmentId]
  if (!eq) {
    return {
      title: 'Unknown asset',
      summary: `No asset ${equipmentId} exists in this facility.`,
      impacts: [],
      whatIsHappening: '—',
      whyIsItHappening: '—',
      whatWillHappenNext: '—',
      whatShouldWeDo: '—',
    }
  }

  const line = state.lines.find((l) => l.id === eq.lineId)
  const area = line ? state.areas.find((a) => a.id === line.areaId) : null
  const lineEquipment = Object.values(state.equipment).filter((e) => e.lineId === eq.lineId)
  const lineRunning = lineEquipment.filter((e) => e.status === 'running').length
  // An asset on a line that is already stopped or in maintenance costs no
  // *additional* production — the honest answer is "nothing more is lost",
  // not a fabricated loss measured against a line that wasn't producing.
  const lineWasProducing = !!line && (line.status === 'running' || line.status === 'warning')

  // Availability moves in proportion to the running assets this failure
  // removes, scaled off the engine's own published availability. Deriving
  // an absolute figure from equipment counts instead would be a second,
  // differently-based number — it would read as a drop even when nothing
  // actually stopped.
  const availBefore = state.kpis.oeeAvailabilityPct
  const runningAfter = Math.max(0, state.kpis.equipmentRunning - lineRunning)
  const availAfter = state.kpis.equipmentRunning > 0 ? availBefore * (runningAfter / state.kpis.equipmentRunning) : availBefore
  const oeeBefore = state.kpis.oeePct
  const oeeAfter = (availAfter / 100) * (state.kpis.oeePerformancePct / 100) * (state.kpis.oeeQualityPct / 100) * 100

  const rateRead = line ? lineRatePerMin(state, line.id) : { rate: 0, basis: 'planned' as const }
  const ratePerMin = rateRead.rate
  const rateWord = rateRead.basis === 'measured' ? 'is running at' : 'is planned at'
  const unitsLost = ratePerMin * 60 * downtimeHours

  const symptom = eq.scripted === 'drift-vibration' ? 'vibration' : eq.scripted === 'drift-temperature' ? 'temperature' : null
  const part = sparePartForEquipment(eq.id, symptom)
  const partState = sparePartStatus(part)

  // Materials that feed this line stop being consumed while it is down —
  // a genuine (positive) inventory consequence rather than an assumed one.
  const fedMaterials = state.materials.materials.filter((m) => line && m.productionLines.includes(line.id))
  const criticalFed = fedMaterials.filter((m) => {
    const s = materialStatus(m)
    return s === 'low' || s === 'critical' || s === 'out_of_stock'
  })

  const reason =
    symptom === 'vibration'
      ? `vibration at ${eq.vibrationMmS.toFixed(2)} mm/s`
      : symptom === 'temperature'
        ? `temperature at ${eq.temperatureC.toFixed(1)} °C`
        : `health at ${eq.health.toFixed(0)}/100`

  const impacts: Impact[] = [
    {
      module: 'twin',
      headline: `${eq.id} shows OFFLINE in the 3D facility`,
      detail: `${eq.name} sits on ${line?.name ?? eq.lineId}${area ? ` in ${area.name}` : ''}. The asset, its line and the area around it carry the fault state in the twin.`,
      severity: 'critical',
      link: { to: `/app/digital-twin?focus=equipment:${eq.id}`, label: 'LOCATE IN TWIN' },
    },
    {
      module: 'equipment',
      headline: `${eq.id} moves to CRITICAL / offline`,
      detail: `Currently ${eq.status}, ${reason}, ${eq.operatingHours.toFixed(0)} operating hours logged. ${
        lineRunning > 0 ? `${lineRunning} running asset${lineRunning === 1 ? '' : 's'} on this line stop with it.` : 'No other asset on this line is running, so nothing else stops with it.'
      }`,
      severity: 'critical',
      kpi: { label: 'Equipment running', before: `${state.kpis.equipmentRunning}/${state.kpis.equipmentTotal}`, after: `${runningAfter}/${state.kpis.equipmentTotal}` },
      link: { to: '/app/maintenance', label: 'OPEN EQUIPMENT' },
    },
    {
      module: 'production',
      headline: !line ? 'No line affected' : lineWasProducing ? `${line.name} stops` : `${line.name} is already down`,
      detail: !line
        ? 'The asset is not currently mapped to a production line.'
        : lineWasProducing
          ? `${line.name} ${rateWord} ${fmt(ratePerMin, 1)} units/min. Held down for ${downtimeHours}h it forgoes roughly ${Math.round(unitsLost).toLocaleString()} units and adds ${(downtimeHours * 60).toFixed(0)} minutes of downtime.`
          : `${line.name} is already ${line.status}, so this failure costs no additional output. It does extend the line's return to service by the ${downtimeHours}h repair.`,
      severity: lineWasProducing ? 'critical' : 'info',
      kpi: lineWasProducing
        ? { label: 'Lines running', before: `${state.kpis.linesRunning}/${state.kpis.linesTotal}`, after: `${Math.max(0, state.kpis.linesRunning - 1)}/${state.kpis.linesTotal}` }
        : undefined,
      link: { to: '/app/operations', label: 'OPEN PRODUCTION' },
    },
    {
      module: 'production',
      headline: lineRunning > 0 ? `OEE falls ${fmt(oeeBefore - oeeAfter, 1)} points` : 'OEE is unchanged',
      detail:
        lineRunning > 0
          ? `Availability carries the whole loss, ${fmt(availBefore, 1)}% → ${fmt(availAfter, 1)}%. Performance (${fmt(state.kpis.oeePerformancePct, 1)}%) and quality (${fmt(state.kpis.oeeQualityPct, 1)}%) are unchanged by an asset being offline.`
          : `No running asset is removed, so availability stays at ${fmt(availBefore, 1)}% and OEE holds at ${fmt(oeeBefore, 1)}%.`,
      severity: lineRunning > 0 ? 'warning' : 'info',
      kpi: lineRunning > 0 ? { label: 'OEE', before: `${fmt(oeeBefore, 1)}%`, after: `${fmt(oeeAfter, 1)}%` } : undefined,
    },
    {
      module: 'maintenance',
      headline: 'Corrective work order required',
      detail: `A corrective order opens against ${eq.id}. Preventive maintenance was due in ${eq.maintenanceDueInDays} day${eq.maintenanceDueInDays === 1 ? '' : 's'}, so this pulls that window forward.`,
      severity: 'warning',
      link: { to: `/app/maintenance?attn=${eq.id}`, label: 'OPEN MAINTENANCE' },
    },
    {
      module: 'materials',
      headline:
        partState === 'out'
          ? `${part.name} is out of stock`
          : partState === 'low'
            ? `${part.name} is at reorder level`
            : `${part.name} is available`,
      detail: `Repair needs ${part.id} — ${part.name}. On hand ${part.onHand}, reorder at ${part.reorderAt}.${
        partState === 'ok' ? ' Stock covers this repair.' : ' Replenishment should be raised alongside the work order.'
      }`,
      severity: partState === 'out' ? 'critical' : partState === 'low' ? 'warning' : 'info',
      link: { to: '/app/materials', label: 'OPEN MATERIALS' },
    },
    {
      module: 'workforce',
      headline: line ? `Crew assigned to ${line.name} is idled` : 'Assigned crew is idled',
      detail: `The operators staffing ${line?.name ?? 'this line'} have no line to run for ${downtimeHours}h and are available for reassignment to the lines still up.`,
      severity: 'warning',
      link: { to: '/app/operations', label: 'OPEN PRODUCTION' },
    },
    {
      module: 'quality',
      headline: 'Output already produced is flagged for inspection',
      detail: `${line?.name ?? 'The line'} was last running at ${fmt(line?.qualityPct ?? state.kpis.oeeQualityPct, 1)}% quality. Units produced while ${eq.id} was degrading should be inspected before dispatch.`,
      severity: 'warning',
      link: { to: '/app/quality', label: 'OPEN QUALITY' },
    },
    {
      module: 'utilities',
      headline: `Site demand drops ${fmt(eq.powerKw / 1000, 2)} MW`,
      detail: `${eq.id} draws ${eq.powerKw.toFixed(0)} kW. With the line down, site demand falls from ${fmt(state.energy.currentDemandMw, 2)} MW — but energy per unit produced worsens, because the fixed building load stays on with no output against it.`,
      severity: 'info',
      link: { to: '/app/bms', label: 'OPEN UTILITIES' },
    },
  ]

  if (criticalFed.length > 0) {
    impacts.push({
      module: 'materials',
      headline: `${criticalFed.length} constrained material${criticalFed.length === 1 ? '' : 's'} gets breathing room`,
      detail: `${criticalFed.map((m) => `${m.name} (${stockCoverDays(m).toFixed(1)}d cover)`).join(', ')} feed${criticalFed.length === 1 ? 's' : ''} this line. Consumption pauses while it is down, extending cover.`,
      severity: 'info',
      link: { to: '/app/materials', label: 'OPEN MATERIALS' },
    })
  }

  return {
    title: `${eq.id} — ${eq.name}`,
    summary: `${eq.id} fails on ${line?.name ?? eq.lineId} and is held down for ${downtimeHours}h.`,
    impacts,
    whatIsHappening: lineWasProducing
      ? `${eq.id} (${eq.name}) on ${line?.name ?? eq.lineId} goes offline, taking ${lineRunning} running asset${lineRunning === 1 ? '' : 's'} and the line with it.`
      : `${eq.id} (${eq.name}) fails on ${line?.name ?? eq.lineId}, which is already ${line?.status ?? 'not running'}.`,
    whyIsItHappening: `The asset is reading ${reason}${symptom ? ', a developing fault rather than a sudden one' : ''}. Preventive maintenance was ${eq.maintenanceDueInDays <= 0 ? 'already overdue' : `due in ${eq.maintenanceDueInDays} days`}.`,
    whatWillHappenNext: lineWasProducing
      ? `Over ${downtimeHours}h the site forgoes roughly ${Math.round(unitsLost).toLocaleString()} units and OEE sits near ${fmt(oeeAfter, 1)}% instead of ${fmt(oeeBefore, 1)}%, held down entirely by availability.`
      : `No additional output is lost — the line was not producing. The ${downtimeHours}h repair pushes out its return to service, and OEE stays near ${fmt(oeeBefore, 1)}%.`,
    whatShouldWeDo:
      partState === 'ok'
        ? `Raise the corrective order against ${eq.id} and draw ${part.id} (${part.onHand} on hand). Reassign the ${line?.name ?? 'line'} crew to running lines and inspect output produced during the degradation.`
        : `Raise the corrective order against ${eq.id}, but ${part.id} is ${partState === 'out' ? 'out of stock' : `down to ${part.onHand} on hand`} — expedite replenishment first or the repair stalls. Reassign the crew and inspect recent output.`,
  }
}

/* --------------------------------------------------- material shortage -- */

function materialShortageCascade(state: SimulationState, materialId: string): EventCascade {
  const m = state.materials.materials.find((x) => x.id === materialId || x.materialCode === materialId)
  if (!m) {
    return {
      title: 'Unknown material',
      summary: `No material ${materialId} is tracked in this facility.`,
      impacts: [],
      whatIsHappening: '—',
      whyIsItHappening: '—',
      whatWillHappenNext: '—',
      whatShouldWeDo: '—',
    }
  }

  const cover = stockCoverDays(m)
  const affectedLines = state.lines.filter((l) => m.productionLines.includes(l.id))
  const supplier = state.materials.suppliers.find((s) => s.id === m.supplierId)
  const inbound = state.materials.inboundShipments.filter((s) => s.materialId === m.id && s.status !== 'arrived')

  const affectedOutput = affectedLines.reduce((a, l) => a + lineRatePerMin(state, l.id).rate, 0)
  const daysToStockout = Number.isFinite(cover) ? cover : Infinity

  const impacts: Impact[] = [
    {
      module: 'materials',
      headline: `${m.name} reaches zero stock`,
      detail: `${Math.round(m.stockLevel).toLocaleString()} ${m.unit} on hand in ${m.warehouseZone}, consumed at ${m.dailyConsumption.toFixed(0)} ${m.unit}/day — ${Number.isFinite(cover) ? `${cover.toFixed(1)} days of cover` : 'no measurable draw'}. Reorder point is ${m.reorderLevel.toLocaleString()}.`,
      severity: 'critical',
      kpi: { label: 'Stock cover', before: Number.isFinite(cover) ? `${cover.toFixed(1)}d` : '—', after: '0.0d' },
      link: { to: `/app/materials?attn=${m.id}`, label: 'OPEN MATERIALS' },
    },
    {
      module: 'twin',
      headline: 'Warehouse flags the material',
      detail: `${m.warehouseZone} carries the shortage in the twin, along with the receiving and dispatch flow feeding it.`,
      severity: 'warning',
      link: { to: '/app/digital-twin?focus=building:BLD-WARE', label: 'LOCATE IN TWIN' },
    },
    {
      module: 'production',
      headline:
        affectedLines.length > 0
          ? `${affectedLines.length} line${affectedLines.length === 1 ? '' : 's'} starve${affectedLines.length === 1 ? 's' : ''}`
          : 'No line is directly fed by this material',
      detail:
        affectedLines.length > 0
          ? `${affectedLines.map((l) => l.name).join(', ')} consume${affectedLines.length === 1 ? 's' : ''} ${m.name}. Together they run ${fmt(affectedOutput, 1)} units/min, so every hour past stockout forgoes about ${Math.round(affectedOutput * 60).toLocaleString()} units.`
          : `${m.name} is not currently mapped to a production line, so the exposure is inventory-side only.`,
      severity: affectedLines.length > 0 ? 'critical' : 'info',
      link: { to: '/app/operations', label: 'OPEN PRODUCTION' },
    },
    {
      module: 'materials',
      headline: supplier ? `${supplier.name} is the replenishment path` : 'No supplier on record',
      detail: supplier
        ? `${supplier.name} runs ${supplier.onTimePct.toFixed(0)}% on-time with a ${m.leadTimeDays}-day lead time and ${supplier.delayedOrders} delayed order${supplier.delayedOrders === 1 ? '' : 's'} open. Ordering must start ${Math.max(0, daysToStockout - m.leadTimeDays).toFixed(1)} days from now to land before stockout.`
        : `Lead time on record is ${m.leadTimeDays} days.`,
      severity: supplier && supplier.delayedOrders > 0 ? 'warning' : 'info',
    },
    {
      module: 'quality',
      headline: 'Substitution risk if the line is kept running',
      detail: `Running ${affectedLines.map((l) => l.name).join(', ') || 'the line'} on a substitute or part-lot of ${m.name} changes the input spec — any such output needs inspection before it counts as good.`,
      severity: 'warning',
      link: { to: '/app/quality', label: 'OPEN QUALITY' },
    },
  ]

  if (inbound.length > 0) {
    impacts.push({
      module: 'materials',
      headline: `${inbound.length} inbound shipment${inbound.length === 1 ? '' : 's'} already in flight`,
      detail: inbound.map((s) => `${s.truck} → ${s.gate}, ${s.quantity.toLocaleString()} ${s.unit}, ${s.status === 'delayed' ? 'DELAYED' : s.etaLabel}`).join(' · '),
      severity: inbound.some((s) => s.status === 'delayed') ? 'warning' : 'info',
    })
  }

  return {
    title: `${m.name} (${m.materialCode})`,
    summary: `${m.name} runs out in ${m.warehouseZone}.`,
    impacts,
    whatIsHappening: `${m.name} is down to ${Math.round(m.stockLevel).toLocaleString()} ${m.unit} in ${m.warehouseZone}${Number.isFinite(cover) ? `, ${cover.toFixed(1)} days of cover at current draw` : ''}.`,
    whyIsItHappening: `Consumption is ${m.dailyConsumption.toFixed(0)} ${m.unit}/day against a ${m.reorderLevel.toLocaleString()} reorder point${supplier ? `, and ${supplier.name} has ${supplier.delayedOrders} delayed order${supplier.delayedOrders === 1 ? '' : 's'} open` : ''}.`,
    whatWillHappenNext:
      affectedLines.length > 0
        ? `At stockout, ${affectedLines.map((l) => l.name).join(', ')} stop — about ${Math.round(affectedOutput * 60).toLocaleString()} units forgone per hour.`
        : 'No production line stops directly; the exposure stays inventory-side.',
    whatShouldWeDo: `Raise a purchase order now — with a ${m.leadTimeDays}-day lead time, ordering later than ${Math.max(0, daysToStockout - m.leadTimeDays).toFixed(1)} days from now lands after the line is already down.${inbound.length > 0 ? ' Confirm the shipments already in flight first.' : ''}`,
  }
}

/* ---------------------------------------------------- supplier delay -- */

function supplierDelayCascade(state: SimulationState, supplierId: string, delayDays: number): EventCascade {
  const supplier = state.materials.suppliers.find((s) => s.id === supplierId)
  if (!supplier) {
    return {
      title: 'Unknown supplier',
      summary: `No supplier ${supplierId} is on record.`,
      impacts: [],
      whatIsHappening: '—',
      whyIsItHappening: '—',
      whatWillHappenNext: '—',
      whatShouldWeDo: '—',
    }
  }

  const suppliedMaterials = state.materials.materials.filter((m) => m.supplierId === supplier.id)
  // The window a shortage has to survive: the longest lead time this
  // supplier carries, plus the slip. A delay only bites where cover runs
  // out before the delayed delivery lands.
  const deliveryWindow = suppliedMaterials.reduce((a, m) => Math.max(a, m.leadTimeDays), 0) + delayDays
  const exposed = suppliedMaterials
    .map((m) => ({ m, cover: stockCoverDays(m) }))
    .filter(({ cover }) => Number.isFinite(cover) && cover < deliveryWindow)
    .sort((a, b) => a.cover - b.cover)

  const openPOs = state.materials.purchaseOrders.filter((p) => p.supplierId === supplier.id && p.status !== 'received' && p.status !== 'draft')
  const exposedLines = new Set<string>()
  for (const { m } of exposed) for (const l of m.productionLines) exposedLines.add(l)

  const impacts: Impact[] = [
    {
      module: 'materials',
      headline: `${supplier.name} slips ${delayDays} day${delayDays === 1 ? '' : 's'}`,
      detail: `${openPOs.length} open purchase order${openPOs.length === 1 ? '' : 's'} against a ${supplier.avgLeadTimeDays}-day average lead time and ${supplier.onTimePct.toFixed(0)}% on-time record (${supplier.reliability}).`,
      severity: 'warning',
      kpi: { label: 'Effective lead time', before: `${supplier.avgLeadTimeDays}d`, after: `${supplier.avgLeadTimeDays + delayDays}d` },
      link: { to: '/app/materials', label: 'OPEN MATERIALS' },
    },
    {
      module: 'materials',
      headline:
        exposed.length > 0
          ? `${exposed.length} material${exposed.length === 1 ? '' : 's'} run${exposed.length === 1 ? 's' : ''} out before the delivery lands`
          : 'No material runs out inside the delay window',
      detail:
        exposed.length > 0
          ? exposed.map(({ m, cover }) => `${m.name} (${cover.toFixed(1)}d cover)`).join(', ')
          : `Every material this supplier feeds holds more cover than the ${supplier.avgLeadTimeDays + delayDays}-day delayed lead time.`,
      severity: exposed.length > 0 ? 'critical' : 'info',
    },
    {
      module: 'production',
      headline:
        exposedLines.size > 0
          ? `${exposedLines.size} line${exposedLines.size === 1 ? '' : 's'} at risk`
          : 'No production line exposed',
      detail:
        exposedLines.size > 0
          ? `${[...exposedLines].join(', ')} depend on the exposed materials and stop when cover runs out.`
          : 'Nothing on the production floor is exposed inside this delay window.',
      severity: exposedLines.size > 0 ? 'critical' : 'info',
      link: { to: '/app/operations', label: 'OPEN PRODUCTION' },
    },
  ]

  return {
    title: supplier.name,
    summary: `${supplier.name} delivery slips by ${delayDays} day${delayDays === 1 ? '' : 's'}.`,
    impacts,
    whatIsHappening: `${supplier.name} (${supplier.reliability}, ${supplier.onTimePct.toFixed(0)}% on-time) slips ${delayDays} day${delayDays === 1 ? '' : 's'} across ${openPOs.length} open order${openPOs.length === 1 ? '' : 's'}.`,
    whyIsItHappening: `This supplier already carries ${supplier.delayedOrders} delayed order${supplier.delayedOrders === 1 ? '' : 's'} against ${supplier.activeOrders} active.`,
    whatWillHappenNext:
      exposed.length > 0
        ? `${exposed[0].m.name} runs out first at ${exposed[0].cover.toFixed(1)} days of cover, ahead of the ${supplier.avgLeadTimeDays + delayDays}-day delayed lead time.`
        : `Cover holds across every material this supplier feeds — no stockout inside the delay window.`,
    whatShouldWeDo:
      exposed.length > 0
        ? `Expedite or dual-source ${exposed.map(({ m }) => m.name).join(', ')} now, and re-plan the dependent lines against the later delivery date.`
        : `Monitor. Re-check if the delay extends beyond ${supplier.avgLeadTimeDays + delayDays} days.`,
  }
}

/* ---------------------------------------------------- utility failure -- */

function utilityFailureCascade(state: SimulationState, utility: UtilityKey): EventCascade {
  const info = UTILITY_INFO[utility]
  const reading = state.utilities[utility]
  const affectedLines = state.lines.filter((l) => l.status === 'running' || l.status === 'warning')
  const rate = affectedLines.reduce((a, l) => a + lineRatePerMin(state, l.id).rate, 0)

  return {
    title: info.label,
    summary: `${info.label} supply is lost across the site.`,
    impacts: [
      {
        module: 'utilities',
        headline: `${info.label} drops to zero`,
        detail: `Currently ${reading.flow.toFixed(1)} ${reading.flowUnit} at ${reading.pressureBar.toFixed(2)} bar. ${info.description}`,
        severity: 'critical',
        kpi: { label: 'Pressure', before: `${reading.pressureBar.toFixed(2)} bar`, after: '0.00 bar' },
        link: { to: '/app/bms', label: 'OPEN UTILITIES' },
      },
      {
        module: 'production',
        headline: `${affectedLines.length} running line${affectedLines.length === 1 ? '' : 's'} affected`,
        detail: `${info.label} feeds ${info.description.toLowerCase()} Losing it stops dependent processes — about ${Math.round(rate * 60).toLocaleString()} units per hour across the lines currently running.`,
        severity: 'critical',
        link: { to: '/app/operations', label: 'OPEN PRODUCTION' },
      },
      {
        module: 'equipment',
        headline: 'Dependent assets trip or idle',
        detail: `Assets relying on ${info.label.toLowerCase()} cannot hold their operating parameters and will trip rather than run out of spec.`,
        severity: 'warning',
        link: { to: '/app/maintenance', label: 'OPEN EQUIPMENT' },
      },
      {
        module: 'quality',
        headline: 'Output during the excursion is suspect',
        detail: `Anything produced while ${info.label.toLowerCase()} was out of spec should be held for inspection rather than dispatched.`,
        severity: 'warning',
        link: { to: '/app/quality', label: 'OPEN QUALITY' },
      },
      {
        module: 'twin',
        headline: 'Utility area carries the fault',
        detail: 'The utility yard and the zones it feeds show the loss spatially.',
        severity: 'warning',
        link: { to: '/app/digital-twin?focus=building:BLD-UTIL', label: 'LOCATE IN TWIN' },
      },
    ],
    whatIsHappening: `${info.label} supply is lost — was ${reading.flow.toFixed(1)} ${reading.flowUnit} at ${reading.pressureBar.toFixed(2)} bar.`,
    whyIsItHappening: `A supply-side failure in the utility yard. ${info.description}`,
    whatWillHappenNext: `Dependent processes stop; roughly ${Math.round(rate * 60).toLocaleString()} units per hour are forgone while supply is out.`,
    whatShouldWeDo: `Restore ${info.label.toLowerCase()} first — production cannot be recovered ahead of it. Hold output produced during the excursion for inspection.`,
  }
}

/* ---------------------------------------------- production target change -- */

function targetChangeCascade(state: SimulationState, deltaPct: number): EventCascade {
  const { kpis } = state
  const newTarget = kpis.targetUnits * (1 + deltaPct / 100)
  const achievementAfter = newTarget > 0 ? (kpis.outputUnits / newTarget) * 100 : 0
  const last = state.history[state.history.length - 1]
  const siteRate = last?.productionRatePerMin ?? 0
  const extraUnits = newTarget - kpis.targetUnits
  const extraHours = siteRate > 0 ? extraUnits / (siteRate * 60) : Infinity

  return {
    title: `Target ${deltaPct >= 0 ? '+' : ''}${deltaPct}%`,
    summary: `Shift target moves ${deltaPct >= 0 ? 'up' : 'down'} ${Math.abs(deltaPct)}%.`,
    impacts: [
      {
        module: 'production',
        headline: `Target moves to ${Math.round(newTarget).toLocaleString()} units`,
        detail: `Output is ${Math.round(kpis.outputUnits).toLocaleString()} units against the current ${kpis.targetUnits.toLocaleString()}-unit target.`,
        severity: achievementAfter < 70 ? 'critical' : achievementAfter < 90 ? 'warning' : 'info',
        kpi: { label: 'Achievement', before: `${fmt(kpis.achievementPct, 1)}%`, after: `${fmt(achievementAfter, 1)}%` },
        link: { to: '/app/operations', label: 'OPEN PRODUCTION' },
      },
      {
        module: 'production',
        headline: Number.isFinite(extraHours) ? `${fmt(Math.abs(extraHours), 1)}h of additional run time needed` : 'Run time cannot be derived — no measured rate yet',
        detail: `At the current site rate of ${fmt(siteRate, 1)} units/min, closing the ${Math.round(Math.abs(extraUnits)).toLocaleString()}-unit gap takes ${Number.isFinite(extraHours) ? `${fmt(Math.abs(extraHours), 1)} hours` : 'an unknown time'} of additional running.`,
        severity: 'warning',
      },
      {
        module: 'workforce',
        headline: deltaPct > 0 ? 'Additional shift cover required' : 'Shift cover can be relaxed',
        detail: deltaPct > 0 ? 'Meeting the raised target needs either overtime on the current shift or an additional crew.' : 'The lowered target can be met inside current shift cover.',
        severity: deltaPct > 0 ? 'warning' : 'info',
      },
      {
        module: 'materials',
        headline: deltaPct > 0 ? 'Consumption rises with output' : 'Consumption falls with output',
        detail: `A ${Math.abs(deltaPct)}% output change moves material draw with it, shortening stock cover on every material feeding the running lines.`,
        severity: deltaPct > 0 ? 'warning' : 'info',
        link: { to: '/app/materials', label: 'OPEN MATERIALS' },
      },
      {
        module: 'equipment',
        headline: deltaPct > 0 ? 'Assets run closer to rated load' : 'Asset load eases',
        detail: `Pushing output raises load and wear, pulling preventive maintenance windows forward. ${kpis.equipmentWarning} asset${kpis.equipmentWarning === 1 ? ' is' : 's are'} already in warning.`,
        severity: deltaPct > 0 && kpis.equipmentWarning > 0 ? 'warning' : 'info',
        link: { to: '/app/maintenance', label: 'OPEN MAINTENANCE' },
      },
    ],
    whatIsHappening: `The shift target moves from ${kpis.targetUnits.toLocaleString()} to ${Math.round(newTarget).toLocaleString()} units.`,
    whyIsItHappening: 'A planning change, not a fault — nothing on the floor has degraded.',
    whatWillHappenNext: `Achievement reads ${fmt(achievementAfter, 1)}% instead of ${fmt(kpis.achievementPct, 1)}% against the same output.`,
    whatShouldWeDo:
      deltaPct > 0
        ? `Confirm material cover and shift capacity before committing — the raised target needs ${Number.isFinite(extraHours) ? `${fmt(extraHours, 1)}h` : 'more'} of additional running at the current rate.`
        : 'Re-plan material calls and shift cover down to match the lowered target.',
  }
}

/* ---------------------------------------------------------- entry point -- */

/** Derives a full cross-module cascade for an event against the live state. Pure — never mutates. */
export function deriveCascade(state: SimulationState, event: FactoryEvent): EventCascade {
  switch (event.type) {
    case 'EQUIPMENT_FAILURE':
      return equipmentFailureCascade(state, event.equipmentId, event.downtimeHours)
    case 'MATERIAL_SHORTAGE':
      return materialShortageCascade(state, event.materialId)
    case 'SUPPLIER_DELAY':
      return supplierDelayCascade(state, event.supplierId, event.delayDays)
    case 'UTILITY_FAILURE':
      return utilityFailureCascade(state, event.utility)
    case 'PRODUCTION_TARGET_CHANGE':
      return targetChangeCascade(state, event.deltaPct)
  }
}
