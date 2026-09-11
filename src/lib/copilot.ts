import { THRESHOLDS, type SimulationState } from '../simulation/types'
import type { SelectionKind } from '../twin/selection'
import { MODULE_LABEL, deriveCascade } from './factoryEvents'
import { bindingOeeConstraint } from './productionIntelligence'

/**
 * A local reasoning service over the live facility state.
 *
 * There is no model API here and nothing is canned: every answer is
 * computed from the same simulation state the dashboards and the Digital
 * Twin are reading at that instant, so the Copilot can never disagree with
 * what is on screen. The intent router maps a question to an analysis
 * function; each analysis returns a headline, supporting findings, and the
 * assets involved so the answer can link straight into the twin.
 *
 * The seam for a real model is deliberate: swap `answer()` for an API call
 * that receives `buildFacilityBriefing(state)` as context and the rest of
 * the UI is unchanged.
 */

export type CopilotAsset = { kind: SelectionKind; id: string; label: string }

export type CopilotAnswer = {
  headline: string
  findings: string[]
  assets: CopilotAsset[]
  /** Shown when the question didn't match a known analysis. */
  fallback?: boolean
}

type Intent = {
  id: string
  /** Any of these substrings appearing in the question routes to this analysis. */
  keywords: string[]
  run: (state: SimulationState, question: string) => CopilotAnswer
}

/* ------------------------------------------------------------- analyses -- */

function attentionAnalysis(state: SimulationState): CopilotAnswer {
  const items = state.attention
  if (items.length === 0) {
    return {
      headline: 'Nothing currently requires attention.',
      findings: [
        `All ${state.kpis.equipmentTotal} equipment units are inside their normal operating bands.`,
        `Facility health is ${state.kpis.systemHealthPct.toFixed(1)}% and there are no critical alerts.`,
      ],
      assets: [],
    }
  }

  const critical = items.filter((i) => i.status === 'critical')
  return {
    headline:
      critical.length > 0
        ? `${critical.length} asset${critical.length > 1 ? 's are' : ' is'} critical and ${items.length - critical.length} more need watching.`
        : `${items.length} asset${items.length > 1 ? 's need' : ' needs'} attention — none critical yet.`,
    findings: items.map((i) => `${i.equipmentId} (${i.equipmentName}) on ${i.lineId}: ${i.reason} — now reading ${i.metric}.`),
    assets: items.map((i) => ({ kind: 'equipment' as const, id: i.equipmentId, label: i.equipmentId })),
  }
}

function riskAnalysis(state: SimulationState): CopilotAnswer {
  // "At risk" is broader than "already alarming": anything trending toward a
  // threshold, degrading in health, or due for maintenance soon.
  const equipment = Object.values(state.equipment)
  const atRisk = equipment
    .filter(
      (e) =>
        e.health < 80 ||
        e.vibrationMmS > THRESHOLDS.vibrationMmS.warning * 0.8 ||
        e.temperatureC > THRESHOLDS.temperatureC.warning * 0.9 ||
        e.maintenanceDueInDays <= 7,
    )
    .sort((a, b) => a.health - b.health)
    .slice(0, 6)

  if (atRisk.length === 0) {
    return { headline: 'No equipment is currently trending toward a threshold.', findings: [], assets: [] }
  }

  return {
    headline: `${atRisk.length} unit${atRisk.length > 1 ? 's are' : ' is'} trending toward a limit or due for service.`,
    findings: atRisk.map((e) => {
      const reasons: string[] = []
      if (e.health < 80) reasons.push(`health ${e.health.toFixed(0)}%`)
      if (e.vibrationMmS > THRESHOLDS.vibrationMmS.warning * 0.8) reasons.push(`vibration ${e.vibrationMmS.toFixed(2)} mm/s`)
      if (e.temperatureC > THRESHOLDS.temperatureC.warning * 0.9) reasons.push(`temperature ${e.temperatureC.toFixed(1)} °C`)
      if (e.maintenanceDueInDays <= 7) reasons.push(`maintenance due in ${e.maintenanceDueInDays} days`)
      return `${e.id}: ${reasons.join(', ')}.`
    }),
    assets: atRisk.map((e) => ({ kind: 'equipment' as const, id: e.id, label: e.id })),
  }
}

