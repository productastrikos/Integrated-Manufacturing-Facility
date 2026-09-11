import { SEED_AREAS, SEED_BUILDINGS, SEED_EQUIPMENT, SEED_LINES, SEED_SITE, SITE_TARGET_UNITS } from '../data/seed'
import {
  SEED_BMS_ZONES,
  SEED_CAMERAS,
  SEED_INBOUND_SHIPMENTS,
  SEED_MATERIALS,
  SEED_OUTBOUND_SHIPMENTS,
  SEED_PURCHASE_ORDERS,
  SEED_SUPPLIERS,
  randomAccessDoor,
  randomAccessPerson,
  randomVisitorHost,
} from '../data/seedPhase3'
import { materialStatus, recommendedOrderQty } from '../lib/materialsIntelligence'
import { getCurrentShift, shiftClockLabel, SHIFT_BUCKET_MINUTES } from '../lib/shiftSchedule'
import { SEED_BMS_ASSETS, SEED_FLOORS, SEED_ROOMS, SEED_SAFETY_ASSETS, SEED_VEHICLES } from '../data/seedFacility'
import { SEED_VALUE_CHAIN } from '../data/seedValueChain'
import { SEED_PERSONNEL } from '../data/seedPersonnel'
import { clamp, mulberry32, walkToward } from './rng'
import { THRESHOLDS } from './types'
import type {
  Assignment,
  AssignmentEvent,
  AssignmentStatus,
  AttentionItem,
  BmsAsset,
  BmsZone,
  Department,
  Employee,
  Equipment,
  HealthLogBucket,
  HistoryPoint,
  MaterialsState,
  ProductionLine,
  PurchaseOrder,
  SecurityState,
  ShiftHourBucket,
  SimulationState,
  UtilitiesState,
  ValueChainStage,
  Vehicle,
  VisitorRecord,
} from './types'

const TICK_MS = 1000
const HISTORY_LENGTH = 90 // 90 seconds of trend history

/**
 * Facility Health is one calculated number folding in every operational
 * domain the twin represents — production, equipment condition, safety
 * and security posture — rather than being a stand-in for OEE alone.
 * Kept as a single weighted config so the formula has exactly one home.
 */
const FACILITY_HEALTH_WEIGHTS = {
  oee: 0.32,
  equipmentAvailability: 0.24,
  equipmentHealth: 0.24,
  safetyCompliance: 0.12,
  securityPosture: 0.08,
}

function computeFacilityHealth(
  kpisBase: { oeePct: number; equipmentAvailabilityPct: number; equipmentHealthScore: number },
  safetyExtra: { complianceScorePct: number },
  safetySecurity: { activeSafetyIncidents: number; accessViolations: number; criticalAlerts: number },
): number {
  const w = FACILITY_HEALTH_WEIGHTS
  // Safety posture folds compliance score together with a penalty per open
  // incident/violation, so an otherwise-compliant site with an active
  // incident still shows the dip.
  const safetyPosture = clamp(safetyExtra.complianceScorePct - safetySecurity.activeSafetyIncidents * 8, 0, 100)
  const securityPosture = clamp(100 - safetySecurity.accessViolations * 6 - safetySecurity.criticalAlerts * 4, 0, 100)

  const score =
    w.oee * kpisBase.oeePct +
    w.equipmentAvailability * kpisBase.equipmentAvailabilityPct +
    w.equipmentHealth * kpisBase.equipmentHealthScore +
    w.safetyCompliance * safetyPosture +
    w.securityPosture * securityPosture

  return clamp(score, 0, 100)
}

const rng = mulberry32(9182736)
/** Sequential, ever-increasing so a visitor's number is unique for the life of the session — the 3 seeded visitors take 1-3. */
let visitorSeq = 3
const hhmmss = (d: Date) => d.toTimeString().slice(0, 8)

/* ------------------------------------------------------------ equipment - */

function tickEquipment(eq: Equipment): Equipment {
  // Scripted operational states hold steady — maintenance/idle are modes,
  // not threshold-derived, so they don't drift with load like running gear.
  if (eq.status === 'maintenance') {
    return { ...eq, temperatureC: walkToward(rng, eq.temperatureC, 26, 0.3, 0.1) }
  }
  if (eq.status === 'idle' && !eq.scripted) {
    return {
      ...eq,
      temperatureC: walkToward(rng, eq.temperatureC, 24, 0.3, 0.15),
      vibrationMmS: Math.max(0.1, walkToward(rng, eq.vibrationMmS, 0.4, 0.05, 0.03)),
    }
  }

  // Load wanders gently around its target — this is the driver every other
  // signal responds to, so the relationships (load → power → temp → health)
  // stay causally consistent tick over tick.
  const load = clamp(walkToward(rng, eq.loadPct, eq.targetLoadPct, 3, 1.5), 0, 100)
  const loadFrac = load / 100

  const basePower = eq.type === 'machine' ? 90 : eq.type === 'process-unit' ? 60 : 45
  const power = clamp(basePower * (0.35 + 0.65 * loadFrac) + (rng() - 0.5) * 2, 2, 130)

  // Two demo assets hold a steady temperature in the warning band instead
  // of following the normal load-driven baseline — this is what keeps
  // "equipment requiring attention" populated with more than one issue.
  const baselineTemp = eq.scripted === 'drift-temperature' ? 84 : 38 + loadFrac * 30
  const temperature = walkToward(rng, eq.temperatureC, baselineTemp, 1.2, 0.5)

  // The one demo asset with a slow, controlled upward drift in vibration —
  // this is what feeds the "equipment requiring attention" story end to end.
  const vibrationTarget = eq.scripted === 'drift-vibration' ? 4.6 : 0.7 + loadFrac * 1.4
  const vibrationStep = eq.scripted === 'drift-vibration' ? 0.02 : 0.08
  const vibration = walkToward(rng, eq.vibrationMmS, vibrationTarget, vibrationStep, 0.06)

  const speed = clamp(walkToward(rng, eq.speedRpm, 700 + loadFrac * 1100, 15, 6), 0, 2200)

  // Health responds to whether temperature/vibration sit above their warning
  // bands — this is the causal link the alert engine (Phase 4) will key off.
  const tempStress = temperature > THRESHOLDS.temperatureC.warning ? 1 : 0
  const vibStress = vibration > THRESHOLDS.vibrationMmS.warning ? 1 : 0
  const healthDelta = tempStress || vibStress ? -0.06 * (tempStress + vibStress) : 0.015
  const health = clamp(eq.health + healthDelta + (rng() - 0.5) * 0.15, 20, 100)

  const status: Equipment['status'] =
    temperature > THRESHOLDS.temperatureC.critical || vibration > THRESHOLDS.vibrationMmS.critical
      ? 'critical'
      : temperature > THRESHOLDS.temperatureC.warning || vibration > THRESHOLDS.vibrationMmS.warning
        ? 'warning'
        : load < 3
          ? 'idle'
          : 'running'

  return {
    ...eq,
    loadPct: load,
    powerKw: Math.round(power * 10) / 10,
    temperatureC: Math.round(temperature * 10) / 10,
    vibrationMmS: Math.round(vibration * 100) / 100,
    speedRpm: Math.round(speed),
    health: Math.round(health * 10) / 10,
    operatingHours: eq.operatingHours + TICK_MS / 3_600_000,
    status,
  }
}

