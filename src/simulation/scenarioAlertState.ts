import { useSyncExternalStore } from 'react'
import type { SelectionKind } from '../twin/selection'
import type { Impact, ImpactModule } from '../lib/factoryEvents'
import type { UtilityKey } from '../lib/utilityInfo'

export type ScenarioAlert = {
  id: string
  /** What kind of object this scenario's worst impact points at, if any — lets the Digital Twin focus and ring exactly that object. */
  targetKind: SelectionKind | null
  targetId: string | null
  /** The specific material this scenario is about, when it's a MATERIAL_SHORTAGE run — lets the Materials & Logistics table flag that exact row, the same way the Digital Twin rings the warehouse. */
  materialId?: string
  /** The specific utility this scenario is about, when it's a UTILITY_FAILURE run — lets the Utilities & BMS page badge that exact utility card rather than all four. */
  utilityKey?: UtilityKey
  scenarioLabel: string
  title: string
  whatIsHappening: string
  resolution: string
  severity: 'critical' | 'warning'
  /** The full real cross-module impact list `deriveCascade` computed — the same list the Simulation page's "Cross-Module Impact" section shows. Lets any KPI tile or chart on any page find its own module's share of the same, already-computed cascade and preview it, without recomputing or inventing anything new. */
  impacts: Impact[]
}

/** This module's share of the active scenario's impact, or an empty array when there's no active scenario or it doesn't touch this module. */
export function impactsForModule(alert: ScenarioAlert | null, module: ImpactModule): Impact[] {
  return alert ? alert.impacts.filter((i) => i.module === module) : []
}

let activeAlert: ScenarioAlert | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function getSnapshot(): ScenarioAlert | null {
  return activeAlert
}

/**
 * Set once when a scenario is run from the Simulation page and its worst
 * impact is severe enough to call out — read by the global preview banner
 * and by the Digital Twin (which rings and focuses the named object, if
 * it can find one matching `targetKind`/`targetId`). This is explicitly a
 * *preview* of a hypothetical, never a live alert: it never touches
 * `state.attention` or any other real-state-derived list, so it can't be
 * mistaken for something actually happening on the floor right now.
 */
export function setScenarioAlert(alert: ScenarioAlert) {
  activeAlert = alert
  notify()
}

export function clearScenarioAlert() {
  activeAlert = null
  notify()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useScenarioAlert(): ScenarioAlert | null {
  return useSyncExternalStore(subscribe, getSnapshot)
}