function productionAnalysis(state: SimulationState): CopilotAnswer {
  const { kpis } = state
  const stopped = state.lines.filter((l) => l.status !== 'running')
  const worst = [...state.lines].sort((a, b) => a.performancePct - b.performancePct)[0]

  const findings = [
    `Output is ${Math.round(kpis.outputUnits).toLocaleString()} of a ${kpis.targetUnits.toLocaleString()} unit target (${kpis.achievementPct.toFixed(1)}%).`,
    `OEE is ${kpis.oeePct.toFixed(1)}% — availability ${kpis.oeeAvailabilityPct.toFixed(1)}%, performance ${kpis.oeePerformancePct.toFixed(1)}%, quality ${kpis.oeeQualityPct.toFixed(1)}%.`,
  ]

  if (stopped.length > 0) {
    findings.push(`${stopped.length} of ${kpis.linesTotal} lines are not running: ${stopped.map((l) => `${l.name} (${l.status})`).join(', ')}.`)
  }
  if (worst) {
    findings.push(`${worst.name} has the lowest performance at ${worst.performancePct.toFixed(1)}%.`)
  }

  // Name the dominant constraint rather than just listing numbers.
  const weakest = bindingOeeConstraint(kpis).label.toLowerCase()

  return {
    headline: `The binding constraint right now is ${weakest}.`,
    findings,
    assets: [
      ...stopped.map((l) => ({ kind: 'line' as const, id: l.id, label: l.name })),
      ...(worst && !stopped.some((l) => l.id === worst.id) ? [{ kind: 'line' as const, id: worst.id, label: worst.name }] : []),
    ],
  }
}

function downtimeAnalysis(state: SimulationState): CopilotAnswer {
  const ranked = [...state.lines].sort((a, b) => b.downtimeMinutes - a.downtimeMinutes)
  const top = ranked[0]
  if (!top || top.downtimeMinutes === 0) {
    return { headline: 'No line has recorded downtime this session.', findings: [], assets: [] }
  }
  return {
    headline: `${top.name} has the highest downtime at ${top.downtimeMinutes.toFixed(1)} minutes.`,
    findings: ranked
      .filter((l) => l.downtimeMinutes > 0)
      .slice(0, 5)
      .map((l) => `${l.name}: ${l.downtimeMinutes.toFixed(1)} min accumulated, currently ${l.status}.`),
    assets: ranked.filter((l) => l.downtimeMinutes > 0).slice(0, 5).map((l) => ({ kind: 'line' as const, id: l.id, label: l.name })),
  }
}

function maintenanceAnalysis(state: SimulationState): CopilotAnswer {
  const due = Object.values(state.equipment)
    .filter((e) => e.maintenanceDueInDays <= 14 || e.status === 'maintenance')
    .sort((a, b) => a.maintenanceDueInDays - b.maintenanceDueInDays)
    .slice(0, 8)

  if (due.length === 0) {
    return { headline: 'No equipment is due for maintenance in the next two weeks.', findings: [], assets: [] }
  }

  return {
    headline: `${due.length} unit${due.length > 1 ? 's require' : ' requires'} maintenance attention.`,
    findings: due.map((e) =>
      e.status === 'maintenance'
        ? `${e.id} is currently under maintenance.`
        : `${e.id}: due in ${e.maintenanceDueInDays} days, health ${e.health.toFixed(0)}%, ${e.operatingHours.toFixed(0)} operating hours.`,
    ),
    assets: due.map((e) => ({ kind: 'equipment' as const, id: e.id, label: e.id })),
  }
}