/* ------------------------------------------------------------------ line - */

function tickLine(line: ProductionLine, equipment: Record<string, Equipment>): ProductionLine {
  const units = line.equipmentIds.map((id) => equipment[id])

  if (line.scriptedIdle) return { ...line, status: 'idle', availabilityPct: 0, performancePct: 0, qualityPct: 0 }
  if (line.scriptedMaintenance)
    return { ...line, status: 'maintenance', availabilityPct: 0, performancePct: 0, qualityPct: 0 }

  const anyCritical = units.some((u) => u.status === 'critical')
  const anyWarning = units.some((u) => u.status === 'warning')
  const status: ProductionLine['status'] = anyCritical ? 'critical' : anyWarning ? 'warning' : 'running'

  const avgLoad = units.reduce((a, u) => a + u.loadPct, 0) / units.length
  const availability = clamp(walkToward(rng, line.availabilityPct, anyCritical ? 55 : 90 + rng() * 6, 1.5, 0.6), 0, 100)
  const performance = clamp(walkToward(rng, line.performancePct, 70 + (avgLoad / 100) * 25, 1.5, 0.8), 0, 100)
  const quality = clamp(
    walkToward(rng, line.qualityPct, anyCritical ? 90 : 96.5 + rng() * 2.5, 0.6, 0.3),
    0,
    100,
  )

  // Throughput this tick is a function of performance and quality, not a
  // flat rate — a struggling line visibly produces less, not just "less well".
  const nominalPerTick = 0.026 // ~2.3 units/sec across all running lines combined
  const outputGain = status === 'critical' ? 0 : nominalPerTick * (performance / 100) * (quality / 100)
  const downtimeGain = status === 'critical' ? TICK_MS / 60000 : 0

  return {
    ...line,
    status,
    availabilityPct: availability,
    performancePct: performance,
    qualityPct: quality,
    outputUnits: line.outputUnits + outputGain,
    downtimeMinutes: line.downtimeMinutes + downtimeGain,
  }
}

/* -------------------------------------------------------- Phase 3 ticks -- */

function initialUtilities(): UtilitiesState {
  return {
    water: { flow: 18, flowUnit: 'm³/h', pressureBar: 4.2, status: 'Normal' },
    gas: { flow: 240, flowUnit: 'm³/h', pressureBar: 2.1, status: 'Normal' },
    compressedAir: { flow: 620, flowUnit: 'Nm³/h', pressureBar: 6.8, status: 'Normal' },
    steam: { flow: 3.4, flowUnit: 't/h', pressureBar: 8.5, status: 'Normal' },
  }
}

function tickUtilities(prev: UtilitiesState): UtilitiesState {
  const tick = (u: UtilitiesState[keyof UtilitiesState], flowNoise: number, pressureNoise: number) => {
    const flow = Math.max(0, walkToward(rng, u.flow, u.flow, flowNoise, flowNoise * 0.6))
    const pressureBar = Math.max(0, walkToward(rng, u.pressureBar, u.pressureBar, pressureNoise, pressureNoise * 0.5))
    return { ...u, flow: Math.round(flow * 10) / 10, pressureBar: Math.round(pressureBar * 100) / 100, status: 'Normal' as const }
  }
  return {
    water: tick(prev.water, 0.6, 0.08),
    gas: tick(prev.gas, 6, 0.05),
    compressedAir: tick(prev.compressedAir, 12, 0.1),
    steam: tick(prev.steam, 0.15, 0.15),
  }
}

function tickBmsZones(prev: BmsZone[]): BmsZone[] {
  return prev.map((z) => {
    const temperatureC = Math.round(walkToward(rng, z.temperatureC, z.temperatureC, 0.15, 0.08) * 10) / 10
    const humidityPct = Math.round(walkToward(rng, z.humidityPct, z.humidityPct, 0.5, 0.3))
    const co2Ppm = Math.round(walkToward(rng, z.co2Ppm, z.co2Ppm, 8, 5))
    const airQualityIndex = Math.round(walkToward(rng, z.airQualityIndex, z.airQualityIndex, 1, 0.6))
    const coolingLoadPct = clamp(walkToward(rng, z.coolingLoadPct, z.coolingLoadPct, 1.5, 0.8), 5, 100)
    return {
      ...z,
      temperatureC,
      humidityPct,
      co2Ppm,
      airQualityIndex,
      coolingLoadPct: Math.round(coolingLoadPct * 10) / 10,
      status: co2Ppm > 900 || temperatureC > 27 ? 'Attention' : 'Normal',
    }
  })
}

function initialSecurity(): SecurityState {
  const visitorsOnSite: VisitorRecord[] = [
    { id: 'VIS-1', name: 'Visitor 1', checkedInAt: '08:12:00', door: 'Main Gate Entry', zone: 'Main Gate', host: 'Operations' },
    { id: 'VIS-2', name: 'Visitor 2', checkedInAt: '09:47:00', door: 'Main Gate Entry', zone: 'Main Gate', host: 'Procurement' },
    { id: 'VIS-3', name: 'Visitor 3', checkedInAt: '10:30:00', door: 'Main Gate Entry', zone: 'Main Gate', host: 'Quality' },
  ]
  return {
    cameras: SEED_CAMERAS,
    accessEvents: [],
    employeesInside: 148,
    visitors: visitorsOnSite.length,
    visitorsOnSite,
    doorsOpen: 1,
    doorsTotal: 12,
    gateActivityCount: 0,
  }
}

