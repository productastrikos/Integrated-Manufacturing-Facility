/**
 * The one place shift boundaries are defined, so "the current shift" means
 * the same window everywhere it's read — a chart, a KPI, or a report.
 *
 * Three fixed 8-hour shifts covering the full day, matching the 8-hour
 * shift length already assumed by `SHIFT_MINUTES` in factoryEvents.ts (the
 * site's unit target is a per-shift figure, not a per-day one). Detecting
 * "now"'s shift from a list rather than hardcoding a single 08:00-16:00
 * window means a second or third shift can be added here later without
 * touching anything that calls `getCurrentShift`.
 */
export type Shift = {
  id: string
  label: string
  start: Date
  end: Date
  hours: number
}

const SHIFT_LENGTH_HOURS = 8

/** Width of one Trends-panel data bucket — real minutes, not an arbitrary tick count. See `tickShiftHourly` in simulationEngine.ts. */
export const SHIFT_BUCKET_MINUTES = 5
// Minutes-since-midnight each shift starts, ascending and covering the
// full 24 hours with no gaps.
const SHIFT_STARTS_MIN = [0, 480, 960] as const
const SHIFT_LABELS = ['Night Shift', 'Day Shift', 'Evening Shift']

export function getCurrentShift(now: Date = new Date()): Shift {
  const minutesOfDay = now.getHours() * 60 + now.getMinutes()
  let idx = SHIFT_STARTS_MIN.findIndex((startMin, i) => {
    const nextMin = SHIFT_STARTS_MIN[i + 1] ?? 24 * 60
    return minutesOfDay >= startMin && minutesOfDay < nextMin
  })
  if (idx === -1) idx = SHIFT_STARTS_MIN.length - 1

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setMinutes(SHIFT_STARTS_MIN[idx])

  const end = new Date(start.getTime() + SHIFT_LENGTH_HOURS * 3_600_000)

  return { id: `shift-${idx}`, label: SHIFT_LABELS[idx], start, end, hours: SHIFT_LENGTH_HOURS }
}

export function shiftClockLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}
