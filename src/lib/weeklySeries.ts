/** Deterministic PRNG seeded from a string, so the same KPI always bootstraps the same-looking week. */
function seededRng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export type WeeklyPoint = { t: number; v: number }

const HOURS = 24
const DAYS = 7
export const WEEKLY_POINTS = HOURS * DAYS // 168 hourly samples

/**
 * A plausible-looking 7-day hourly series ending at `currentValue`, with a
 * mild daily cycle (busier daytime, quieter overnight) plus noise scaled to
 * the metric's own magnitude — not a flat line, not random static.
 */
export function generateWeeklySeries(seedKey: string, currentValue: number): WeeklyPoint[] {
  const rng = seededRng(seedKey)
  const now = Date.now()
  const hourMs = 3_600_000

  const amplitude = Math.max(Math.abs(currentValue) * 0.06, 0.05)
  const noise = Math.max(Math.abs(currentValue) * 0.02, 0.01)
  // A small constant pull applied each step *backward* in time — since the
  // walk runs from now into the past, pulling down as it goes back reads,
  // once reversed into chronological order, as a steady week-long climb
  // up to today's live value rather than an arbitrary random direction.
  const drift = amplitude * 0.03

  // Walk backward from "now" so the series ends exactly at the live value,
  // then reverse into chronological order.
  const points: WeeklyPoint[] = []
  let v = currentValue
  for (let i = 0; i < WEEKLY_POINTS; i++) {
    const hourOfDay = ((WEEKLY_POINTS - i) % HOURS)
    const cycle = Math.sin((hourOfDay / HOURS) * Math.PI * 2 - Math.PI / 2) * amplitude * 0.5
    points.push({ t: now - i * hourMs, v: v + cycle })
    // gentle mean-reverting backward walk, biased to settle below today's value
    v = v + (rng() - 0.5) * noise * 2 - (v - currentValue) * 0.015 - drift
  }
  points.reverse()
  return points
}

/** Push a new live sample onto the end, dropping the oldest — keeps a fixed-width rolling window. */
export function appendLive(points: WeeklyPoint[], value: number): WeeklyPoint[] {
  const next = [...points.slice(1), { t: Date.now(), v: value }]
  return next
}

/**
 * A plausible daily-cadence series ending at `currentValue` — used for
 * inventory-level trend charts where the story is a slow multi-week drift
 * (consumption, restocks) rather than an intraday cycle. Each step is a
 * gentle mean-reverting nudge, never a hard jump, so the line reads as
 * real stock movement rather than noise.
 */
export function generateDailySeries(seedKey: string, currentValue: number, days = 30): WeeklyPoint[] {
  const rng = seededRng(seedKey)
  const now = Date.now()
  const dayMs = 86_400_000

  const noise = Math.max(Math.abs(currentValue) * 0.035, 0.5)
  const drift = noise * 0.15

  const points: WeeklyPoint[] = []
  let v = currentValue
  for (let i = 0; i < days; i++) {
    points.push({ t: now - i * dayMs, v: Math.max(0, v) })
    v = v + (rng() - 0.5) * noise * 2 - (v - currentValue) * 0.02 - drift
  }
  points.reverse()
  return points
}