function tickSecurity(prev: SecurityState, hhmmssNow: string): SecurityState {
  const employeesInside = Math.round(clamp(walkToward(rng, prev.employeesInside, prev.employeesInside, 1, 0.6), 90, 220))
  const doorsOpen = Math.round(clamp(walkToward(rng, prev.doorsOpen, prev.doorsOpen, 0.5, 0.4), 0, prev.doorsTotal))

  let accessEvents = prev.accessEvents
  let gateActivityCount = prev.gateActivityCount
  let cameras = prev.cameras
  if (rng() < 0.12) {
    const { door, zone } = randomAccessDoor(rng)
    const roll = rng()
    const decision = roll < 0.03 ? 'tailgate' : roll < 0.1 ? 'denied' : 'granted'
    const event = { id: `EVT-${Date.now()}-${Math.floor(rng() * 1000)}`, at: hhmmssNow, person: randomAccessPerson(rng), door, zone, decision } as const
    accessEvents = [event, ...accessEvents].slice(0, 40)
    if (door.includes('Gate')) gateActivityCount += 1
    cameras = cameras.map((c) => (c.location === zone ? { ...c, lastEventAt: hhmmssNow } : c))
  }

  // A real roster, not an independent random walk — the "Visitors" KPI is
  // always this array's length, so its Details panel (which lists this same
  // array) can never show a different count than the tile itself.
  const targetCount = Math.round(clamp(walkToward(rng, prev.visitorsOnSite.length, prev.visitorsOnSite.length, 0.4, 0.3), 0, 15))
  let visitorsOnSite = prev.visitorsOnSite
  if (targetCount > visitorsOnSite.length) {
    const { door, zone } = randomAccessDoor(rng)
    visitorsOnSite = [
      ...visitorsOnSite,
      { id: `VIS-${++visitorSeq}`, name: `Visitor ${visitorSeq}`, checkedInAt: hhmmssNow, door, zone, host: randomVisitorHost(rng) },
    ]
  } else if (targetCount < visitorsOnSite.length) {
    // Oldest visitor checks out first.
    visitorsOnSite = visitorsOnSite.slice(1)
  }

  return { cameras, accessEvents, employeesInside, visitors: visitorsOnSite.length, visitorsOnSite, doorsOpen, doorsTotal: prev.doorsTotal, gateActivityCount }
}

function tickSafetyExtra(prev: SimulationState['safetyExtra']): SimulationState['safetyExtra'] {
  return {
    ...prev,
    ppeCompliancePct: clamp(walkToward(rng, prev.ppeCompliancePct, 97, 0.3, 0.2), 85, 100),
    complianceScorePct: clamp(walkToward(rng, prev.complianceScorePct, 92, 0.2, 0.15), 80, 100),
  }
}

function initialMaterials(): MaterialsState {
  const inboundShipments = SEED_INBOUND_SHIPMENTS
  return {
    materials: SEED_MATERIALS,
    suppliers: SEED_SUPPLIERS,
    purchaseOrders: SEED_PURCHASE_ORDERS,
    inboundShipments,
    outboundShipments: SEED_OUTBOUND_SHIPMENTS,
    inboundToday: 4,
    outboundToday: 7,
    openDeliveries: inboundShipments.filter((s) => s.status !== 'arrived').length,
  }
}

/**
 * How much simulated time one engine tick represents for material
 * consumption/delivery purposes. At 6 simulated minutes per tick, a
 * material's full daily draw plays out over ~4 minutes of session time —
 * fast enough that a live demo actually sees stock levels and statuses
 * change, slow enough that nothing empties in a handful of seconds.
 */
const SIM_MINUTES_PER_TICK = 6
const PO_STATUS_OPEN: PurchaseOrder['status'][] = ['draft', 'pending-approval', 'ordered', 'partially-received', 'delayed']

function tickMaterials(prev: MaterialsState, outputDeltaUnits: number): MaterialsState {
  const consumptionShare = outputDeltaUnits / Math.max(1, prev.materials.length)
  const inboundShipments = prev.inboundShipments.map((s) => ({ ...s }))
  const purchaseOrders = [...prev.purchaseOrders]
  let newPoCounter = purchaseOrders.length
  let inboundArrivedThisTick = 0

  const materials = prev.materials.map((m) => {
    // Steady-state daily draw, compressed into simulated time, plus a small
    // share tied to this tick's real production so the two stay connected.
    const perTickConsumption = (m.dailyConsumption * SIM_MINUTES_PER_TICK) / (24 * 60)
    let stockLevel = m.stockLevel - perTickConsumption - consumptionShare * 0.05 - rng() * perTickConsumption * 0.1
    let incomingQuantity = m.incomingQuantity
    let incomingETA = m.incomingETA

    // A pending delivery arrives probabilistically rather than on a fixed
    // countdown — keeps the "coming into the factory" story alive across a
    // session without every material arriving in lockstep.
    if (incomingQuantity > 0 && rng() < 0.006) {
      stockLevel += incomingQuantity
      incomingQuantity = 0
      incomingETA = null
      inboundArrivedThisTick++
      const shipment = inboundShipments.find((s) => s.materialId === m.id && s.status !== 'arrived')
      if (shipment) shipment.status = 'arrived'
      const po = purchaseOrders.find((p) => p.materialId === m.id && (p.status === 'ordered' || p.status === 'partially-received'))
      if (po) po.status = 'received'
    }

    stockLevel = clamp(stockLevel, 0, m.capacity)
    const next = { ...m, stockLevel: Math.round(stockLevel * 10) / 10, incomingQuantity, incomingETA }

    // Auto-procurement: once a material is genuinely critical or exhausted
    // and nothing is already inbound to cover it, place an order rather
    // than just flagging it — this is the closed loop the module promises.
    const status = materialStatus(next)
    const hasOpenPo = purchaseOrders.some((p) => p.materialId === m.id && PO_STATUS_OPEN.includes(p.status))
    if ((status === 'critical' || status === 'out_of_stock') && incomingQuantity <= 0 && !hasOpenPo) {
      const qty = recommendedOrderQty(next)
      if (qty > 0) {
        newPoCounter++
        purchaseOrders.push({
          id: `PO-AUTO-${m.id}-${newPoCounter}`,
          poNumber: `PO-2026-${String(126 + newPoCounter).padStart(5, '0')}`,
          materialId: m.id,
          supplierId: m.supplierId,
          quantity: qty,
          unit: m.unit,
          orderedAt: new Date().toISOString(),
          expectedDelivery: new Date(Date.now() + m.leadTimeDays * 86_400_000).toISOString(),
          status: 'ordered',
          priority: status === 'out_of_stock' ? 'urgent' : 'high',
          reason: 'Auto-generated: stock below critical threshold',
        })
        next.incomingQuantity = qty
        next.incomingETA = new Date(Date.now() + m.leadTimeDays * 86_400_000).toISOString()
      }
    }
    return next
  })

  // Light liveliness on the inbound board itself: an on-time shipment can
  // start unloading, or occasionally slip to delayed — independent of
  // whether its material's stock actually ticks over this cycle.
  for (const s of inboundShipments) {
    if (s.status === 'on-time' && rng() < 0.01) s.status = rng() < 0.15 ? 'delayed' : 'unloading'
  }

  return {
    materials,
    suppliers: prev.suppliers,
    purchaseOrders,
    inboundShipments,
    outboundShipments: prev.outboundShipments,
    inboundToday: prev.inboundToday + inboundArrivedThisTick,
    outboundToday: prev.outboundToday + (rng() < 0.05 ? 1 : 0),
    openDeliveries: inboundShipments.filter((s) => s.status !== 'arrived').length,
  }
}


