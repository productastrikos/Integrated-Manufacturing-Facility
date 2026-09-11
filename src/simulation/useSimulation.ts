import { useSyncExternalStore } from 'react'
import { simulationEngine } from './simulationEngine'
import type { SimulationState } from './types'

/**
 * The one hook every screen uses to read live facility state. All
 * consumers subscribe to the same store, so the same equipment reads
 * identically on the Executive Overview, the Digital Twin, Maintenance,
 * Alerts and the AI Copilot — there is no per-component random data.
 */
export function useSimulation(): SimulationState {
  return useSyncExternalStore(simulationEngine.subscribe, simulationEngine.getSnapshot)
}
