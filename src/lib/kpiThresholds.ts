/**
 * One place holding every KPI's warning/critical threshold, so a value
 * shown on a tile, a trend chart or a 7-day chart always means the same
 * thing everywhere it appears. `direction` says which way is bad:
 * 'above' for metrics where higher is worse (temperature, load, downtime),
 * 'below' for metrics where lower is worse (OEE, availability, quality).
 */
export type ThresholdDirection = 'above' | 'below'

export type KpiThreshold = {
  warning: number
  critical: number
  direction: ThresholdDirection
  unit?: string
}

export const KPI_THRESHOLDS = {
  achievement: { warning: 70, critical: 50, direction: 'below', unit: '%' },
  scheduleAdherence: { warning: 85, critical: 70, direction: 'below', unit: '%' },
  efficiency: { warning: 80, critical: 65, direction: 'below', unit: '%' },
  oee: { warning: 70, critical: 55, direction: 'below', unit: '%' },
  equipmentAvailability: { warning: 85, critical: 70, direction: 'below', unit: '%' },
  equipmentHealth: { warning: 75, critical: 60, direction: 'below', unit: '/100' },
  quality: { warning: 95, critical: 90, direction: 'below', unit: '%' },
  energyEfficiency: { warning: 80, critical: 65, direction: 'below', unit: '%' },
  energyDemand: { warning: 2.4, critical: 2.8, direction: 'above', unit: 'MW' },
  temperature: { warning: 80, critical: 90, direction: 'above', unit: '°C' },
  vibration: { warning: 3, critical: 5, direction: 'above', unit: 'mm/s' },
  airQuality: { warning: 50, critical: 100, direction: 'above', unit: 'AQI' },
  downtime: { warning: 15, critical: 30, direction: 'above', unit: 'min' },
  bmsLoad: { warning: 88, critical: 96, direction: 'above', unit: '%' },
  buildingEnergy: { warning: 800, critical: 900, direction: 'above', unit: 'kW' },
  avgTemperature: { warning: 26, critical: 30, direction: 'above', unit: '°C' },
  humidity: { warning: 60, critical: 70, direction: 'above', unit: '% RH' },
  co2: { warning: 800, critical: 1200, direction: 'above', unit: ' ppm' },
  criticalAlerts: { warning: 1, critical: 3, direction: 'above', unit: '' },
  defectRate: { warning: 3, critical: 5, direction: 'above', unit: '%' },
  ppeCompliance: { warning: 95, critical: 90, direction: 'below', unit: '%' },
  accessViolations: { warning: 1, critical: 3, direction: 'above', unit: '' },
  complianceScore: { warning: 85, critical: 75, direction: 'below', unit: '/100' },
} as const satisfies Record<string, KpiThreshold>

export type KpiThresholdKey = keyof typeof KPI_THRESHOLDS

/** Short caption for a KPI tile, e.g. "Warning ≥ 80°C · Critical ≥ 90°C". */
export function thresholdCaption(t: KpiThreshold): string {
  const cmp = t.direction === 'above' ? '≥' : '≤'
  const u = t.unit ?? ''
  return `Warning ${cmp} ${t.warning}${u} · Critical ${cmp} ${t.critical}${u}`
}

/**
 * Which zone a value currently sits in, per the threshold's direction.
 * Shared by KPI tiles and both chart types so "is this bad" is computed
 * exactly one way.
 */
export function thresholdZone(value: number, t: KpiThreshold): 'normal' | 'warning' | 'critical' {
  if (t.direction === 'above') {
    if (value >= t.critical) return 'critical'
    if (value >= t.warning) return 'warning'
    return 'normal'
  }
  if (value <= t.critical) return 'critical'
  if (value <= t.warning) return 'warning'
  return 'normal'
}

/**
 * Expands a chart's Y-domain so the threshold lines are always visible —
 * a chart whose data never reaches its warning line would otherwise clip
 * it off the top/bottom edge — and returns the three band boundaries
 * (critical/warning/normal) a chart draws as colored regions.
 */
export function thresholdBands(t: KpiThreshold, dataMin: number, dataMax: number) {
  const lo = Math.min(dataMin, t.critical, t.warning)
  const hi = Math.max(dataMax, t.critical, t.warning)
  const pad = Math.max((hi - lo) * 0.08, 0.5)
  const min = lo - pad
  const max = hi + pad

  // Each band is [from, to] in data units, ordered low→high on the axis.
  const bands =
    t.direction === 'above'
      ? [
          { zone: 'normal' as const, from: min, to: t.warning },
          { zone: 'warning' as const, from: t.warning, to: t.critical },
          { zone: 'critical' as const, from: t.critical, to: max },
        ]
      : [
          { zone: 'critical' as const, from: min, to: t.critical },
          { zone: 'warning' as const, from: t.critical, to: t.warning },
          { zone: 'normal' as const, from: t.warning, to: max },
        ]

  return { min, max, bands }
}

export const ZONE_COLOR: Record<'normal' | 'warning' | 'critical', string> = {
  normal: 'var(--app-success)',
  warning: 'var(--app-warning)',
  critical: 'var(--app-danger)',
}