/**
 * BMS assets walk their live values around their seeded operating point,
 * exactly like every other simulated object — one engine, one rng, one
 * tick. Status is derived from the values rather than scripted, so the 3D
 * scene, the BMS module and the alert logic always agree.
 */
function tickBmsAssets(prev: BmsAsset[]): BmsAsset[] {
  return prev.map((a) => {
    if (a.status === 'idle' || a.status === 'maintenance') {
      return { ...a, temperatureC: Math.round(walkToward(rng, a.temperatureC, a.temperatureC, 0.1, 0.05) * 10) / 10 }
    }
    const loadPct = clamp(walkToward(rng, a.loadPct, a.loadPct, 1.2, 0.7), 5, 100)
    const speedPct = clamp(walkToward(rng, a.speedPct, a.speedPct, 1.4, 0.8), 0, 100)
    const temperatureC = Math.round(walkToward(rng, a.temperatureC, a.temperatureC, 0.2, 0.12) * 10) / 10
    const powerKw = a.powerKw > 0 ? Math.round(walkToward(rng, a.powerKw, a.powerKw, 1.5, 0.9) * 10) / 10 : 0
    const status: BmsAsset['status'] = loadPct > 88 || (a.type === 'transformer' && temperatureC > 75) ? 'warning' : 'running'
    return { ...a, loadPct: Math.round(loadPct * 10) / 10, speedPct: Math.round(speedPct), temperatureC, powerKw, status }
  })
}

/**
 * Vehicles move along their routes and cycle through loading states. Like
 * every other object they advance on the one central tick — the twin reads
 * `routeProgress` to place them, so their 3D position and their logistics
 * record can never disagree.
 */
function tickVehicles(prev: Vehicle[]): Vehicle[] {
  return prev.map((v) => {
    if (v.status === 'in-transit') {
      // Progress is normalized; a vehicle that reaches the end of its route
      // wraps around and starts the leg again, keeping the yard busy.
      const step = (v.speedKph / 3600) * (TICK_MS / 1000) * 0.06
      const routeProgress = (v.routeProgress + step) % 1
      const etaMinutes = Math.max(0, Math.round((1 - routeProgress) * 6 * 10) / 10)
      return { ...v, routeProgress, etaMinutes, speedKph: clamp(walkToward(rng, v.speedKph, v.speedKph, 0.4, 0.25), 4, 18) }
    }

    // Loading/unloading vehicles fill or empty, then swap to the other state.
    const delta = v.status === 'loading' ? 0.35 : v.status === 'unloading' ? -0.35 : 0
    const loadPct = clamp(v.loadPct + delta, 0, 100)
    const status: Vehicle['status'] =
      v.status === 'loading' && loadPct >= 100 ? 'departing' : v.status === 'unloading' && loadPct <= 0 ? 'idle' : v.status
    const etaMinutes = v.status === 'loading' ? Math.max(0, Math.round(((100 - loadPct) / 100) * 24)) : v.etaMinutes
    return { ...v, loadPct: Math.round(loadPct * 10) / 10, status, etaMinutes }
  })
}

/**
 * Value-chain stages are a view onto the rest of the simulation rather than
 * an independent data source: manufacturing reads live OEE and output,
 * quality reads the live quality rate, shipping reads the live outbound
 * count. Only the stages with no upstream signal (installation, capital
 * works) walk on their own.
 */
function tickValueChain(prev: ValueChainStage[], state: {
  kpis: SimulationState['kpis']
  materials: MaterialsState
  attention: SimulationState['attention']
}): ValueChainStage[] {
  return prev.map((stage) => {
    switch (stage.id) {
      case 'procurement': {
        const lowStock = state.materials.materials.filter((m) => m.stockLevel < m.reorderLevel).length
        return {
          ...stage,
          openItems: state.materials.openDeliveries + lowStock,
          completedToday: state.materials.inboundToday,
          status: lowStock > 0 ? 'attention' : 'on-track',
          metricValue: `${lowStock} low`,
          metricLabel: lowStock > 0 ? 'Materials below reorder' : 'Materials in stock',
        }
      }
      case 'manufacturing':
        return {
          ...stage,
          progressPct: Math.round(state.kpis.oeePct * 10) / 10,
          openItems: state.kpis.linesRunning,
          completedToday: Math.round(state.kpis.outputUnits),
          status: state.kpis.oeePct < 60 ? 'attention' : 'on-track',
          metricValue: Math.round(state.kpis.outputUnits).toLocaleString(),
          metricLabel: 'Units today',
        }
      case 'quality':
        return {
          ...stage,
          progressPct: Math.round(state.kpis.oeeQualityPct * 10) / 10,
          openItems: state.attention.length,
          status: state.kpis.oeeQualityPct < 95 ? 'attention' : 'on-track',
          metricValue: String(state.attention.length),
          metricLabel: 'Open non-conformances',
        }
      case 'shipping':
        return {
          ...stage,
          completedToday: state.materials.outboundToday,
          metricValue: String(state.materials.outboundToday),
          metricLabel: 'Outbound today',
        }
      case 'installation': {
        const progressPct = clamp(walkToward(rng, stage.progressPct, 74, 0.25, 0.15), 40, 100)
        return { ...stage, progressPct: Math.round(progressPct * 10) / 10 }
      }
      case 'construction': {
        const progressPct = clamp(walkToward(rng, stage.progressPct, 52, 0.15, 0.1), 20, 100)
        return { ...stage, progressPct: Math.round(progressPct * 10) / 10 }
      }
      default:
        return stage
    }
  })
}
/* --------------------------------------------------------------- state --- */

