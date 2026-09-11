import type { KpiThreshold } from './kpiThresholds'
import { ICONS } from '../components/ui'

export type UtilityKey = 'water' | 'gas' | 'compressedAir' | 'steam'

/**
 * Static context for each utility system — what it feeds and the pressure
 * band that signals a supply problem. Shared by the BMS module and the
 * Digital Twin's Utility Area panel so the two never describe the same
 * pressure reading with different thresholds. `icon` is a key into the
 * shared line-icon set (`ICONS`/`Icon` in ui.tsx) — flat, monochrome glyphs
 * consistent with the rest of the console, not decorative emoji.
 */
export const UTILITY_INFO: Record<UtilityKey, { label: string; icon: string; description: string; threshold: KpiThreshold }> = {
  water: {
    label: 'Water',
    icon: ICONS.droplet,
    description: 'Domestic and process water supply feeding production, utilities and site amenities.',
    threshold: { warning: 3.5, critical: 3.0, direction: 'below', unit: ' bar' },
  },
  gas: {
    label: 'Gas',
    icon: ICONS.flame,
    description: 'Natural gas supply for combustion processes and space heating across the facility.',
    threshold: { warning: 1.8, critical: 1.5, direction: 'below', unit: ' bar' },
  },
  compressedAir: {
    label: 'Compressed Air',
    icon: ICONS.gauge,
    description: 'Instrument and process compressed air for pneumatic tooling and control systems.',
    threshold: { warning: 6.0, critical: 5.5, direction: 'below', unit: ' bar' },
  },
  steam: {
    label: 'Steam',
    icon: ICONS.thermometer,
    description: 'Process steam for heating, sterilization and thermal processes on the production floor.',
    threshold: { warning: 7.5, critical: 7.0, direction: 'below', unit: ' bar' },
  },
}
