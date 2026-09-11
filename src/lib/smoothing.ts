/**
 * Centered moving average. Used purely for display — it never touches the
 * underlying live data, only the line drawn from it — so small per-tick
 * sensor jitter doesn't get amplified into a jagged square wave once the
 * chart auto-scales its Y-axis to a narrow range.
 */
export function movingAverage(data: number[], window = 3): number[] {
  if (data.length <= window) return data
  const half = Math.floor(window / 2)
  return data.map((_, i) => {
    const lo = Math.max(0, i - half)
    const hi = Math.min(data.length, i + half + 1)
    const slice = data.slice(lo, hi)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

/**
 * A Y-axis span with a sane floor. Without this, a metric that only moves
 * by hundredths of a unit gets auto-scaled so tightly that ordinary noise
 * fills the whole chart height — the "square wave" artifact.
 */
export function stableSpan(min: number, max: number): { min: number; max: number; span: number } {
  const mean = (min + max) / 2
  const raw = max - min
  const floor = Math.max(Math.abs(mean) * 0.05, 0.05)
  if (raw >= floor) return { min, max, span: raw }
  const pad = (floor - raw) / 2
  return { min: min - pad, max: max + pad, span: floor }
}
