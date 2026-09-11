import { useSyncExternalStore } from 'react'
import { simulationEngine } from '../simulation/simulationEngine'
import type { UtilityKey } from './utilityInfo'

/**
 * 1-minute-bucketed pressure history for the four site utilities — same
 * derived-cache pattern as `equipmentHistory.ts` and `siteMetricHistory.ts`.
 * Pressure is the metric that actually signals a supply problem (flow just
 * tracks demand), and it moves slowly enough that a 1-minute bucket over
 * hours reads as a real trend rather than tick noise.
 */

const BUCKET_MINUTES = 1
const MAX_BUCKETS = 240 // 4 hours

const UTILITY_KEYS: UtilityKey[] = ['water', 'gas', 'compressedAir', 'steam']

type RawBucket = { bucketIndex: number; label: string; sum: number; samples: number }
export type PressurePoint = { label: string; value: number }

function clockLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

class UtilityPressureHistoryStore {
  private history: Record<UtilityKey, RawBucket[]> = { water: [], gas: [], compressedAir: [], steam: [] }
  private derivedCache: Record<UtilityKey, PressurePoint[]> = { water: [], gas: [], compressedAir: [], steam: [] }
  private derivedFrom: Record<UtilityKey, RawBucket[]> = { water: [], gas: [], compressedAir: [], steam: [] }
  private listeners = new Set<() => void>()
  private unsubscribeEngine: (() => void) | null = null
  private lastTick = -1

  private ensureSubscribed() {
    if (this.unsubscribeEngine) return
    this.unsubscribeEngine = simulationEngine.subscribe(() => {
      const snap = simulationEngine.getSnapshot()
      if (snap.tick === this.lastTick) return
      this.lastTick = snap.tick

      const now = new Date()
      const bucketMs = BUCKET_MINUTES * 60_000
      const bucketIndex = Math.floor(now.getTime() / bucketMs)

      for (const key of UTILITY_KEYS) {
        const pressure = snap.utilities[key].pressureBar
        const prev = this.history[key]
        const last = prev[prev.length - 1]
        if (last && last.bucketIndex === bucketIndex) {
          this.history[key] = [...prev.slice(0, -1), { ...last, sum: last.sum + pressure, samples: last.samples + 1 }]
        } else {
          const bucketStart = new Date(bucketIndex * bucketMs)
          const fresh: RawBucket = { bucketIndex, label: clockLabel(bucketStart), sum: pressure, samples: 1 }
          const next = [...prev, fresh]
          this.history[key] = next.length > MAX_BUCKETS ? next.slice(-MAX_BUCKETS) : next
        }
      }
      this.notify()
    })
  }

  private notify = () => {
    for (const l of this.listeners) l()
  }

  subscribe = (cb: () => void) => {
    this.ensureSubscribed()
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getSnapshotFor = (key: UtilityKey): PressurePoint[] => {
    this.ensureSubscribed()
    const buckets = this.history[key]
    if (this.derivedFrom[key] === buckets) return this.derivedCache[key]
    const derived = buckets.map((b) => ({ label: b.label, value: b.samples > 0 ? b.sum / b.samples : 0 }))
    this.derivedFrom[key] = buckets
    this.derivedCache[key] = derived
    return derived
  }
}

const store = new UtilityPressureHistoryStore()

export function useUtilityPressureHistory(key: UtilityKey): PressurePoint[] {
  return useSyncExternalStore(store.subscribe, () => store.getSnapshotFor(key))
}
