import type { SimulationState } from '../simulation/types'
import { KPI_THRESHOLDS, thresholdZone } from '../lib/kpiThresholds'
import { procurementRequired, stockCoverDays, summarizeInventory } from '../lib/materialsIntelligence'
import { UTILITY_INFO, type UtilityKey } from '../lib/utilityInfo'

/**
 * The single map of "which building is which kind of thing" — hover
 * tooltips, the right-side panel, and the module-navigation buttons all
 * read from this one place, so a building's category, icon and the module
 * it opens can never drift out of sync between those three call sites.
 */
export type ZoneCategory = 'production' | 'materials' | 'security' | 'facilities' | 'utilities' | 'logistics' | 'maintenance'

export type ZoneMeta = {
  category: ZoneCategory
  emoji: string
  moduleRoute: string
  moduleLabel: string
}

export const ZONE_META: Record<string, ZoneMeta> = {
  'BLD-GATE': { category: 'security', emoji: '🚪', moduleRoute: '/app/security', moduleLabel: 'Security' },
  'BLD-SEC': { category: 'security', emoji: '🛡️', moduleRoute: '/app/security', moduleLabel: 'Security' },
  'BLD-ADMIN': { category: 'facilities', emoji: '🏢', moduleRoute: '/app/bms', moduleLabel: 'BMS' },
  'BLD-PROD': { category: 'production', emoji: '🏭', moduleRoute: '/app/operations', moduleLabel: 'Operations' },
  'BLD-WARE': { category: 'materials', emoji: '📦', moduleRoute: '/app/materials', moduleLabel: 'Materials & Logistics' },
  'BLD-UTIL': { category: 'utilities', emoji: '⚡', moduleRoute: '/app/bms', moduleLabel: 'BMS' },
  'BLD-MAINT': { category: 'maintenance', emoji: '🔧', moduleRoute: '/app/maintenance', moduleLabel: 'Maintenance' },
  'BLD-LOAD': { category: 'logistics', emoji: '🚚', moduleRoute: '/app/materials', moduleLabel: 'Materials & Logistics' },
}

const UTILITY_KEYS = Object.keys(UTILITY_INFO) as UtilityKey[]
const ZONE_RANK = { normal: 0, warning: 1, critical: 2 } as const

export type ZoneStatus = 'normal' | 'warning' | 'critical'
export type ZoneQuickStat = { zone: ZoneStatus; line: string }

function worstUtilityZone(state: SimulationState): ZoneStatus {
  return UTILITY_KEYS.reduce<ZoneStatus>((acc, k) => {
    const z = thresholdZone(state.utilities[k].pressureBar, UTILITY_INFO[k].threshold)
    return ZONE_RANK[z] > ZONE_RANK[acc] ? z : acc
  }, 'normal')
}

/** The one-line "hover tooltip" stat for each building — also reused as the panel's header status. */
export function buildingQuickStat(id: string, state: SimulationState): ZoneQuickStat {
  switch (id) {
    case 'BLD-PROD': {
      const zone = thresholdZone(state.kpis.oeePct, KPI_THRESHOLDS.oee)
      return { zone, line: `OEE ${state.kpis.oeePct.toFixed(0)}%` }
    }
    case 'BLD-WARE': {
      const s = summarizeInventory(state.materials.materials)
      const zone: ZoneStatus = s.critical + s.outOfStock > 0 ? 'critical' : s.low > 0 ? 'warning' : 'normal'
      return { zone, line: `Inventory ${s.healthPct.toFixed(0)}%` }
    }
    case 'BLD-SEC': {
      const { accessViolations } = state.safetySecurity
      const denied = state.security.accessEvents.some((e) => e.decision === 'denied')
      const zone: ZoneStatus = accessViolations > 0 ? 'critical' : denied ? 'warning' : 'normal'
      return { zone, line: `${accessViolations} violation${accessViolations === 1 ? '' : 's'}` }
    }
    case 'BLD-GATE': {
      const delayed = state.materials.inboundShipments.some((s) => s.status === 'delayed')
      return { zone: delayed ? 'warning' : 'normal', line: `${state.security.gateActivityCount} gate events` }
    }
    case 'BLD-ADMIN': {
      return { zone: state.bms.hvacStatus === 'Normal' ? 'normal' : 'warning', line: `HVAC ${state.bms.hvacStatus}` }
    }
    case 'BLD-UTIL': {
      const zone = worstUtilityZone(state)
      return { zone, line: zone === 'normal' ? 'All systems normal' : `${zone} — check pressure` }
    }
    case 'BLD-LOAD': {
      const delayed = state.materials.outboundShipments.some((s) => s.status === 'delayed')
      return { zone: delayed ? 'warning' : 'normal', line: `${state.materials.outboundShipments.length} dispatches` }
    }
    case 'BLD-MAINT': {
      const critical = Object.values(state.equipment).filter((e) => e.status === 'critical').length
      return { zone: critical > 0 ? 'critical' : 'normal', line: `${critical} critical asset${critical === 1 ? '' : 's'}` }
    }
    default:
      return { zone: 'normal', line: '' }
  }
}