/**
 * A handful of real Assignment records already underway when the session
 * opens, against issues that are guaranteed to exist from tick 0
 * (EQUIPMENT-005/EQUIPMENT-022 are always scripted warnings, and the
 * safety incident is seeded non-zero above) — so the Work Allocation
 * station opens looking like an operations console mid-shift, not a blank
 * slate, without inventing any issue or employee that isn't already real.
 * Deliberately leaves some issues (the security violation, any material
 * shortages) unassigned so there's still real work for a supervisor to do.
 */
function seedInitialAssignments(personnel: Record<string, Employee>): { personnel: Record<string, Employee>; assignments: Record<string, Assignment> } {
  const now = Date.now()
  const nextPersonnel = { ...personnel }
  const assignments: Record<string, Assignment> = {}

  function seed(issueId: string, employeeId: string, status: AssignmentStatus, elapsedMin: number, etaMinutes: number, workMinutes: number, distanceM: number) {
    const emp = nextPersonnel[employeeId]
    if (!emp) return
    const statusSinceMs = now - elapsedMin * 60_000
    const assignedAt = hhmmss(new Date(statusSinceMs))
    const history: AssignmentEvent[] = [{ status: 'assigned', at: assignedAt }]
    if (status !== 'assigned') history.push({ status, at: assignedAt })
    const id = `ASG-${issueId}-seed`
    assignments[id] = { id, issueId, employeeId, status, assignedAt, statusSinceMs, etaMinutes, workMinutes, distanceM, history }
    const availability: Employee['availability'] = status === 'en-route' ? 'en-route' : 'working'
    nextPersonnel[employeeId] = { ...emp, availability, currentAssignmentId: id, activeTaskCount: Math.max(1, emp.activeTaskCount) }
  }

  // Distances match the real area→building tiers `distanceMeters` in
  // workAllocation.ts would compute for these same employee/issue pairs —
  // same-building-different-area is 160m, cross-building is 420m — so
  // these seeded records never contradict what the Response Station itself
  // would say if the assignment were made fresh right now.

  // Already deep into the repair — will reach Verification a few minutes
  // into the session, giving the supervisor something to close out live.
  seed('eq-EQUIPMENT-005', 'EMP-103', 'in-progress', 8, 2, 15, 160)
  // Still travelling — will visibly arrive on-site during a normal demo.
  seed('eq-EQUIPMENT-022', 'EMP-102', 'en-route', 1.5, 2, 15, 160)
  // The site's one safety officer, already on the incident.
  seed('safety-incidents', 'EMP-111', 'in-progress', 10, 6, 25, 420)

  return { personnel: nextPersonnel, assignments }
}

function buildInitialState(): SimulationState {
  const equipment: Record<string, Equipment> = {}
  for (const e of SEED_EQUIPMENT) equipment[e.id] = e

  const seededWork = seedInitialAssignments(Object.fromEntries(SEED_PERSONNEL.map((e) => [e.id, e])))

  const state: SimulationState = {
    lastUpdated: hhmmss(new Date()),
    tick: 0,
    site: SEED_SITE,
    buildings: SEED_BUILDINGS,
    areas: SEED_AREAS,
    lines: SEED_LINES,
    equipment,
    kpis: computeKpis(SEED_LINES, equipment),
    energy: { currentDemandMw: 2.1, consumptionMwh: 4.6, intensityMwhPerKUnit: 0.57, efficiencyPct: 88 },
    bms: {
      hvacStatus: 'Normal',
      buildingEnergyKw: 640,
      avgTemperatureC: 21.8,
      humidityPct: 44,
      airQualityIndex: 32,
      utilityStatus: 'Normal',
    },
    safetySecurity: {
      // Non-zero on load so the Requires Attention feed has a real Safety
      // and a real Security item from the start, rather than an empty
      // panel until a random equipment fault happens to occur. Neither
      // field is auto-incremented by the tick loop, so these stay stable
      // demo conditions rather than runaway counters.
      activeSafetyIncidents: 1,
      nearMisses: 1,
      securityEvents: 128,
      accessViolations: 1,
      criticalAlerts: 0,
    },
    attention: [],
    history: [],
    shiftHourly: [],
    healthLog: [],
    utilities: initialUtilities(),
    bmsZones: SEED_BMS_ZONES,
    security: initialSecurity(),
    safetyExtra: {
      fireDetectionStatus: 'Normal',
      ppeCompliancePct: 97,
      inspectionStatus: 'Up to date',
      complianceScorePct: 92,
      emergencyEventsActive: 0,
    },
    materials: initialMaterials(),
    floors: SEED_FLOORS,
    rooms: SEED_ROOMS,
    bmsAssets: SEED_BMS_ASSETS,
    safetyAssets: SEED_SAFETY_ASSETS,
    vehicles: SEED_VEHICLES,
    valueChain: SEED_VALUE_CHAIN,
    personnel: seededWork.personnel,
    assignments: seededWork.assignments,
  }
  state.kpis.systemHealthPct = Math.round(computeFacilityHealth(state.kpis, state.safetyExtra, state.safetySecurity) * 10) / 10
  state.attention = computeAttention(state)
  return state
}

