import { AREA_LAYOUTS, BUILDING_LAYOUTS, EQUIPMENT_LAYOUTS, LINE_LAYOUTS } from './layout'
import { BMS_ASSET_LAYOUTS, CAMERA_LAYOUTS, FLOOR_LAYOUTS, ROOM_LAYOUTS, SAFETY_ASSET_LAYOUTS, STAGE_ZONE_LAYOUTS } from './facilityLayout'
import { SEED_VEHICLES } from '../data/seedFacility'
import type { SelectionKind } from './selection'

export type TwinSearchResult = {
  kind: SelectionKind
  id: string
  label: string
  /** Where it sits in the hierarchy, shown as the result's second line. */
  context: string
  /** Human-readable category shown as a chip. */
  category: string
}

/**
 * Flat, searchable index of every addressable object in the twin. Built
 * once from the static layouts — searching never touches live state, so
 * results stay stable while the simulation ticks underneath.
 */
export const TWIN_SEARCH_INDEX: TwinSearchResult[] = [
  ...BUILDING_LAYOUTS.map((b) => ({
    kind: 'building' as const,
    id: b.building.id,
    label: b.building.name,
    context: 'Main Manufacturing Facility',
    category: 'Building',
  })),
  ...FLOOR_LAYOUTS.map((f) => ({
    kind: 'floor' as const,
    id: f.floor.id,
    label: f.floor.name,
    context: 'Production Building',
    category: 'Floor',
  })),
  ...STAGE_ZONE_LAYOUTS.map((z) => ({
    kind: 'stage' as const,
    id: z.stageId,
    label: z.name,
    context: z.stageId === 'construction' ? 'Capital works · west expansion plot' : 'Commissioning · east of Dispatch',
    category: 'Operational Stage',
  })),
  ...ROOM_LAYOUTS.map((r) => ({
    kind: 'room' as const,
    id: r.room.id,
    label: r.room.name,
    context: `Production Building · ${FLOOR_LAYOUTS.find((f) => f.floor.id === r.room.floorId)?.floor.name ?? ''}`,
    category: 'Room',
  })),
  ...SEED_VEHICLES.map((v) => ({
    kind: 'vehicle' as const,
    id: v.id,
    label: `${v.id} · ${v.name}`,
    context: `${v.origin} → ${v.destination}`,
    category: v.kind === 'truck' ? 'Vehicle' : 'Forklift',
  })),
  ...AREA_LAYOUTS.map((a) => ({
    kind: 'area' as const,
    id: a.area.id,
    label: a.area.name,
    context: 'Production Building · Ground Floor',
    category: 'Production Area',
  })),
  ...LINE_LAYOUTS.map((l) => ({
    kind: 'line' as const,
    id: l.line.id,
    label: l.line.name,
    context: AREA_LAYOUTS.find((a) => a.area.id === l.line.areaId)?.area.name ?? 'Production Building',
    category: 'Production Line',
  })),
  ...EQUIPMENT_LAYOUTS.map((e) => ({
    kind: 'equipment' as const,
    id: e.equipment.id,
    label: e.equipment.id,
    context: LINE_LAYOUTS.find((l) => l.line.id === e.equipment.lineId)?.line.name ?? 'Production Building',
    category: 'Equipment',
  })),
  ...BMS_ASSET_LAYOUTS.map((a) => ({
    kind: 'bms' as const,
    id: a.asset.id,
    label: `${a.asset.id} · ${a.asset.name}`,
    context: `${a.asset.system} · ${BUILDING_LAYOUTS.find((b) => b.building.id === a.asset.buildingId)?.building.name ?? ''}`,
    category: 'BMS Asset',
  })),
  ...CAMERA_LAYOUTS.map((c) => ({
    kind: 'camera' as const,
    id: c.camera.id,
    label: `${c.camera.id} · ${c.camera.name}`,
    context: c.camera.location,
    category: 'Camera',
  })),
  ...SAFETY_ASSET_LAYOUTS.map((s) => ({
    kind: 'safety' as const,
    id: s.asset.id,
    label: s.asset.name,
    context: BUILDING_LAYOUTS.find((b) => b.building.id === s.asset.buildingId)?.building.name ?? '',
    category: 'Safety Asset',
  })),
]

/** Case-insensitive substring match over label, id and context, best matches first. */
export function searchTwin(query: string, limit = 10): TwinSearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const scored = TWIN_SEARCH_INDEX.flatMap((entry) => {
    const label = entry.label.toLowerCase()
    const id = entry.id.toLowerCase()
    const context = entry.context.toLowerCase()

    // An exact id match outranks a label prefix, which outranks any other hit.
    if (id === q) return [{ entry, score: 0 }]
    if (label.startsWith(q) || id.startsWith(q)) return [{ entry, score: 1 }]
    if (label.includes(q) || id.includes(q)) return [{ entry, score: 2 }]
    if (context.includes(q) || entry.category.toLowerCase().includes(q)) return [{ entry, score: 3 }]
    return []
  })

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.entry)
}