/** Category-specific AI insight text — never the same sentence for two different buildings. */
export function buildingAiInsight(id: string, state: SimulationState): string {
  switch (id) {
    case 'BLD-SEC': {
      const { accessViolations } = state.safetySecurity
      if (accessViolations > 0) return `${accessViolations} confirmed access violation${accessViolations === 1 ? '' : 's'} this session — review the tailgate event below.`
      const denied = state.security.accessEvents.filter((e) => e.decision === 'denied').length
      if (denied > 0) return `${denied} denied access attempt${denied === 1 ? '' : 's'} logged in the current rolling window.`
      return 'No security events currently require review.'
    }
    case 'BLD-GATE': {
      const delayed = state.materials.inboundShipments.find((s) => s.status === 'delayed')
      if (delayed) {
        const material = state.materials.materials.find((m) => m.id === delayed.materialId)
        return `${material?.name ?? 'An inbound shipment'} via ${delayed.truck} at ${delayed.gate} is delayed.`
      }
      return 'All inbound traffic through the gate is on schedule.'
    }
    case 'BLD-WARE': {
      const critical = procurementRequired(state.materials.materials)[0]
      if (critical) {
        const cover = stockCoverDays(critical)
        const coverText = Number.isFinite(cover) ? `${cover.toFixed(1)} days` : 'no measurable draw'
        return `${critical.name} may run out in ${coverText}${critical.productionLines.length ? ` — may affect ${critical.productionLines.join(', ')}` : ''}.`
      }
      return 'All materials are within a healthy stock range.'
    }
    case 'BLD-PROD': {
      const worstLine = [...state.lines].sort((a, b) => a.performancePct - b.performancePct)[0]
      if (worstLine && worstLine.performancePct < 90) return `${worstLine.name} throughput is ${(100 - worstLine.performancePct).toFixed(1)}% below its ideal cycle rate.`
      return 'All production lines are running within expected performance range.'
    }
    case 'BLD-UTIL': {
      for (const k of UTILITY_KEYS) {
        const z = thresholdZone(state.utilities[k].pressureBar, UTILITY_INFO[k].threshold)
        if (z !== 'normal') return `${UTILITY_INFO[k].label} pressure is ${state.utilities[k].pressureBar.toFixed(2)} bar, below the ${UTILITY_INFO[k].threshold.warning}${UTILITY_INFO[k].threshold.unit ?? ''} baseline.`
      }
      return 'All utility systems are within normal operating range.'
    }
    case 'BLD-LOAD': {
      const delayed = state.materials.outboundShipments.find((s) => s.status === 'delayed')
      if (delayed) return `${delayed.dispatchNumber} to ${delayed.destination} is delayed.`
      return 'All scheduled dispatches are on track.'
    }
    case 'BLD-ADMIN': {
      if (state.bms.hvacStatus !== 'Normal') return 'HVAC requires attention in the administration building.'
      if (state.safetySecurity.accessViolations > 0) return 'Access control has a confirmed violation this session — see Security for details.'
      return 'Facility services are operating normally.'
    }
    case 'BLD-MAINT': {
      const critical = Object.values(state.equipment).filter((e) => e.status === 'critical')
      if (critical.length > 0) return `${critical.length} asset${critical.length === 1 ? '' : 's'} in a critical state require immediate attention.`
      return 'No equipment currently requires urgent maintenance.'
    }
    default:
      return 'No specific insight for this facility right now.'
  }
}
