import type { Material } from '../simulation/types'

/**
 * The single home for every inventory threshold and derived-value formula
 * in Materials & Logistics. A material's status, its stock cover, its
 * recommended reorder quantity and its projected stockout date are always
 * computed here — never hand-typed in a component — so the KPI bar, the
 * table, the procurement panel and the AI insight can never disagree about
 * the same material.
 */
export const INVENTORY_THRESHOLDS = {
  /** Below this many days of cover, a material is Critical. */
  criticalDays: 3,
  /** Below this many days of cover (and at/under its reorder point), a material is Low. */
  lowDays: 7,
  /** Above this many days of cover, a material is flagged Overstock. */
  overstockDays: 45,
  /** How many days of cover a recommended purchase order targets restoring. */
  targetStockDays: 14,
}

export type MaterialStatus = 'healthy' | 'low' | 'critical' | 'out_of_stock' | 'overstock'

export const STATUS_LABEL: Record<MaterialStatus, string> = {
  healthy: 'Healthy',
  low: 'Low',
  critical: 'Critical',
  out_of_stock: 'Out of Stock',
  overstock: 'Overstock',
}

export const STATUS_COLOR: Record<MaterialStatus, string> = {
  healthy: 'var(--app-success)',
  low: 'var(--app-warning)',
  critical: 'var(--app-danger)',
  out_of_stock: '#7f1d1d',
  overstock: 'var(--app-info)',
}

/** Days of stock remaining at current consumption — the one formula every "N.N days" figure in the UI reads from. */
export function stockCoverDays(m: Material): number {
  if (m.dailyConsumption <= 0) return m.stockLevel > 0 ? Infinity : 0
  return m.stockLevel / m.dailyConsumption
}

/** Automatic status classification — never set by hand on a seed record. */
export function materialStatus(m: Material): MaterialStatus {
  const cover = stockCoverDays(m)
  if (m.stockLevel <= 0) return 'out_of_stock'
  if (cover < INVENTORY_THRESHOLDS.criticalDays) return 'critical'
  if (m.stockLevel <= m.reorderLevel || cover < INVENTORY_THRESHOLDS.lowDays) return 'low'
  if (cover > INVENTORY_THRESHOLDS.overstockDays) return 'overstock'
  return 'healthy'
}

/** Recommended purchase quantity to restore `targetStockDays` of cover, net of what's already inbound. Never negative. */
export function recommendedOrderQty(m: Material, targetStockDays = INVENTORY_THRESHOLDS.targetStockDays): number {
  const target = targetStockDays * m.dailyConsumption
  const qty = target - m.stockLevel - m.incomingQuantity
  return Math.max(0, Math.round(qty))
}

/** Plain-language explanation for why a recommended order is what it is — computed, not hand-typed per material. */
export function recommendationReason(m: Material): string {
  const cover = stockCoverDays(m)
  const coverText = Number.isFinite(cover) ? `${cover.toFixed(1)} days` : 'no measurable draw'
  return `Current inventory provides ${coverText} of coverage. Supplier lead time is ${m.leadTimeDays} day${m.leadTimeDays === 1 ? '' : 's'}. Recommended order restores approximately ${INVENTORY_THRESHOLDS.targetStockDays} days of stock coverage.`
}

/** Inventory value at the unit price on record. */
export function materialValue(m: Material): number {
  return m.stockLevel * m.unitValue
}

export type InventoryHealthSummary = {
  total: number
  healthy: number
  low: number
  critical: number
  outOfStock: number
  overstock: number
  /** Share of materials that are Healthy or Overstock (i.e. not requiring action), 0-100. */
  healthPct: number
  totalValue: number
  totalUnits: number
  avgStockCoverDays: number
  procurementRequiredCount: number
}

export function summarizeInventory(materials: Material[]): InventoryHealthSummary {
  const counts: Record<MaterialStatus, number> = { healthy: 0, low: 0, critical: 0, out_of_stock: 0, overstock: 0 }
  let totalValue = 0
  let totalUnits = 0
  let coverSum = 0
  let coverSamples = 0
  for (const m of materials) {
    const status = materialStatus(m)
    counts[status]++
    totalValue += materialValue(m)
    totalUnits += m.stockLevel
    const cover = stockCoverDays(m)
    if (Number.isFinite(cover)) {
      coverSum += cover
      coverSamples++
    }
  }
  const total = materials.length
  const healthy = counts.healthy + counts.overstock
  return {
    total,
    healthy: counts.healthy,
    low: counts.low,
    critical: counts.critical,
    outOfStock: counts.out_of_stock,
    overstock: counts.overstock,
    healthPct: total > 0 ? (healthy / total) * 100 : 100,
    totalValue,
    totalUnits,
    avgStockCoverDays: coverSamples > 0 ? coverSum / coverSamples : 0,
    procurementRequiredCount: counts.critical + counts.out_of_stock + counts.low,
  }
}

/** Materials that should surface in the Procurement Required panel, worst first. */
export function procurementRequired(materials: Material[]): Material[] {
  return materials
    .filter((m) => {
      const s = materialStatus(m)
      return s === 'critical' || s === 'out_of_stock' || s === 'low'
    })
    .sort((a, b) => stockCoverDays(a) - stockCoverDays(b))
}
