import { useSyncExternalStore } from 'react'
import { simulationEngine } from '../simulation/simulationEngine'

/**
 * A bounded 1-minute-bucketed history of site-wide KPIs, for every "Trends"
 * chart across the app that isn't specific to one equipment unit or one
 * utility (those have their own bucketed caches — see `equipmentHistory.ts`
 * and the per-utility cache in BMS.tsx).
 *
 * This is a read-only derived cache, the same shape as `equipmentHistory.ts`:
 * it subscribes to the one simulation engine and, every tick, folds that
 * tick's KPI reading into the currently-open 1-minute bucket rather than
 * appending a new raw per-second sample. A chart reading from here gets a
 * real "value over the last N minutes" trend instead of 90 seconds of tick
 * noise — the bucket boundary is real wall-clock time, so the x-axis can be
 * labeled in minutes/wall-clock time and mean it.
 */

const BUCKET_MINUTES = 1
const MAX_BUCKETS = 240 // 4 hours at 1-minute resolution

export type SiteMetricKey =
  | 'oeePct'
  | 'qualityPct'
  | 'productionRatePerMin'
  | 'energyDemandMw'
  | 'equipmentHealthScore'
  | 'downtimeMinutes'
  | 'criticalAlerts'
  | 'buildingEnergyKw'
  | 'energyEfficiencyPct'
  | 'ppeCompliancePct'
  | 'complianceScorePct'

type Bucket = { bucketIndex: number; label: string; sums: Record<SiteMetricKey, number>; samples: number }

const ZERO_SUMS: Record<SiteMetricKey, number> = {
  oeePct: 0,
  qualityPct: 0,
  productionRatePerMin: 0,
  energyDemandMw: 0,
  equipmentHealthScore: 0,
  downtimeMinutes: 0,
  criticalAlerts: 0,
  buildingEnergyKw: 0,
  energyEfficiencyPct: 0,
  ppeCompliancePct: 0,
  complianceScorePct: 0,
}

function clockLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

class SiteMetricHistoryStore {
  private buckets: Bucket[] = []
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
      const reading: Record<SiteMetricKey, number> = {
        oeePct: snap.kpis.oeePct,
        qualityPct: snap.kpis.oeeQualityPct,
        productionRatePerMin: snap.history[snap.history.length - 1]?.productionRatePerMin ?? 0,
        energyDemandMw: snap.energy.currentDemandMw,
        equipmentHealthScore: snap.kpis.equipmentHealthScore,
        downtimeMinutes: snap.kpis.downtimeMinutes,
        criticalAlerts: snap.safetySecurity.criticalAlerts,
        buildingEnergyKw: snap.bms.buildingEnergyKw,
        energyEfficiencyPct: snap.energy.efficiencyPct,
        ppeCompliancePct: snap.safetyExtra.ppeCompliancePct,
        complianceScorePct: snap.safetyExtra.complianceScorePct,
      }

      const last = this.buckets[this.buckets.length - 1]
      if (last && last.bucketIndex === bucketIndex) {
        const sums = { ...last.sums }
        for (const k in reading) sums[k as SiteMetricKey] += reading[k as SiteMetricKey]
        this.buckets = [...this.buckets.slice(0, -1), { ...last, sums, samples: last.samples + 1 }]
      } else {
        const bucketStart = new Date(bucketIndex * bucketMs)
        const fresh: Bucket = { bucketIndex, label: clockLabel(bucketStart), sums: { ...ZERO_SUMS, ...reading }, samples: 1 }
        this.buckets = [...this.buckets, fresh].slice(-MAX_BUCKETS)
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

  getSnapshot = (): Bucket[] => {
    this.ensureSubscribed()
    return this.buckets
  }
}

const store = new SiteMetricHistoryStore()

export type SiteMetricPoint = { label: string; value: number }

/** Raw buckets, for callers that want more than one field per point. */
export function useSiteMetricBuckets() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/** A single metric's averaged series, ready to hand a chart as `data`. */
export function useSiteMetricSeries(key: SiteMetricKey): number[] {
  const buckets = useSiteMetricBuckets()
  return buckets.map((b) => (b.samples > 0 ? b.sums[key] / b.samples : 0))
}

/** Wall-clock label per bucket, same length/order as `useSiteMetricSeries`. */
export function useSiteMetricLabels(): string[] {
  const buckets = useSiteMetricBuckets()
  return buckets.map((b) => b.label)
}
