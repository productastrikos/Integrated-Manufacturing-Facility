import { useSyncExternalStore } from 'react'
import { simulationEngine } from './simulationEngine'
import type { UtilityKey } from '../lib/utilityInfo'

export type ScenarioKind = 'EQUIPMENT_FAILURE' | 'MATERIAL_SHORTAGE' | 'SUPPLIER_DELAY' | 'UTILITY_FAILURE' | 'PRODUCTION_TARGET_CHANGE'

export type ScenarioUiState = {
  kind: ScenarioKind
  equipmentId: string
  downtimeHours: number
  materialId: string
  supplierId: string
  utility: UtilityKey
  targetDelta: number
  ran: boolean
}

/** Default to the asset most worth asking about — see Simulation.tsx for why. */
function defaultEquipmentId(): string {
  const state = simulationEngine.getSnapshot()
  const producing = new Set(state.lines.filter((l) => l.status === 'running' || l.status === 'warning').map((l) => l.id))
  const candidates = Object.values(state.equipment).filter((e) => producing.has(e.lineId) && e.status === 'running')
  const pool = candidates.length > 0 ? candidates : Object.values(state.equipment)
  return [...pool].sort((a, b) => a.health - b.health)[0]?.id ?? ''
}

let uiState: ScenarioUiState = {
  kind: 'EQUIPMENT_FAILURE',
  equipmentId: defaultEquipmentId(),
  downtimeHours: 4,
  materialId: simulationEngine.getSnapshot().materials.materials[0]?.id ?? '',
  supplierId: simulationEngine.getSnapshot().materials.suppliers[0]?.id ?? '',
  utility: 'compressedAir',
  targetDelta: 15,
  ran: false,
}

const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function getSnapshot(): ScenarioUiState {
  return uiState
}

export function setScenarioUiState(patch: Partial<ScenarioUiState>) {
  uiState = { ...uiState, ...patch }
  notify()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * The scenario runner's selections (which scenario, which asset, which
 * parameters, whether it's been run) live in this module-level store
 * rather than component state, so navigating to another page in the
 * sidebar and back doesn't reset the setup — the whole point of the
 * runner is to let you set something up and come back to compare it,
 * and losing that on every navigation defeated it.
 */
export function useScenarioUiState(): ScenarioUiState {
  return useSyncExternalStore(subscribe, getSnapshot)
}