function energyAnalysis(state: SimulationState): CopilotAnswer {
  const equipment = Object.values(state.equipment)
  const hungriest = [...equipment].sort((a, b) => b.powerKw - a.powerKw).slice(0, 5)
  const bmsHeavy = [...state.bmsAssets].filter((a) => a.powerKw > 0).sort((a, b) => b.powerKw - a.powerKw).slice(0, 3)

  return {
    headline: `The facility is drawing ${state.energy.currentDemandMw.toFixed(2)} MW at ${state.energy.efficiencyPct.toFixed(1)}% efficiency.`,
    findings: [
      `Energy intensity is ${state.energy.intensityMwhPerKUnit.toFixed(2)} MWh per 1,000 units produced.`,
      `Building services account for ${state.bms.buildingEnergyKw.toFixed(0)} kW of the total.`,
      `Highest-draw equipment: ${hungriest.map((e) => `${e.id} (${e.powerKw.toFixed(0)} kW)`).join(', ')}.`,
      ...(bmsHeavy.length > 0 ? [`Highest-draw plant: ${bmsHeavy.map((a) => `${a.id} (${a.powerKw.toFixed(0)} kW)`).join(', ')}.`] : []),
    ],
    assets: [
      ...hungriest.slice(0, 3).map((e) => ({ kind: 'equipment' as const, id: e.id, label: e.id })),
      ...bmsHeavy.slice(0, 2).map((a) => ({ kind: 'bms' as const, id: a.id, label: a.id })),
    ],
  }
}

function vibrationAnalysis(state: SimulationState): CopilotAnswer {
  const abnormal = Object.values(state.equipment)
    .filter((e) => e.vibrationMmS > THRESHOLDS.vibrationMmS.warning * 0.7)
    .sort((a, b) => b.vibrationMmS - a.vibrationMmS)

  if (abnormal.length === 0) {
    return { headline: 'All equipment is vibrating within normal limits.', findings: [], assets: [] }
  }

  return {
    headline: `${abnormal.length} unit${abnormal.length > 1 ? 's show' : ' shows'} elevated vibration.`,
    findings: abnormal.map(
      (e) =>
        `${e.id}: ${e.vibrationMmS.toFixed(2)} mm/s (warning at ${THRESHOLDS.vibrationMmS.warning}, critical at ${THRESHOLDS.vibrationMmS.critical}), health ${e.health.toFixed(0)}%.`,
    ),
    assets: abnormal.map((e) => ({ kind: 'equipment' as const, id: e.id, label: e.id })),
  }
}

function alertAnalysis(state: SimulationState): CopilotAnswer {
  const critical = Object.values(state.equipment).filter((e) => e.status === 'critical')
  const warning = Object.values(state.equipment).filter((e) => e.status === 'warning')

  return {
    headline:
      critical.length > 0
        ? `${critical.length} critical alert${critical.length > 1 ? 's' : ''} and ${warning.length} warning${warning.length === 1 ? '' : 's'} are active.`
        : warning.length > 0
          ? `No critical alerts. ${warning.length} warning${warning.length === 1 ? '' : 's'} active.`
          : 'There are no active alerts.',
    findings: [
      ...critical.map((e) => `CRITICAL — ${e.id}: ${e.temperatureC.toFixed(1)} °C, ${e.vibrationMmS.toFixed(2)} mm/s.`),
      ...warning.map((e) => `WARNING — ${e.id}: ${e.temperatureC.toFixed(1)} °C, ${e.vibrationMmS.toFixed(2)} mm/s.`),
      `Access violations: ${state.safetySecurity.accessViolations}. Active safety incidents: ${state.safetySecurity.activeSafetyIncidents}.`,
    ],
    assets: [...critical, ...warning].map((e) => ({ kind: 'equipment' as const, id: e.id, label: e.id })),
  }
}

