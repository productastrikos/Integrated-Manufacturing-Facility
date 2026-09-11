import type { SimulationState } from '../simulation/types'
import type { SelectionKind } from '../twin/selection'
import { materialStatus, stockCoverDays } from './materialsIntelligence'

/**
 * One item on the "Requires Attention" feed. Every item names the exact
 * object in the Digital Twin responsible for it (twinKind/twinId), so
 * clicking through always lands on the actual thing that needs looking
 * at — never just a generic module page.
 */
export type AttentionEntry = {
  id: string
  category: 'Equipment' | 'Safety' | 'Security' | 'Quality' | 'Materials' | 'Building Services'
  title: string
  description: string
  metric?: string
  severity: 'warning' | 'critical'
  twinKind: SelectionKind
  twinId: string
  /**
   * The sidebar module that owns this problem — e.g. equipment issues route
   * to Maintenance, quality drops route to Quality. Clicking the entry opens
   * this module (with `attnId` passed as `?attn=` so the module can scroll
   * to and highlight the exact row) rather than only the Digital Twin, since
   * the module page carries the precise operational detail a response needs.
   */
  modulePath: string
  /** The id the destination module's own list keys rows by — not always the same as twinId. */
  attnId: string
}

/**
 * Pulls "needs attention" items from every domain the simulation models —
 * not just equipment — so the feed reflects the same risk picture Security,
 * Quality, Materials and BMS are each showing on their own pages. Nothing
 * here is independently computed: every entry reads a value that already
 * exists in the shared state, so this can never disagree with the module
 * it points back to.
 */
export function buildAttentionFeed(state: SimulationState): AttentionEntry[] {
  const items: AttentionEntry[] = []

  for (const a of state.attention) {
    items.push({
      id: `eq-${a.equipmentId}`,
      category: 'Equipment',
      title: `${a.equipmentId} — ${a.equipmentName}`,
      description: `${a.reason} on ${a.lineId}, currently reading ${a.metric}.`,
      metric: a.metric,
      severity: a.status === 'critical' ? 'critical' : 'warning',
      twinKind: 'equipment',
      twinId: a.equipmentId,
      modulePath: 'maintenance',
      attnId: a.equipmentId,
    })
  }

  if (state.safetySecurity.activeSafetyIncidents > 0) {
    items.push({
      id: 'safety-incidents',
      category: 'Safety',
      title: 'Active Safety Incident',
      description: `${state.safetySecurity.activeSafetyIncidents} safety incident${state.safetySecurity.activeSafetyIncidents > 1 ? 's are' : ' is'} currently open on site and unresolved.`,
      severity: 'critical',
      twinKind: 'building',
      twinId: 'BLD-PROD',
      modulePath: 'safety',
      attnId: '',
    })
  }

  if (state.safetySecurity.accessViolations > 0) {
    items.push({
      id: 'security-violations',
      category: 'Security',
      title: 'Confirmed Access Violation',
      description: `${state.safetySecurity.accessViolations} unauthorized access attempt${state.safetySecurity.accessViolations > 1 ? 's have' : ' has'} been confirmed this session.`,
      severity: 'critical',
      twinKind: 'building',
      twinId: 'BLD-SEC',
      modulePath: 'security',
      attnId: '',
    })
  }

  for (const l of state.lines) {
    if ((l.status === 'running' || l.status === 'warning') && l.qualityPct < 95) {
      items.push({
        id: `qual-${l.id}`,
        category: 'Quality',
        title: l.name,
        description: `Quality rate has dropped to ${l.qualityPct.toFixed(1)}%, below the 95% target for this line.`,
        metric: `${l.qualityPct.toFixed(1)}%`,
        severity: l.qualityPct < 90 ? 'critical' : 'warning',
        twinKind: 'line',
        twinId: l.id,
        modulePath: 'quality',
        attnId: l.id,
      })
    }
  }

  for (const m of state.materials.materials) {
    const status = materialStatus(m)
    if (status === 'critical' || status === 'out_of_stock' || status === 'low') {
      const cover = stockCoverDays(m)
      const coverText = Number.isFinite(cover) ? `${cover.toFixed(1)} days of cover` : 'no measurable draw'
      items.push({
        id: `mat-${m.id}`,
        category: 'Materials',
        title: m.name,
        description:
          status === 'out_of_stock'
            ? `Out of stock in ${m.warehouseZone} — ${m.productionLines.join(', ') || 'linked production'} may be affected.`
            : `Stock is at ${m.stockLevel.toFixed(0)} ${m.unit} in ${m.warehouseZone} (${coverText}), below the ${m.reorderLevel} ${m.unit} reorder level.`,
        metric: `${m.stockLevel.toFixed(0)} ${m.unit}`,
        severity: status === 'low' ? 'warning' : 'critical',
        twinKind: 'building',
        twinId: 'BLD-WARE',
        modulePath: 'materials',
        attnId: m.id,
      })
    }
  }

  for (const a of state.bmsAssets) {
    if (a.status === 'warning') {
      items.push({
        id: `bms-${a.id}`,
        category: 'Building Services',
        title: `${a.id} — ${a.name}`,
        description: `Running at ${a.loadPct.toFixed(0)}% load, above its normal operating band.`,
        metric: `${a.loadPct.toFixed(0)}%`,
        severity: 'warning',
        twinKind: 'bms',
        twinId: a.id,
        modulePath: 'bms',
        attnId: a.id,
      })
    }
  }

  // Critical first, then warning; stable order within each tier so the list
  // doesn't visibly reshuffle tick to tick while nothing has really changed.
  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
}