function computeKpis(lines: ProductionLine[], equipment: Record<string, Equipment>): SimulationState['kpis'] {
  const eqList = Object.values(equipment)
  const outputUnits = lines.reduce((a, l) => a + l.outputUnits, 0)
  const targetUnits = SITE_TARGET_UNITS

  const runningLines = lines.filter((l) => l.status === 'running' || l.status === 'warning')
  const availAvg = runningLines.length ? runningLines.reduce((a, l) => a + l.availabilityPct, 0) / runningLines.length : 0
  const perfAvg = runningLines.length ? runningLines.reduce((a, l) => a + l.performancePct, 0) / runningLines.length : 0
  const qualAvg = runningLines.length ? runningLines.reduce((a, l) => a + l.qualityPct, 0) / runningLines.length : 0
  const oee = (availAvg / 100) * (perfAvg / 100) * (qualAvg / 100) * 100

  const equipmentTotal = eqList.length
  const equipmentRunning = eqList.filter((e) => e.status === 'running').length
  const equipmentIdle = eqList.filter((e) => e.status === 'idle').length
  const equipmentMaintenance = eqList.filter((e) => e.status === 'maintenance').length
  const equipmentWarning = eqList.filter((e) => e.status === 'warning').length
  const equipmentFaultOffline = eqList.filter((e) => e.status === 'critical' || e.status === 'offline').length
  const equipmentAvailable = equipmentTotal - equipmentMaintenance - equipmentFaultOffline
  const equipmentAvailabilityPct = equipmentTotal ? (equipmentAvailable / equipmentTotal) * 100 : 0
  const equipmentHealthScore = eqList.length ? eqList.reduce((a, e) => a + e.health, 0) / eqList.length : 0

  const systemHealthPct = clamp(0.4 * oee + 0.3 * equipmentAvailabilityPct + 0.3 * equipmentHealthScore, 0, 100)

  return {
    outputUnits: Math.round(outputUnits),
    targetUnits,
    achievementPct: Math.round((outputUnits / targetUnits) * 1000) / 10,
    efficiencyPct: Math.round(perfAvg * 10) / 10,
    oeePct: Math.round(oee * 10) / 10,
    oeeAvailabilityPct: Math.round(availAvg * 10) / 10,
    oeePerformancePct: Math.round(perfAvg * 10) / 10,
    oeeQualityPct: Math.round(qualAvg * 10) / 10,
    equipmentAvailabilityPct: Math.round(equipmentAvailabilityPct * 10) / 10,
    linesRunning: lines.filter((l) => l.status === 'running').length,
    linesIdle: lines.filter((l) => l.status === 'idle').length,
    linesMaintenance: lines.filter((l) => l.status === 'maintenance').length,
    linesOffline: lines.filter((l) => l.status === 'offline').length,
    linesTotal: lines.length,
    equipmentTotal,
    equipmentRunning,
    equipmentIdle,
    equipmentMaintenance,
    equipmentWarning,
    equipmentFaultOffline,
    equipmentHealthScore: Math.round(equipmentHealthScore * 10) / 10,
    systemHealthPct: Math.round(systemHealthPct * 10) / 10,
    downtimeMinutes: Math.round(lines.reduce((a, l) => a + l.downtimeMinutes, 0) * 10) / 10,
  }
}

function computeAttention(state: SimulationState): AttentionItem[] {
  const eqList = Object.values(state.equipment)
  return eqList
    .filter((e) => e.status === 'warning' || e.status === 'critical')
    .sort((a, b) => a.health - b.health)
    .slice(0, 5)
    .map((e) => ({
      equipmentId: e.id,
      equipmentName: e.name,
      lineId: e.lineId,
      status: e.status,
      reason:
        e.vibrationMmS > THRESHOLDS.vibrationMmS.warning
          ? 'Vibration above normal operating range'
          : 'Temperature above normal operating range',
      metric:
        e.vibrationMmS > THRESHOLDS.vibrationMmS.warning
          ? `${e.vibrationMmS.toFixed(2)} mm/s`
          : `${e.temperatureC.toFixed(1)} °C`,
    }))
}

/**
 * Rolls the current shift's real, tick-by-tick trend aggregates forward.
 * Opens a fresh bucket whenever the shift or the current bucket slot
 * changes, and otherwise extends the open one — so every value read off
 * `shiftHourly` is a genuine accumulation from this session's own ticks,
 * never a reconstructed or backfilled estimate. Bucketed at 5 real
 * minutes rather than a full shift-hour so the Trends charts have more
 * than one real point to plot within a normal session, while still being
 * anchored to real shift-clock time instead of an arbitrary rolling
 * window of ticks. Capped so a session left running across shift changes
 * doesn't grow this array without bound.
 */
const MAX_SHIFT_BUCKETS = 120 // 10 hours at 5-minute resolution

function tickShiftHourly(
  prevBuckets: ShiftHourBucket[],
  now: Date,
  outputUnits: number,
  downtimeMinutes: number,
  oeePct: number,
): ShiftHourBucket[] {
  const shift = getCurrentShift(now)
  const bucketMs = SHIFT_BUCKET_MINUTES * 60_000
  const bucketIndex = Math.floor((now.getTime() - shift.start.getTime()) / bucketMs)
  const last = prevBuckets[prevBuckets.length - 1]

  if (last && last.shiftId === shift.id && last.bucketIndex === bucketIndex) {
    const updated: ShiftHourBucket = {
      ...last,
      outputEnd: outputUnits,
      downtimeEnd: downtimeMinutes,
      oeeSum: last.oeeSum + oeePct,
      oeeSamples: last.oeeSamples + 1,
    }
    return [...prevBuckets.slice(0, -1), updated]
  }

  const bucketStart = new Date(shift.start.getTime() + bucketIndex * bucketMs)
  const fresh: ShiftHourBucket = {
    shiftId: shift.id,
    bucketIndex,
    label: shiftClockLabel(bucketStart),
    outputStart: outputUnits,
    outputEnd: outputUnits,
    downtimeStart: downtimeMinutes,
    downtimeEnd: downtimeMinutes,
    oeeSum: oeePct,
    oeeSamples: 1,
  }
  return [...prevBuckets, fresh].slice(-MAX_SHIFT_BUCKETS)
}

/**
 * Rolls the 24-hour equipment-health trend forward — 10-minute real
 * buckets, same tick-driven accumulation as `tickShiftHourly`, just not
 * shift-scoped since equipment condition doesn't reset at a shift
 * boundary. Old buckets fall off the cap rather than a shift change.
 */
const HEALTH_BUCKET_MINUTES = 10
const MAX_HEALTH_BUCKETS = 144 // 24 hours at 10-minute resolution