function bmsAnalysis(state: SimulationState): CopilotAnswer {
  const flagged = state.bmsAssets.filter((a) => a.status === 'warning')
  const hotZones = state.bmsZones.filter((z) => z.status === 'Attention')

  return {
    headline:
      flagged.length > 0
        ? `${flagged.length} building-services asset${flagged.length > 1 ? 's are' : ' is'} outside normal range.`
        : 'All building services are operating normally.',
    findings: [
      ...flagged.map((a) => `${a.id} (${a.name}): ${a.loadPct.toFixed(0)}% load, ${a.temperatureC.toFixed(1)} °C.`),
      ...hotZones.map((z) => `Zone ${z.name}: ${z.temperatureC.toFixed(1)} °C, ${z.co2Ppm} ppm CO₂ — flagged for attention.`),
      `Site average temperature ${state.bms.avgTemperatureC.toFixed(1)} °C, humidity ${state.bms.humidityPct}%, AQI ${state.bms.airQualityIndex}.`,
    ],
    assets: flagged.map((a) => ({ kind: 'bms' as const, id: a.id, label: a.id })),
  }
}

function changeAnalysis(state: SimulationState): CopilotAnswer {
  const history = state.history
  if (history.length < 10) {
    return { headline: 'Not enough history yet — the simulation has only just started.', findings: [], assets: [] }
  }

  const now = history[history.length - 1]
  const then = history[Math.max(0, history.length - 60)]
  const delta = (a: number, b: number) => {
    const d = a - b
    const sign = d > 0 ? '+' : ''
    return `${sign}${d.toFixed(1)}`
  }

  return {
    headline: `Comparing now against ${history.length >= 60 ? 'a minute ago' : 'the start of the session'}.`,
    findings: [
      `OEE ${now.oeePct.toFixed(1)}% (${delta(now.oeePct, then.oeePct)} pts).`,
      `Production rate ${now.productionRatePerMin.toFixed(1)}/min (${delta(now.productionRatePerMin, then.productionRatePerMin)}).`,
      `Energy demand ${now.energyDemandMw.toFixed(2)} MW (${delta(now.energyDemandMw, then.energyDemandMw)}).`,
      `Equipment health ${now.equipmentHealthScore.toFixed(1)} (${delta(now.equipmentHealthScore, then.equipmentHealthScore)}).`,
      `Critical alerts ${now.criticalAlerts} (was ${then.criticalAlerts}).`,
    ],
    assets: [],
  }
}

function qualityAnalysis(state: SimulationState): CopilotAnswer {
  const ranked = [...state.lines].filter((l) => l.status === 'running' || l.status === 'warning').sort((a, b) => a.qualityPct - b.qualityPct)
  const worst = ranked[0]
  return {
    headline: worst ? `${worst.name} has the lowest quality rate at ${worst.qualityPct.toFixed(1)}%.` : 'No running lines to assess.',
    findings: [
      `Site quality rate is ${state.kpis.oeeQualityPct.toFixed(1)}%.`,
      ...ranked.slice(0, 4).map((l) => `${l.name}: ${l.qualityPct.toFixed(1)}% quality, ${l.performancePct.toFixed(1)}% performance, ${l.status}.`),
    ],
    assets: ranked.slice(0, 3).map((l) => ({ kind: 'line' as const, id: l.id, label: l.name })),
  }
}

