import type { SimulationState } from '../simulation/types'
import { getCurrentShift, shiftClockLabel, type Shift } from './shiftSchedule'

export type ShiftPoint = {
  time: Date
  label: string
  /** The planned cumulative total at this point in the shift — a real, known-in-advance figure. */
  targetUnits: number
  /** The actual cumulative total, or null for a point in the shift that hasn't happened yet. */
  actualUnits: number | null
}

export type ShiftProductionSeries = {
  shift: Shift
  points: ShiftPoint[]
  elapsedFraction: number
  currentRatePerMin: number
  rateBasis: 'measured' | 'planned'
  remainingUnits: number
  projectedMinutesToTarget: number
}

/**
 * Reconstructs a shift-clock cumulative production trajectory from live
 * state. The Target line is a real plan, not an estimate: the shift's unit
 * target spread evenly from shift start to shift end.
 *
 * The Actual line has exactly one ground-truth point — "now", read straight
 * off `state.kpis.outputUnits`. The simulation engine keeps a 90-second
 * rolling window rather than a full per-hour shift log, so earlier points
 * on the Actual line are reconstructed by scaling the Target curve's shape
 * to pass through that one real point (proportional interpolation, not a
 * random or hardcoded backfill) — it self-corrects every tick as the real
 * total changes, and always ends exactly on the true current output.
 *
 * Swap this reconstruction for a real per-hour production log (or a
 * backend API) later without touching the chart: it only ever consumes
 * `points`.
 */
export function buildShiftProductionSeries(state: SimulationState, now: Date = new Date()): ShiftProductionSeries {
  const shift = getCurrentShift(now)
  const totalMinutes = shift.hours * 60
  const elapsedMinutes = clamp((now.getTime() - shift.start.getTime()) / 60_000, 0, totalMinutes)
  const elapsedFraction = totalMinutes > 0 ? elapsedMinutes / totalMinutes : 0

  const targetUnits = state.kpis.targetUnits
  const actualNow = state.kpis.outputUnits

  const points: ShiftPoint[] = []
  for (let h = 0; h <= shift.hours; h++) {
    const time = new Date(shift.start.getTime() + h * 3_600_000)
    const fraction = h / shift.hours
    const target = Math.round(targetUnits * fraction)
    const actual = fraction <= elapsedFraction ? Math.round(elapsedFraction > 0 ? actualNow * (fraction / elapsedFraction) : 0) : null
    points.push({ time, label: shiftClockLabel(time), targetUnits: target, actualUnits: actual })
  }

  // A synthetic "now" marker so the Actual line visibly ends at the true
  // current total instead of stopping at the last full hour behind it.
  if (elapsedFraction > 0 && elapsedFraction < 1) {
    points.push({ time: now, label: shiftClockLabel(now), targetUnits: Math.round(targetUnits * elapsedFraction), actualUnits: actualNow })
    points.sort((a, b) => a.time.getTime() - b.time.getTime())
  }

  const rate = siteRatePerMin(state)
  const remainingUnits = Math.max(0, targetUnits - actualNow)
  const projectedMinutesToTarget = rate.rate > 0 ? remainingUnits / rate.rate : Infinity

  return { shift, points, elapsedFraction, currentRatePerMin: rate.rate, rateBasis: rate.basis, remainingUnits, projectedMinutesToTarget }
}

/**
 * Site-wide production rate — the same live, per-tick figure the engine
 * computes every second from actual line performance and quality (not an
 * accumulated total divided by elapsed time). Dividing the accumulated
 * total by elapsed session time looks appealing but is wrong here: the
 * simulation seeds each line with a plausible "already produced this
 * shift" baseline on load so a freshly opened session doesn't start at
 * zero, and that baseline isn't attributable to the few seconds the
 * session has actually been ticking — dividing by a small elapsed time
 * would read as a wildly inflated rate right after every page load.
 * Falls back to the shift's planned rate only on the very first tick,
 * before the engine has produced a single measured sample.
 */
export function siteRatePerMin(state: SimulationState): { rate: number; basis: 'measured' | 'planned' } {
  const last = state.history[state.history.length - 1]
  if (last?.productionRatePerMin) return { rate: last.productionRatePerMin, basis: 'measured' }
  return { rate: state.kpis.targetUnits / (8 * 60), basis: 'planned' }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
