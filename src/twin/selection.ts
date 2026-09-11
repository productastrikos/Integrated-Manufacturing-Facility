import { createContext, useContext } from 'react'

export type SelectionKind =
  | 'site'
  | 'building'
  | 'floor'
  | 'room'
  | 'area'
  | 'line'
  | 'equipment'
  | 'bms'
  | 'camera'
  | 'safety'
  | 'vehicle'
  | 'stage'
export type Selection = { kind: SelectionKind; id: string } | null

/** How the scene renders building levels. */
export type FloorMode = 'all' | 'isolate'

/** Camera/interaction mode for the twin. */
export type ViewMode = 'orbit' | 'walk'

/** Lighting/sky preset for the 3D scene. */
export type TimeOfDay = 'day' | 'night'

export type SelectionValue = {
  selection: Selection
  select: (kind: SelectionKind, id: string) => void
  clear: () => void

  /** Cutaway/interior view — hides roofs and fades exteriors so interiors are visible. */
  cutaway: boolean
  setCutaway: (v: boolean) => void

  /** Locked straight-down framing, only meaningful while nothing is selected. */
  topView: boolean
  setTopView: (v: boolean) => void

  /** Which building level the user is working on; null means the whole building. */
  activeFloorId: string | null
  setActiveFloorId: (id: string | null) => void
  floorMode: FloorMode
  setFloorMode: (m: FloorMode) => void

  /** Orbit (default) or first-person walk-through. */
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void

  /** Day (default) or night lighting preset for the whole scene. */
  timeOfDay: TimeOfDay
  setTimeOfDay: (t: TimeOfDay) => void
}

export const SelectionContext = createContext<SelectionValue | null>(null)

export function useSelection(): SelectionValue {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection must be used inside the Digital Twin selection provider')
  return ctx
}