function materialsAnalysis(state: SimulationState): CopilotAnswer {
  const { materials, suppliers, purchaseOrders, inboundShipments } = state.materials
  const low = materials.filter((m) => m.stockLevel < m.reorderLevel)
  const delayedSuppliers = suppliers.filter((s) => s.delayedOrders > 0)
  const pendingPOs = purchaseOrders.filter((p) => p.status !== 'received' && p.status !== 'draft')
  const delayedShipments = inboundShipments.filter((s) => s.status === 'delayed')

  return {
    headline:
      low.length > 0
        ? `${low.length} material${low.length > 1 ? 's are' : ' is'} below reorder level.`
        : delayedSuppliers.length > 0
          ? `Stock is healthy, but ${delayedSuppliers.length} supplier${delayedSuppliers.length > 1 ? 's have' : ' has'} delayed orders.`
          : 'All materials are above their reorder levels and no suppliers are delayed.',
    findings: [
      ...low.slice(0, 6).map((m) => `${m.name}: ${m.stockLevel.toFixed(0)} ${m.unit} of ${m.capacity} capacity (reorder at ${m.reorderLevel}) in ${m.warehouseZone}.`),
      `${pendingPOs.length} purchase order${pendingPOs.length === 1 ? '' : 's'} pending across all suppliers.`,
      ...(delayedSuppliers.length > 0
        ? [`Delayed suppliers: ${delayedSuppliers.map((s) => `${s.name} (${s.delayedOrders} order${s.delayedOrders > 1 ? 's' : ''}, ${s.onTimePct.toFixed(0)}% on-time)`).join(', ')}.`]
        : []),
      ...(delayedShipments.length > 0 ? [`Delayed inbound shipments: ${delayedShipments.map((s) => `${s.truck} at ${s.gate}`).join(', ')}.`] : []),
    ],
    assets: [{ kind: 'building' as const, id: 'BLD-WARE', label: 'Warehouse' }],
  }
}

function safetyAnalysis(state: SimulationState): CopilotAnswer {
  const { safetySecurity, safetyExtra } = state
  const concerns: string[] = []
  if (safetySecurity.activeSafetyIncidents > 0) concerns.push(`${safetySecurity.activeSafetyIncidents} active safety incident${safetySecurity.activeSafetyIncidents > 1 ? 's are' : ' is'} open and unresolved.`)
  if (safetySecurity.nearMisses > 0) concerns.push(`${safetySecurity.nearMisses} near miss${safetySecurity.nearMisses > 1 ? 'es have' : ' has'} been logged this session.`)
  if (safetyExtra.emergencyEventsActive > 0) concerns.push(`${safetyExtra.emergencyEventsActive} emergency event${safetyExtra.emergencyEventsActive > 1 ? 's are' : ' is'} currently active.`)
  if (safetyExtra.fireDetectionStatus !== 'Normal') concerns.push(`Fire detection status is ${safetyExtra.fireDetectionStatus}.`)
  if (safetyExtra.inspectionStatus !== 'Up to date') concerns.push(`Safety inspection status is ${safetyExtra.inspectionStatus}.`)
  if (safetyExtra.ppeCompliancePct < 95) concerns.push(`PPE compliance is ${safetyExtra.ppeCompliancePct.toFixed(0)}%, below the 95% target.`)

  return {
    headline:
      concerns.length > 0
        ? `${concerns.length} safety item${concerns.length > 1 ? 's need' : ' needs'} attention.`
        : `Safety is normal — no open incidents, ${safetyExtra.ppeCompliancePct.toFixed(0)}% PPE compliance, inspections ${safetyExtra.inspectionStatus.toLowerCase()}.`,
    findings:
      concerns.length > 0
        ? concerns
        : [`Compliance score is ${safetyExtra.complianceScorePct.toFixed(0)}%.`, `Fire detection is ${safetyExtra.fireDetectionStatus}.`],
    assets: [],
  }
}

function securityAnalysis(state: SimulationState): CopilotAnswer {
  const { security, safetySecurity } = state
  const restricted = security.accessEvents.filter((e) => e.decision !== 'granted')
  const tailgates = security.accessEvents.filter((e) => e.decision === 'tailgate')
  const camerasOffline = security.cameras.filter((c) => c.status === 'offline')

  return {
    headline:
      safetySecurity.accessViolations > 0
        ? `${safetySecurity.accessViolations} confirmed access violation${safetySecurity.accessViolations > 1 ? 's' : ''} this session — security needs review.`
        : `Access control is normal — ${security.employeesInside} employees and ${security.visitors} visitors currently on site.`,
    findings: [
      `${security.employeesInside} employees and ${security.visitors} registered visitors are currently on site.`,
      `${security.doorsOpen} of ${security.doorsTotal} monitored doors are open.`,
      `${security.accessEvents.length} access events in the current rolling log, ${restricted.length} denied or tailgate.`,
      ...(tailgates.length > 0 ? [`Tailgate events: ${tailgates.map((e) => `${e.person} at ${e.door} (${e.at})`).join(', ')}.`] : []),
      `${camerasOffline.length} of ${security.cameras.length} cameras offline.`,
    ],
    assets: [],
  }
}

