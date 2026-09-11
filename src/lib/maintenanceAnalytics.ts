import type { SimulationState } from '../simulation/types'
import { deriveWorkOrders } from '../data/deriveMaintenance'
import { mulberry32, clamp } from '../simulation/rng'

export type TrendPoint = { label: string; value: number }

/**
 * Equipment Health Trend — real, tick-driven 10-minute buckets over a
 * rolling 24-hour window (see `tickHealthLog` in simulationEngine.ts).
 * Nothing here is backfilled: a fresh session only has the buckets it has
 * actually lived through, growing as the session runs.
 */
export function equipmentHealthTrend(state: SimulationState): TrendPoint[] {
  return state.healthLog.map((b) => ({ label: b.label, value: b.samples > 0 ? Math.round((b.sum / b.samples) * 10) / 10 : 0 }))
}

export type AssetHealthPoint = { id: string; name: string; health: number; lineId: string }

/** Equipment Health by Asset — real, the worst-scoring assets in the facility right now. */
export function equipmentHealthByAsset(state: SimulationState, count = 10): AssetHealthPoint[] {
  return Object.values(state.equipment)
    .slice()
    .sort((a, b) => a.health - b.health)
    .slice(0, count)
    .map((e) => ({ id: e.id, name: e.name, health: e.health, lineId: e.lineId }))
}

export type MtbfMttrPoint = { lineId: string; mtbfHours: number; mttrMinutes: number }

/**
 * MTBF/MTTR by line. MTBF uses each line's equipment's real, seeded
 * `operatingHours` (the same lifetime-runtime figure the Digital Twin's
 * equipment panel shows) averaged across the line's assets — genuine
 * accumulated runtime, not session-tick math that reads as ~0 for the
 * first few minutes after every page load. It keeps climbing in real
 * time too, since `operatingHours` itself increments every tick.
 *
 * MTTR uses each line's real accumulated `downtimeMinutes` this
 * session — genuinely 0 when nothing has stopped that line yet, which is
 * an honest "no repairs needed so far", not a rendering gap.
 */
export function mtbfMttrByLine(state: SimulationState): MtbfMttrPoint[] {
  return state.lines.map((l) => {
    const lineEquipment = l.equipmentIds.map((id) => state.equipment[id]).filter((e): e is (typeof state.equipment)[string] => !!e)
    const avgOperatingHours = lineEquipment.length ? lineEquipment.reduce((a, e) => a + e.operatingHours, 0) / lineEquipment.length : 0
    return {
      lineId: l.id,
      mtbfHours: Math.round(avgOperatingHours * 10) / 10,
      mttrMinutes: Math.round(l.downtimeMinutes * 10) / 10,
    }
  })
}

/**
 * A fixed-seed pseudo-random walk — used only to backfill chart history the
 * app has no real record of (a live session can't have lived through 7 real
 * days or several real weeks). Deterministic per seed, so it reads the same
 * way on every render within a session rather than jittering — and every
 * point built from it is explicitly flagged `simulated: true` so the UI can
 * (and does) label it as illustrative rather than passing it off as live
 * telemetry.
 */
function seededWalk(seed: number, n: number, min: number, max: number): number[] {
  const rng = mulberry32(seed)
  const out: number[] = []
  let v = (min + max) / 2
  for (let i = 0; i < n; i++) {
    v = clamp(v + (rng() - 0.5) * (max - min) * 0.35, min, max)
    out.push(Math.round(v))
  }
  return out
}

/**
 * One shared illustrative "trouble level" narrative, 27 days deep, that
 * both the daily Failure & Alarm Trend and the weekly Maintenance Workload
 * read their backfill from — so a rough patch two weeks ago shows up as
 * *both* more illustrative alarms in that window *and* more illustrative
 * corrective/emergency work that week, instead of two independently-seeded
 * charts that could tell contradictory stories about the same shift.
 *
 * Floored at the count of equipment carrying a real, persistent developing
 * fault (`scripted` in types.ts) — those assets have genuinely been a live
 * condition since the session opened, so no illustrative day is allowed to
 * show fewer alarms than are structurally already true right now. Index 0
 * is the oldest day (27 days ago); index 26 is yesterday.
 */
function troubleLevelSeries(state: SimulationState): number[] {
  const chronicCount = Object.values(state.equipment).filter((e) => e.scripted).length
  const rng = mulberry32(80808)
  const out: number[] = []
  let v = chronicCount + 1.5
  for (let i = 0; i < 27; i++) {
    v = clamp(v + (rng() - 0.5) * 2.2, chronicCount, chronicCount + 4)
    out.push(v)
  }
  return out
}

export type WorkloadWeek = { label: string; preventive: number; corrective: number; emergency: number; simulated: boolean }

/**
 * Maintenance Workload by week — this week is real, read live off
 * `deriveWorkOrders` (preventive / corrective / a critical-status
 * corrective order counted as "emergency"). Prior weeks have no real
 * record in a live session, so they're a clearly-flagged simulated
 * baseline — but corrective and emergency counts are driven off the same
 * `troubleLevelSeries` the alarm trend uses, so a week this chart shows as
 * heavier is the same week the alarm trend shows more alarms in. Preventive
 * stays on its own small independent seed, since scheduled maintenance
 * doesn't chase faults the way corrective/emergency work does.
 */
export function maintenanceWorkloadByWeek(state: SimulationState): WorkloadWeek[] {
  const orders = deriveWorkOrders(state)
  const thisWeek: WorkloadWeek = {
    label: 'This Week',
    preventive: orders.filter((o) => o.type === 'preventive').length,
    corrective: orders.filter((o) => o.type === 'corrective' && o.status !== 'critical').length,
    emergency: orders.filter((o) => o.status === 'critical').length,
    simulated: false,
  }
  const trouble = troubleLevelSeries(state)
  const prevPreventive = seededWalk(70301, 3, 1, 6)
  // Weeks 3/2/1-ago map onto the same 27-day narrative the alarm trend's
  // last 6 days sit at the tail of: [0..6], [7..13], [14..20].
  const priorWeeks: WorkloadWeek[] = [3, 2, 1].map((n, i) => {
    const week = trouble.slice(i * 7, i * 7 + 7)
    const avg = week.reduce((a, b) => a + b, 0) / week.length
    const peak = Math.max(...week)
    return {
      label: `${n} wk${n > 1 ? 's' : ''} ago`,
      preventive: prevPreventive[i],
      corrective: Math.round(clamp(avg * 1.1, 1, 6)),
      emergency: peak >= 5 ? (peak >= 6 ? 2 : 1) : 0,
      simulated: true,
    }
  })
  return [...priorWeeks, thisWeek]
}

export type FailurePoint = { label: string; count: number; simulated: boolean }

/**
 * Failure & Alarm Trend — today is real (equipment currently in a warning
 * or critical state). The prior six days sit at the tail of the same
 * `troubleLevelSeries` the weekly Maintenance Workload chart reads from, so
 * the two never disagree about which stretch of the recent past was rough.
 */
export function failureAlarmTrend(state: SimulationState): FailurePoint[] {
  const todayCount = Object.values(state.equipment).filter((e) => e.status === 'critical' || e.status === 'warning').length
  const series = troubleLevelSeries(state).slice(21, 27)
  const dayLabels = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday']
  const priorDays: FailurePoint[] = dayLabels.map((label, i) => ({ label, count: Math.round(series[i]), simulated: true }))
  return [...priorDays, { label: 'Today', count: todayCount, simulated: false }]
}
