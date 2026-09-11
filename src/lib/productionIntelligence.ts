import type { Equipment, ProductionLine, SimulationState, SiteKpis } from '../simulation/types'
import { lineRatePerMin } from './factoryEvents'

/**
 * Production-floor formulas shared between the Production & Operations
 * module and anything else that needs to answer the same questions (a
 * cascade, an AI advisory, a future scenario). Every figure here is derived
 * from live equipment and line state — nothing is a fixed lookup table or a
 * random number, so it moves the moment the underlying condition does.
 *
 * Two things this file deliberately does NOT compute, because nothing in
 * the simulation backs them with a real number: a financial value for lost
 * production (no unit price or margin exists for finished goods, only for
 * raw materials) and a discrete work-order/shift schedule (no such entity
 * exists yet — only equipment-driven maintenance work orders do). Showing
 * either would be a fabricated figure dressed as a real one.
 */

const NOMINAL_CYCLE_SEC = 26

export type DowntimeCause = 'Mechanical Failure' | 'Electrical Failure' | 'Material Shortage' | 'Planned Maintenance' | 'Minor Stops'

/**
 * A line's downtime is a single aggregate number in the simulation — there
 * is no logged cause taxonomy. This infers the most likely cause from the
 * real condition actually driving the stoppage (which equipment is at
 * fault and how, or whether a feeding material is out) rather than
 * assigning an arbitrary category, so "why" traces back to a real reading.
 */
export function inferDowntimeCause(state: SimulationState, line: ProductionLine): DowntimeCause {
  const equipment = line.equipmentIds.map((id) => state.equipment[id]).filter((e): e is Equipment => !!e)
  const starved = state.materials.materials.some((m) => m.productionLines.includes(line.id) && m.stockLevel <= 0)
  if (starved) return 'Material Shortage'
  if (equipment.some((e) => e.status === 'maintenance')) return 'Planned Maintenance'
  if (equipment.some((e) => e.scripted === 'drift-vibration')) return 'Mechanical Failure'
  if (equipment.some((e) => e.scripted === 'drift-temperature')) return 'Electrical Failure'
  if (equipment.some((e) => e.status === 'critical' || e.status === 'offline')) return 'Mechanical Failure'
  return 'Minor Stops'
}

export type ParetoEntry = { cause: DowntimeCause; minutes: number; incidentCount: number; lines: string[] }

/** Downtime minutes grouped by inferred cause, worst first — the Pareto view. */
export function downtimePareto(state: SimulationState): ParetoEntry[] {
  const byCause = new Map<DowntimeCause, ParetoEntry>()
  for (const line of state.lines) {
    if (line.downtimeMinutes <= 0) continue
    const cause = inferDowntimeCause(state, line)
    const entry = byCause.get(cause) ?? { cause, minutes: 0, incidentCount: 0, lines: [] }
    entry.minutes += line.downtimeMinutes
    entry.incidentCount += 1
    entry.lines.push(line.id)
    byCause.set(cause, entry)
  }
  return [...byCause.values()].sort((a, b) => b.minutes - a.minutes)
}

export type ProductionLoss = { downtimeMin: number; lostUnits: number; targetImpactPct: number }

/** Downtime → lost units → target impact, the same rate math the cross-module cascade engine uses for an equipment failure — so a line's current loss and "what if it fails" both trace to one formula. */
export function productionLoss(state: SimulationState, line: ProductionLine): ProductionLoss {
  const { rate } = lineRatePerMin(state, line.id)
  const lostUnits = rate * line.downtimeMinutes
  const targetImpactPct = state.kpis.targetUnits > 0 ? (lostUnits / state.kpis.targetUnits) * 100 : 0
  return { downtimeMin: line.downtimeMinutes, lostUnits, targetImpactPct }
}

export type CycleTimeStats = { idealSec: number; averageSec: number; currentSec: number; variancePct: number }

/**
 * Cycle time isn't a field the simulation stores — it's the inverse of
 * performance against the same nominal cycle every line's performancePct
 * is itself computed against, so "current" and "average" both stay
 * consistent with the Performance figure shown everywhere else.
 */
export function cycleTimeStats(lines: ProductionLine[]): CycleTimeStats {
  const running = lines.filter((l) => l.status === 'running' || l.status === 'warning')
  if (running.length === 0) return { idealSec: NOMINAL_CYCLE_SEC, averageSec: NOMINAL_CYCLE_SEC, currentSec: NOMINAL_CYCLE_SEC, variancePct: 0 }
  const secs = running.map((l) => NOMINAL_CYCLE_SEC / Math.max(0.2, l.performancePct / 100))
  const averageSec = secs.reduce((a, b) => a + b, 0) / secs.length
  // "Current" reads the single worst-performing running line — the one an
  // operator watching the floor right now would actually be worried about.
  const currentSec = Math.max(...secs)
  return { idealSec: NOMINAL_CYCLE_SEC, averageSec, currentSec, variancePct: ((averageSec - NOMINAL_CYCLE_SEC) / NOMINAL_CYCLE_SEC) * 100 }
}

/** Per-line cycle time, for the distribution chart — same formula as cycleTimeStats, one point per running line. */
export function lineCycleTimeSec(line: ProductionLine): number {
  return NOMINAL_CYCLE_SEC / Math.max(0.2, line.performancePct / 100)
}

export type LineQuality = { totalUnits: number; goodUnits: number; rejectedUnits: number; qualityPct: number }

/** A line's units split into good/rejected by its own live quality percentage — the same number the OEE quality factor and the Quality module both read. */
export function lineQualityBreakdown(line: ProductionLine): LineQuality {
  const totalUnits = Math.round(line.outputUnits)
  const goodUnits = Math.round(line.outputUnits * (line.qualityPct / 100))
  return { totalUnits, goodUnits, rejectedUnits: totalUnits - goodUnits, qualityPct: line.qualityPct }
}

/** A line's own OEE — Availability × Performance × Quality — the one formula every OEE figure in the app is computed from. */
export function lineOee(line: ProductionLine): number {
  return (line.availabilityPct / 100) * (line.performancePct / 100) * (line.qualityPct / 100) * 100
}

export type OeeFactor = 'availability' | 'performance' | 'quality'

/** Which OEE factor is currently doing the most damage — the single shared answer to "why is OEE what it is", read by Sia, the OEE decomposition panel and the AI advisory alike. */
export function bindingOeeConstraint(kpis: SiteKpis): { factor: OeeFactor; label: string } {
  if (kpis.oeeAvailabilityPct <= kpis.oeePerformancePct && kpis.oeeAvailabilityPct <= kpis.oeeQualityPct) {
    return { factor: 'availability', label: 'Availability — lines are stopped or unavailable' }
  }
  if (kpis.oeePerformancePct <= kpis.oeeQualityPct) {
    return { factor: 'performance', label: 'Performance — lines are running below rate' }
  }
  return { factor: 'quality', label: 'Quality — more output is being rejected' }
}