/**
 * "What happens if X fails" — routed through the same cross-module cascade
 * engine the Simulation module uses, so the assistant's answer and the
 * scenario runner's answer to the same question are the same answer, not
 * two independently-worded guesses.
 */
function impactAnalysis(state: SimulationState, question: string): CopilotAnswer {
  // Name an asset explicitly ("what if EQUIPMENT-005 fails") or fall back to
  // the asset most worth asking about: the one in worst condition.
  const equipment = Object.values(state.equipment)
  const idMatch = question.toUpperCase().match(/EQUIPMENT[- ]?(\d+)/)
  const named = idMatch ? equipment.find((e) => e.id.endsWith(idMatch[1].padStart(3, '0'))) : null
  const target = named ?? [...equipment].sort((a, b) => a.health - b.health)[0]
  if (!target) return { headline: 'No equipment is registered in this facility.', findings: [], assets: [] }

  const hoursMatch = question.match(/(\d+)\s*(?:h|hour)/i)
  const hours = hoursMatch ? Math.min(24, Math.max(1, Number.parseInt(hoursMatch[1], 10))) : 4
  const cascade = deriveCascade(state, { type: 'EQUIPMENT_FAILURE', equipmentId: target.id, downtimeHours: hours })

  return {
    headline: cascade.summary,
    findings: [
      `What is happening: ${cascade.whatIsHappening}`,
      `Why: ${cascade.whyIsItHappening}`,
      `What happens next: ${cascade.whatWillHappenNext}`,
      `Recommended: ${cascade.whatShouldWeDo}`,
      ...cascade.impacts.filter((i) => i.severity !== 'info').map((i) => `${MODULE_LABEL[i.module]} — ${i.headline}.`),
    ],
    assets: [{ kind: 'equipment' as const, id: target.id, label: target.id }],
  }
}

/* -------------------------------------------------------------- routing -- */

const INTENTS: Intent[] = [
  { id: 'impact', keywords: ['what if', 'what happens if', 'impact of', 'consequence', 'knock-on', 'ripple', 'scenario', 'simulate'], run: impactAnalysis },
  { id: 'attention', keywords: ['attention', 'wrong', 'problem', 'issue', 'urgent', 'focus on'], run: attentionAnalysis },
  { id: 'risk', keywords: ['risk', 'fail', 'degrad', 'trending', 'about to', 'predict'], run: riskAnalysis },
  { id: 'vibration', keywords: ['vibration', 'vibrat', 'bearing'], run: vibrationAnalysis },
  { id: 'downtime', keywords: ['downtime', 'stopped', 'stoppage', 'outage'], run: downtimeAnalysis },
  { id: 'maintenance', keywords: ['maintenance', 'service', 'work order', 'repair', 'overhaul'], run: maintenanceAnalysis },
  { id: 'energy', keywords: ['energy', 'power', 'consumption', 'electricity', 'kw', 'mw'], run: energyAnalysis },
  { id: 'alerts', keywords: ['alert', 'alarm', 'critical'], run: alertAnalysis },
  { id: 'bms', keywords: ['bms', 'hvac', 'building service', 'chiller', 'ahu', 'air handling', 'temperature', 'humidity', 'co2'], run: bmsAnalysis },
  { id: 'change', keywords: ['change', 'last few minutes', 'recently', 'since', 'trend'], run: changeAnalysis },
  { id: 'quality', keywords: ['quality', 'defect', 'reject', 'scrap'], run: qualityAnalysis },
  {
    id: 'materials',
    keywords: ['material', 'stock', 'inventory', 'warehouse', 'reorder', 'delivery', 'supplier', 'purchase order', 'procurement', 'shipment'],
    run: materialsAnalysis,
  },
  { id: 'production', keywords: ['production', 'output', 'oee', 'throughput', 'decreas', 'target', 'efficiency', 'line'], run: productionAnalysis },
  { id: 'safety', keywords: ['safety', 'incident', 'near miss', 'ppe', 'fire', 'emergency', 'compliance', 'inspection status'], run: safetyAnalysis },
  { id: 'security', keywords: ['security', 'visitor', 'door', 'badge', 'access', 'gate', 'camera', 'cctv', 'tailgate', 'employees inside'], run: securityAnalysis },
]