function tickHealthLog(prevBuckets: HealthLogBucket[], now: Date, avgHealth: number): HealthLogBucket[] {
  const bucketMs = HEALTH_BUCKET_MINUTES * 60_000
  const bucketIndex = Math.floor(now.getTime() / bucketMs)
  const last = prevBuckets[prevBuckets.length - 1]

  if (last && last.bucketIndex === bucketIndex) {
    const updated: HealthLogBucket = { ...last, sum: last.sum + avgHealth, samples: last.samples + 1 }
    return [...prevBuckets.slice(0, -1), updated]
  }

  const bucketStart = new Date(bucketIndex * bucketMs)
  const fresh: HealthLogBucket = { bucketIndex, label: shiftClockLabel(bucketStart), sum: avgHealth, samples: 1 }
  return [...prevBuckets, fresh].slice(-MAX_HEALTH_BUCKETS)
}

/* ------------------------------------------------------------------ tick - */

function nextState(prev: SimulationState): SimulationState {
  const equipment: Record<string, Equipment> = {}
  for (const id in prev.equipment) equipment[id] = tickEquipment(prev.equipment[id])

  const lines = prev.lines.map((l) => tickLine(l, equipment))
  const kpis = computeKpis(lines, equipment)

  const equipmentPowerMw = Object.values(equipment).reduce((a, e) => a + e.powerKw, 0) / 1000
  const bmsLoadMw = prev.bms.buildingEnergyKw / 1000
  const currentDemandMw = Math.round((equipmentPowerMw + bmsLoadMw) * 100) / 100
  const consumptionMwh = prev.energy.consumptionMwh + currentDemandMw * (TICK_MS / 3_600_000)
  const intensity = kpis.outputUnits > 0 ? consumptionMwh / (kpis.outputUnits / 1000) : prev.energy.intensityMwhPerKUnit
  const energy = {
    currentDemandMw,
    consumptionMwh: Math.round(consumptionMwh * 1000) / 1000,
    intensityMwhPerKUnit: Math.round(intensity * 100) / 100,
    efficiencyPct: clamp(walkToward(rng, prev.energy.efficiencyPct, 88, 0.4, 0.3), 70, 98),
  }

  const bms = {
    ...prev.bms,
    buildingEnergyKw: clamp(walkToward(rng, prev.bms.buildingEnergyKw, 640, 6, 3), 400, 950),
    avgTemperatureC: Math.round(walkToward(rng, prev.bms.avgTemperatureC, 21.8, 0.15, 0.08) * 10) / 10,
    humidityPct: Math.round(walkToward(rng, prev.bms.humidityPct, 44, 0.5, 0.3)),
    airQualityIndex: Math.round(walkToward(rng, prev.bms.airQualityIndex, 32, 1, 0.6)),
  }

  const criticalAlerts = Object.values(equipment).filter((e) => e.status === 'critical').length
  const safetySecurity = {
    ...prev.safetySecurity,
    securityEvents: prev.safetySecurity.securityEvents + (rng() < 0.08 ? 1 : 0),
    criticalAlerts,
  }

  const now = new Date()
  const nowStr = hhmmss(now)
  const utilities = tickUtilities(prev.utilities)
  const bmsZones = tickBmsZones(prev.bmsZones)
  const security = tickSecurity(prev.security, nowStr)
  const safetyExtra = tickSafetyExtra(prev.safetyExtra)
  const materials = tickMaterials(prev.materials, kpis.outputUnits - prev.kpis.outputUnits)
  const bmsAssets = tickBmsAssets(prev.bmsAssets)
  const vehicles = tickVehicles(prev.vehicles)
  const valueChain = tickValueChain(prev.valueChain, { kpis, materials, attention: prev.attention })

  kpis.systemHealthPct = Math.round(computeFacilityHealth(kpis, safetyExtra, safetySecurity) * 10) / 10

  const tick = prev.tick + 1
  const historyPoint: HistoryPoint = {
    t: tick,
    productionRatePerMin: Math.round(
      lines.reduce((a, l) => a + (l.status === 'critical' ? 0 : (l.performancePct / 100) * (l.qualityPct / 100)), 0) *
        2.6 *
        10,
    ) / 10,
    oeePct: kpis.oeePct,
    energyDemandMw: currentDemandMw,
    equipmentHealthScore: kpis.equipmentHealthScore,
    downtimeMinutes: kpis.downtimeMinutes,
    criticalAlerts,
  }
  const history = [...prev.history, historyPoint].slice(-HISTORY_LENGTH)
  const shiftHourly = tickShiftHourly(prev.shiftHourly, now, kpis.outputUnits, kpis.downtimeMinutes, kpis.oeePct)
  const healthLog = tickHealthLog(prev.healthLog, now, kpis.equipmentHealthScore)

  const assignmentTick = tickAssignments(prev.assignments, prev.personnel, equipment, now)

  const next: SimulationState = {
    lastUpdated: nowStr,
    tick,
    site: prev.site,
    buildings: prev.buildings,
    areas: prev.areas,
    lines,
    equipment: assignmentTick.equipment,
    kpis,
    energy,
    bms,
    safetySecurity,
    attention: [],
    history,
    shiftHourly,
    healthLog,
    utilities,
    bmsZones,
    security,
    safetyExtra,
    materials,
    floors: prev.floors,
    rooms: prev.rooms,
    bmsAssets,
    safetyAssets: prev.safetyAssets,
    vehicles,
    valueChain,
    personnel: assignmentTick.personnel,
    assignments: assignmentTick.assignments,
  }
  next.attention = computeAttention(next)
  return next
}

/**
 * Auto-progresses every open assignment through en-route → on-site →
 * in-progress on the real ETA/work-duration numbers computed when it was
 * created (see `workAllocation.ts`), and syncs the assigned employee's
 * availability to match. Stops at `verification` — closing the loop is a
 * deliberate supervisor action (`SimulationEngine.verifyAndClose`), not
 * something that happens on its own.
 *
 * The moment real work starts (`in-progress`), it clears any scripted
 * fault drift on the linked equipment — the same field `tickEquipment`
 * already reads to hold a demo fault steady — so the asset recovers
 * through the existing load/temperature/vibration model already running
 * every tick, rather than a second, separate "fix" formula.
 */
const ASSIGNED_HOLD_MS = 6_000
const ON_SITE_SETUP_MS = 30_000

