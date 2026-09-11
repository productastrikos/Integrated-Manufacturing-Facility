import { useSyncExternalStore } from 'react'
import { simulationEngine } from '../simulation/simulationEngine'

/**
 * A bounded, 1-minute-bucketed sensor history per equipment unit, for the
 * Digital Twin's info panel charts.
 *
 * This is NOT a second simulation engine — it generates no values of its
 * own. It is a read-only derived cache: it subscribes to the same
 * `simulationEngine` Phase 1 already runs, and on every tick it folds that
 * tick's temperature/vibration/power/health for each equipment unit into
 * the currently-open 1-minute bucket for that unit — not a raw per-second
 * sample — so a chart reading from here plots "the last four hours", not
 * "the last 60 ticks", and the x-axis can be labeled in real minutes.
 *
 *   Simulation Engine → Shared State → (this cache) → Digital Twin charts
 *                                    → React Dashboard
 */

const BUCKET_MINUTES = 1
const MAX_BUCKETS = 240 // 4 hours at 1-minute resolution

export type SensorBucket = { label: string; temperatureC: number; vibrationMmS: number; powerKw: number; health: number }

type RawBucket = { bucketIndex: number; label: string; sums: { temperatureC: number; vibrationMmS: number; powerKw: number; health: number }; samples: number }

function clockLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

class EquipmentHistoryStore {
  private history: Record<string, RawBucket[]> = {}
  // useSyncExternalStore requires getSnapshot to return a referentially
  // stable value when nothing changed — these caches hold the last derived
  // (averaged) array per equipment id, invalidated only when that id's raw
  // buckets actually got a new array reference this tick.
  private derivedCache: Record<string, SensorBucket[]> = {}
  private derivedFrom: Record<string, RawBucket[]> = {}
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

      for (const id in snap.equipment) {
        const eq = snap.equipment[id]
        const prev = this.history[id] ?? EMPTY
        const last = prev[prev.length - 1]

        if (last && last.bucketIndex === bucketIndex) {
          const updated: RawBucket = {
            ...last,
            sums: {
              temperatureC: last.sums.temperatureC + eq.temperatureC,
              vibrationMmS: last.sums.vibrationMmS + eq.vibrationMmS,
              powerKw: last.sums.powerKw + eq.powerKw,
              health: last.sums.health + eq.health,
            },
            samples: last.samples + 1,
          }
          this.history[id] = [...prev.slice(0, -1), updated]
        } else {
          const bucketStart = new Date(bucketIndex * bucketMs)
          const fresh: RawBucket = {
            bucketIndex,
            label: clockLabel(bucketStart),
            sums: { temperatureC: eq.temperatureC, vibrationMmS: eq.vibrationMmS, powerKw: eq.powerKw, health: eq.health },
            samples: 1,
          }
          const next = [...prev, fresh]
          this.history[id] = next.length > MAX_BUCKETS ? next.slice(-MAX_BUCKETS) : next
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

  getSnapshotFor = (id: string): SensorBucket[] => {
    this.ensureSubscribed()
    const buckets = this.history[id] ?? EMPTY
    if (this.derivedFrom[id] === buckets) return this.derivedCache[id]
    const derived = buckets.map((b) => ({
      label: b.label,
      temperatureC: b.samples > 0 ? b.sums.temperatureC / b.samples : 0,
      vibrationMmS: b.samples > 0 ? b.sums.vibrationMmS / b.samples : 0,
      powerKw: b.samples > 0 ? b.sums.powerKw / b.samples : 0,
      health: b.samples > 0 ? b.sums.health / b.samples : 0,
    }))
    this.derivedFrom[id] = buckets
    this.derivedCache[id] = derived
    return derived
  }
}

const EMPTY: RawBucket[] = []
const store = new EquipmentHistoryStore()

export function useEquipmentHistory(id: string): SensorBucket[] {
  return useSyncExternalStore(store.subscribe, () => store.getSnapshotFor(id))
}
