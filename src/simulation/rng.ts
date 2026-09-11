/**
 * Deterministic PRNG (mulberry32). A fixed seed means every fresh page load
 * starts from the same facility state and plays out the same way — useful
 * for a repeatable demo, and for anyone diffing behaviour after a change.
 */
export function mulberry32(seed: number) {
  let s = seed
  return function next() {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Bounded random walk — moves partway toward a random target each call, never jumping. */
export function walkToward(rng: () => number, value: number, target: number, maxStep: number, noise: number) {
  const step = (target - value) * 0.12 + (rng() - 0.5) * noise
  return clamp(value + step, value - maxStep, value + maxStep)
}
