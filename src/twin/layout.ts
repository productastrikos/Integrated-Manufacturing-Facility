import { SEED_AREAS, SEED_BUILDINGS, SEED_EQUIPMENT, SEED_LINES } from '../data/seed'
import type { Building, Equipment, ProductionArea, ProductionLine } from '../simulation/types'

/**
 * Pure, static 3D layout for the facility. This file contains zero live
 * data and zero randomness — it only answers "where does this object sit
 * and how big is it". Status, health and every other live value are read
 * separately, at render time, from the shared simulation store. Positions
 * are derived programmatically from the seed arrays (grid slots, line
 * counts, equipment counts) rather than hardcoded per name, so the layout
 * keeps working if the seed data changes shape.
 */

export type Vec3 = [number, number, number]
export type EquipmentVariant =
  | 'motor'
  | 'process'
  | 'vessel'
  | 'conveyor'
  | 'packaging'
  | 'inspection'
  | 'handling'
  | 'generic'

export type BuildingLayout = {
  building: Building
  center: [number, number] // x, z
  size: [number, number] // width (x), depth (z)
  height: number
}

export type AreaLayout = {
  area: ProductionArea
  center: [number, number]
  size: [number, number]
}

export type LineLayout = {
  line: ProductionLine
  center: [number, number]
  length: number // x extent
  depth: number // z extent
}

export type EquipmentLayout = {
  equipment: Equipment
  position: Vec3
  variant: EquipmentVariant
  footprint: Vec3 // w, h, d — used for camera framing and click targets
}

/* --------------------------------------------------------- site campus -- */

const SITE_BUILDING_PLACEMENT: Record<string, { center: [number, number]; size: [number, number]; height: number }> = {
  'BLD-GATE': { center: [0, 54], size: [10, 4], height: 3.4 },
  'BLD-SEC': { center: [-17, 50], size: [10, 8], height: 4.2 },
  'BLD-ADMIN': { center: [-43, 34], size: [22, 16], height: 9 },
  'BLD-LOAD': { center: [46, 40], size: [22, 14], height: 5 },
  'BLD-WARE': { center: [50, 4], size: [26, 30], height: 11 },
  'BLD-PROD': { center: [-2, -8], size: [74, 54], height: 22 },
  'BLD-UTIL': { center: [48, -40], size: [20, 18], height: 7 },
  'BLD-MAINT': { center: [-46, -40], size: [20, 18], height: 6.5 },
}

export const BUILDING_LAYOUTS: BuildingLayout[] = SEED_BUILDINGS.map((building) => {
  const p = SITE_BUILDING_PLACEMENT[building.id]
  return { building, center: p.center, size: p.size, height: p.height }
})

export const PRODUCTION_BUILDING = BUILDING_LAYOUTS.find((b) => b.building.id === 'BLD-PROD')!

export const SITE_GROUND: [number, number] = [176, 140] // width (x), depth (z)

/* ------------------------------------------------------ production areas -- */

// Reading-order grid slots inside the Production Building, matching
// SEED_AREAS' declared order (AREA-A, AREA-B, AREA-PROC, AREA-PACK,
// AREA-QA, AREA-MH) — a 3-column x 2-row layout with walkway gaps.
const AREA_GRID_SLOTS: [number, number][] = [
  [-26, -25],
  [-2, -25],
  [22, -25],
  [-26, 1],
  [22, 1],
  [-2, 1],
]
const AREA_SIZE: [number, number] = [20, 20]

export const AREA_LAYOUTS: AreaLayout[] = SEED_AREAS.map((area, i) => ({
  area,
  center: AREA_GRID_SLOTS[i] ?? [0, 0],
  size: AREA_SIZE,
}))

function areaLayoutFor(areaId: string): AreaLayout {
  return AREA_LAYOUTS.find((a) => a.area.id === areaId) ?? AREA_LAYOUTS[0]
}

/* ----------------------------------------------------- production lines -- */

export const LINE_LAYOUTS: LineLayout[] = (() => {
  const byArea = new Map<string, ProductionLine[]>()
  for (const line of SEED_LINES) {
    const list = byArea.get(line.areaId) ?? []
    list.push(line)
    byArea.set(line.areaId, list)
  }

  const out: LineLayout[] = []
  for (const [areaId, lines] of byArea) {
    const area = areaLayoutFor(areaId)
    const [aw, ad] = area.size
    const rowHeight = (ad * 0.82) / lines.length
    lines.forEach((line, i) => {
      const z = area.center[1] - (ad * 0.82) / 2 + rowHeight * (i + 0.5)
      out.push({
        line,
        center: [area.center[0], z],
        length: aw * 0.82,
        depth: Math.min(rowHeight * 0.7, 3.4),
      })
    })
  }
  return out
})()

function lineLayoutFor(lineId: string): LineLayout {
  return LINE_LAYOUTS.find((l) => l.line.id === lineId) ?? LINE_LAYOUTS[0]
}

/* ---------------------------------------------------------- equipment ---- */

function pickVariant(eq: Equipment, areaId: string, indexInLine: number): EquipmentVariant {
  if (areaId === 'AREA-PACK') return 'packaging'
  if (areaId === 'AREA-QA') return 'inspection'
  if (areaId === 'AREA-MH') return 'handling'
  if (areaId === 'AREA-PROC') return indexInLine === 0 ? 'vessel' : 'process'
  if (eq.type === 'machine') return 'motor'
  if (eq.type === 'process-unit') return 'process'
  return indexInLine % 2 === 0 ? 'conveyor' : 'generic'
}

export const EQUIPMENT_LAYOUTS: EquipmentLayout[] = SEED_EQUIPMENT.map((equipment) => {
  const line = lineLayoutFor(equipment.lineId)
  const idxInLine = line.line.equipmentIds.indexOf(equipment.id)
  const count = line.line.equipmentIds.length || 1
  const slot = count === 1 ? 0.5 : idxInLine / (count - 1)
  const x = line.center[0] - line.length / 2 + line.length * slot
  const variant = pickVariant(equipment, line.line.areaId, idxInLine)
  const footprint: Vec3 = variant === 'vessel' ? [2.2, 3.4, 2.2] : variant === 'conveyor' ? [3.4, 1.1, 1.4] : [2, 2, 2]

  return {
    equipment,
    position: [x, 0, line.center[1]],
    variant,
    footprint,
  }
})

export function equipmentLayoutFor(id: string): EquipmentLayout | undefined {
  return EQUIPMENT_LAYOUTS.find((e) => e.equipment.id === id)
}
export function lineLayoutById(id: string): LineLayout | undefined {
  return LINE_LAYOUTS.find((l) => l.line.id === id)
}
export function areaLayoutById(id: string): AreaLayout | undefined {
  return AREA_LAYOUTS.find((a) => a.area.id === id)
}
export function buildingLayoutById(id: string): BuildingLayout | undefined {
  return BUILDING_LAYOUTS.find((b) => b.building.id === id)
}
