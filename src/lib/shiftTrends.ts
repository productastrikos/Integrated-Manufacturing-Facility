import type { SimulationState } from '../simulation/types'
import { getCurrentShift, SHIFT_BUCKET_MINUTES, type Shift } from './shiftSchedule'

export type ShiftTrendPoint = { label: string; value: number }

export type ShiftTrends = {
  shift: Shift
  /** Units-produced rate, expressed per hour — each bucket's real delta scaled up from its actual 5-minute width. */
  productionPerHour: ShiftTrendPoint[]
  /** Mean OEE% sampled every tick each bucket was open. */
  oeePerHour: ShiftTrendPoint[]
  /** Downtime-minutes rate, expressed per hour — each bucket's real accrued downtime scaled up the same way. */
  downtimePerHour: ShiftTrendPoint[]
  /** Same real per-hour unit rate as production — a rate view of the same figure, not an independent number. */
  throughputPerHour: ShiftTrendPoint[]
}

const HOUR_SCALE = 60 / SHIFT_BUCKET_MINUTES

/**
 * Turns the engine's real, tick-by-tick `shiftHourly` buckets (see
 * `tickShiftHourly` in simulationEngine.ts) into the four Trends charts'
 * data. Every point here is a genuine accumulation from this session's own
 * ticks — nothing is backfilled or estimated, which also means a bucket
 * only exists once the session has actually lived through that slice of
 * the shift. Each bucket is only `SHIFT_BUCKET_MINUTES` wide, so its raw
 * delta is scaled up to an hourly rate (what the "/hour" figures ask for)
 * rather than displayed as a tiny 5-minute total. Buckets from an earlier
 * shift (a session left open across a shift change) are excluded, so a
 * chart only ever shows the shift it's titled "Current Shift" for.
 */
export function shiftHourlyTrends(state: SimulationState, now: Date = new Date()): ShiftTrends {
  const shift = getCurrentShift(now)
  const buckets = state.shiftHourly.filter((b) => b.shiftId === shift.id)

  const productionPerHour = buckets.map((b) => ({ label: b.label, value: Math.max(0, b.outputEnd - b.outputStart) * HOUR_SCALE }))
  const oeePerHour = buckets.map((b) => ({ label: b.label, value: b.oeeSamples > 0 ? Math.round((b.oeeSum / b.oeeSamples) * 10) / 10 : 0 }))
  const downtimePerHour = buckets.map((b) => ({ label: b.label, value: Math.round(Math.max(0, b.downtimeEnd - b.downtimeStart) * HOUR_SCALE * 10) / 10 }))

  return { shift, productionPerHour, oeePerHour, downtimePerHour, throughputPerHour: productionPerHour }
}