function tickAssignments(
  prevAssignments: Record<string, Assignment>,
  prevPersonnel: Record<string, Employee>,
  equipment: Record<string, Equipment>,
  now: Date,
): { assignments: Record<string, Assignment>; personnel: Record<string, Employee>; equipment: Record<string, Equipment> } {
  const nowMs = now.getTime()
  let assignments = prevAssignments
  let personnel = prevPersonnel
  let nextEquipment = equipment
  let assignmentsChanged = false
  let personnelChanged = false
  let equipmentChanged = false

  for (const id in prevAssignments) {
    const a = prevAssignments[id]
    if (a.status === 'verification' || a.status === 'resolved' || a.status === 'closed') continue
    const elapsedMs = nowMs - a.statusSinceMs
    let nextStatus: AssignmentStatus | null = null

    if (a.status === 'assigned' && elapsedMs >= ASSIGNED_HOLD_MS) nextStatus = 'en-route'
    else if (a.status === 'en-route' && elapsedMs >= a.etaMinutes * 60_000) nextStatus = 'on-site'
    else if (a.status === 'on-site' && elapsedMs >= ON_SITE_SETUP_MS) nextStatus = 'in-progress'
    else if (a.status === 'in-progress' && elapsedMs >= a.workMinutes * 60_000) nextStatus = 'verification'

    if (!nextStatus) continue

    if (!assignmentsChanged) {
      assignments = { ...prevAssignments }
      assignmentsChanged = true
    }
    assignments[id] = { ...a, status: nextStatus, statusSinceMs: nowMs, history: [...a.history, { status: nextStatus, at: hhmmss(now) }] }

    if (nextStatus === 'in-progress') {
      const eqId = a.issueId.startsWith('eq-') ? a.issueId.slice(3) : null
      if (eqId && nextEquipment[eqId]?.scripted) {
        if (!equipmentChanged) {
          nextEquipment = { ...equipment }
          equipmentChanged = true
        }
        nextEquipment[eqId] = { ...nextEquipment[eqId], scripted: undefined }
      }
    }

    const emp = prevPersonnel[a.employeeId]
    if (emp) {
      if (!personnelChanged) {
        personnel = { ...prevPersonnel }
        personnelChanged = true
      }
      if (nextStatus === 'verification') {
        personnel[a.employeeId] = { ...emp, availability: 'available', currentAssignmentId: null, activeTaskCount: Math.max(0, emp.activeTaskCount - 1) }
      } else {
        const availability: Employee['availability'] = nextStatus === 'en-route' ? 'en-route' : 'working'
        personnel[a.employeeId] = { ...emp, availability }
      }
    }
  }

  return { assignments, personnel, equipment: nextEquipment }
}

/* ---------------------------------------------------------------- store - */

class SimulationEngine {
  private state: SimulationState = buildInitialState()
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | null = null

  private notify = () => {
    for (const l of this.listeners) l()
  }

  private tick = () => {
    this.state = nextState(this.state)
    this.notify()
  }

  start = () => {
    if (this.timer) return
    this.timer = setInterval(this.tick, TICK_MS)
  }

  stop = () => {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getSnapshot = () => this.state

  /**
   * The four real commands a supervisor issues from the Work Allocation
   * station. Unlike the Simulation page's scenarios, these genuinely
   * mutate shared state — an assignment is a real operational action, not
   * a hypothetical — so every other reader of `state.personnel` /
   * `state.assignments` sees the result immediately, same as any other
   * tick.
   */
  assignIssue = (issueId: string, employeeId: string, etaMinutes: number, workMinutes: number, distanceM: number) => {
    const employee = this.state.personnel[employeeId]
    if (!employee) return
    const now = new Date()
    const id = `ASG-${issueId}-${now.getTime()}`

    // Reassigning: free up whoever was previously on this issue first.
    const existing = Object.values(this.state.assignments).find((a) => a.issueId === issueId && a.status !== 'closed')
    const personnel = { ...this.state.personnel }
    if (existing) {
      const prevEmp = personnel[existing.employeeId]
      if (prevEmp) personnel[existing.employeeId] = { ...prevEmp, availability: 'available', currentAssignmentId: null, activeTaskCount: Math.max(0, prevEmp.activeTaskCount - 1) }
    }

    const assignment: Assignment = {
      id,
      issueId,
      employeeId,
      status: 'assigned',
      assignedAt: hhmmss(now),
      statusSinceMs: now.getTime(),
      etaMinutes,
      workMinutes,
      distanceM,
      history: [{ status: 'assigned', at: hhmmss(now) }],
    }

    personnel[employeeId] = { ...employee, availability: 'assigned', currentAssignmentId: id, activeTaskCount: employee.activeTaskCount + 1 }

    this.state = {
      ...this.state,
      assignments: { ...(existing ? { ...this.state.assignments, [existing.id]: { ...existing, status: 'closed' } } : this.state.assignments), [id]: assignment },
      personnel,
    }
    this.notify()
  }

  /** Forwards an unresolved issue to another department when the recommended person can't take it — the supervisor picks a new candidate from that department next. */
  escalateIssue = (issueId: string, toDepartment: Department) => {
    const existing = Object.values(this.state.assignments).find((a) => a.issueId === issueId && a.status !== 'closed')
    if (!existing) return
    const now = new Date()
    this.state = {
      ...this.state,
      assignments: { ...this.state.assignments, [existing.id]: { ...existing, escalated: { toDepartment, at: hhmmss(now) } } },
    }
    this.notify()
  }

  /** The supervisor confirming the work is actually done — the one step that isn't automatic, closing the loop from Verification through to Closed. */
  verifyAndClose = (assignmentId: string) => {
    const a = this.state.assignments[assignmentId]
    if (!a || a.status !== 'verification') return
    const now = new Date()
    const employee = this.state.personnel[a.employeeId]
    this.state = {
      ...this.state,
      assignments: {
        ...this.state.assignments,
        [assignmentId]: {
          ...a,
          status: 'closed',
          statusSinceMs: now.getTime(),
          history: [...a.history, { status: 'resolved', at: hhmmss(now) }, { status: 'closed', at: hhmmss(now) }],
        },
      },
      personnel: employee ? { ...this.state.personnel, [a.employeeId]: { ...employee, currentAssignmentId: employee.currentAssignmentId === assignmentId ? null : employee.currentAssignmentId } } : this.state.personnel,
    }
    this.notify()
  }
}

/** Single shared instance — the one centralized simulation loop for the whole app. */
export const simulationEngine = new SimulationEngine()