/** Suggested prompts shown as starting points; each maps to a real analysis. */
export const COPILOT_SUGGESTIONS = [
  'What requires my attention?',
  'Which equipment is at risk?',
  'Why has production decreased?',
  'Which line has the highest downtime?',
  'Which equipment requires maintenance?',
  'Where are we consuming excessive energy?',
  'What are the critical alerts?',
  'What changed in the last few minutes?',
  'Show me equipment with abnormal vibration.',
  'How are the building services performing?',
  'Are there any open safety incidents?',
  'Any security concerns right now?',
  'Are any suppliers delayed?',
  'What happens if the worst asset fails for 4 hours?',
]

/**
 * Routes a question to an analysis and runs it against the current state.
 * Matching is scored by how many of an intent's keywords appear, so a
 * question touching several topics lands on its dominant one.
 */
export function answer(question: string, state: SimulationState): CopilotAnswer {
  const q = question.toLowerCase()

  let best: { intent: Intent; score: number } | null = null
  for (const intent of INTENTS) {
    const score = intent.keywords.reduce((n, k) => (q.includes(k) ? n + 1 : n), 0)
    if (score > 0 && (!best || score > best.score)) best = { intent, score }
  }

  if (!best) {
    // No match: give the operator the state summary rather than an apology.
    const att = attentionAnalysis(state)
    return {
      headline: "I can answer from the facility's live state — here's the current picture.",
      findings: [
        `Facility health ${state.kpis.systemHealthPct.toFixed(1)}%, OEE ${state.kpis.oeePct.toFixed(1)}%, ${state.kpis.linesRunning}/${state.kpis.linesTotal} lines running.`,
        `${state.kpis.equipmentRunning}/${state.kpis.equipmentTotal} equipment running, drawing ${state.energy.currentDemandMw.toFixed(2)} MW.`,
        ...att.findings.slice(0, 3),
        'Try asking about attention, risk, downtime, maintenance, energy, alerts, quality, materials, suppliers, safety, security or building services.',
      ],
      assets: att.assets.slice(0, 3),
      fallback: true,
    }
  }

  return best.intent.run(state, question)
}

/**
 * Compact snapshot of the facility, kept here as the context payload a real
 * model API would be handed in place of the local analyses above.
 */
export function buildFacilityBriefing(state: SimulationState): string {
  const att = state.attention.map((a) => `${a.equipmentId}:${a.status}`).join(',')
  return [
    `health=${state.kpis.systemHealthPct.toFixed(1)}`,
    `oee=${state.kpis.oeePct.toFixed(1)}`,
    `lines=${state.kpis.linesRunning}/${state.kpis.linesTotal}`,
    `equipment=${state.kpis.equipmentRunning}/${state.kpis.equipmentTotal}`,
    `energyMw=${state.energy.currentDemandMw.toFixed(2)}`,
    `criticalAlerts=${state.safetySecurity.criticalAlerts}`,
    `attention=[${att}]`,
  ].join(' ')
}
