import { mulberry32 } from '../simulation/rng'
import type { Building, Equipment, ProductionArea, ProductionLine, Site } from '../simulation/types'

/**
 * Generic manufacturing hierarchy: Site → Building → Production Area →
 * Production Line → Equipment. Every name here is a universal manufacturing
 * concept — nothing industry-specific — so this same seed drives the
 * Digital Twin in Phase 2 without rework.
 */

export const SEED_SITE: Site = { id: 'SITE-01', name: 'Main Manufacturing Facility' }

export const SEED_BUILDINGS: Building[] = [
  { id: 'BLD-GATE', name: 'Main Gate', siteId: 'SITE-01', kind: 'gate' },
  { id: 'BLD-ADMIN', name: 'Administration Building', siteId: 'SITE-01', kind: 'building' },
  { id: 'BLD-PROD', name: 'Production Building', siteId: 'SITE-01', kind: 'building' },
  { id: 'BLD-WARE', name: 'Warehouse', siteId: 'SITE-01', kind: 'building' },
  { id: 'BLD-UTIL', name: 'Utility Area', siteId: 'SITE-01', kind: 'area' },
  { id: 'BLD-MAINT', name: 'Maintenance Area', siteId: 'SITE-01', kind: 'area' },
  { id: 'BLD-LOAD', name: 'Loading / Dispatch Area', siteId: 'SITE-01', kind: 'area' },
  { id: 'BLD-SEC', name: 'Security Area', siteId: 'SITE-01', kind: 'area' },
]

export const SEED_AREAS: ProductionArea[] = [
  { id: 'AREA-A', name: 'Production Area A', buildingId: 'BLD-PROD' },
  { id: 'AREA-B', name: 'Production Area B', buildingId: 'BLD-PROD' },
  { id: 'AREA-PROC', name: 'Processing Area', buildingId: 'BLD-PROD' },
  { id: 'AREA-PACK', name: 'Packaging Area', buildingId: 'BLD-PROD' },
  { id: 'AREA-QA', name: 'Inspection / Quality Area', buildingId: 'BLD-PROD' },
  { id: 'AREA-MH', name: 'Material Handling Area', buildingId: 'BLD-PROD' },
]

type LineBlueprint = { id: string; name: string; areaId: string; mode: 'running' | 'idle' | 'maintenance' }

const LINE_BLUEPRINTS: LineBlueprint[] = [
  { id: 'LINE-01', name: 'Production Line 01', areaId: 'AREA-A', mode: 'running' },
  { id: 'LINE-02', name: 'Production Line 02', areaId: 'AREA-A', mode: 'running' },
  { id: 'LINE-03', name: 'Production Line 03', areaId: 'AREA-A', mode: 'running' },
  { id: 'LINE-04', name: 'Production Line 04', areaId: 'AREA-B', mode: 'running' },
  { id: 'LINE-05', name: 'Production Line 05', areaId: 'AREA-B', mode: 'running' },
  { id: 'LINE-06', name: 'Production Line 06', areaId: 'AREA-B', mode: 'running' },
  { id: 'PROC-01', name: 'Process Unit 01', areaId: 'AREA-PROC', mode: 'running' },
  { id: 'PACK-01', name: 'Packaging Line 01', areaId: 'AREA-PACK', mode: 'running' },
  { id: 'LINE-07', name: 'Production Line 07', areaId: 'AREA-MH', mode: 'idle' },
  { id: 'LINE-08', name: 'Production Line 08', areaId: 'AREA-QA', mode: 'maintenance' },
]

const seedRng = mulberry32(20260831)

function buildEquipmentForLine(line: LineBlueprint, startIndex: number): Equipment[] {
  const count = 3
  return Array.from({ length: count }, (_, i) => {
    const globalIndex = startIndex + i + 1 // 1-based, drives the EQUIPMENT-014 hero asset
    const id = `EQUIPMENT-${String(globalIndex).padStart(3, '0')}`

    if (line.mode === 'idle') {
      return {
        id,
        name: `Equipment ${globalIndex}`,
        lineId: line.id,
        type: 'equipment',
        status: 'idle',
        health: 97,
        temperatureC: 24,
        vibrationMmS: 0.4,
        powerKw: 2,
        speedRpm: 0,
        operatingHours: 3100 + globalIndex * 11,
        maintenanceDueInDays: 40 + globalIndex,
        loadPct: 0,
        targetLoadPct: 0,
      } satisfies Equipment
    }

    if (line.mode === 'maintenance') {
      return {
        id,
        name: `Equipment ${globalIndex}`,
        lineId: line.id,
        type: 'equipment',
        status: 'maintenance',
        health: 71,
        temperatureC: 26,
        vibrationMmS: 0.3,
        powerKw: 0,
        speedRpm: 0,
        operatingHours: 5210 + globalIndex * 9,
        maintenanceDueInDays: 0,
        loadPct: 0,
        targetLoadPct: 0,
      } satisfies Equipment
    }

    // The hero demo asset — matches the PRD example exactly and is the one
    // unit scripted to drift toward a warning state over the session.
    if (globalIndex === 14) {
      return {
        id,
        name: `Equipment ${globalIndex}`,
        lineId: line.id,
        type: 'machine',
        status: 'running',
        health: 94,
        temperatureC: 74.2,
        vibrationMmS: 2.4,
        powerKw: 82,
        speedRpm: 1420,
        operatingHours: 4821,
        maintenanceDueInDays: 18,
        loadPct: 78,
        targetLoadPct: 78,
        scripted: 'drift-vibration',
      } satisfies Equipment
    }

    // Two more demo assets scripted to sit in a warning band all session,
    // so the Requires Attention feed always has a small, real, varied set
    // of equipment issues rather than depending on random noise to ever
    // cross a threshold.
    if (globalIndex === 5 || globalIndex === 22) {
      return {
        id,
        name: `Equipment ${globalIndex}`,
        lineId: line.id,
        type: 'machine',
        status: 'warning',
        health: 82,
        temperatureC: 84,
        vibrationMmS: 1.8,
        powerKw: 68,
        speedRpm: 1180,
        operatingHours: 3980 + globalIndex * 7,
        maintenanceDueInDays: 5 + globalIndex,
        loadPct: 66,
        targetLoadPct: 66,
        scripted: 'drift-temperature',
      } satisfies Equipment
    }

    const targetLoad = 55 + seedRng() * 35
    return {
      id,
      name: `Equipment ${globalIndex}`,
      lineId: line.id,
      type: i === 0 ? 'machine' : i === 1 ? 'process-unit' : 'equipment',
      status: 'running',
      health: Math.round(88 + seedRng() * 10),
      temperatureC: Math.round((45 + seedRng() * 20) * 10) / 10,
      vibrationMmS: Math.round((0.8 + seedRng() * 1.2) * 10) / 10,
      powerKw: Math.round(40 + seedRng() * 70),
      speedRpm: Math.round(800 + seedRng() * 900),
      operatingHours: Math.round(1800 + seedRng() * 6000),
      maintenanceDueInDays: Math.round(8 + seedRng() * 60),
      loadPct: targetLoad,
      targetLoadPct: targetLoad,
    } satisfies Equipment
  })
}

export const SEED_EQUIPMENT: Equipment[] = LINE_BLUEPRINTS.flatMap((line, li) =>
  buildEquipmentForLine(line, li * 3),
)

// A brief real stoppage already on the books for a couple of lines earlier
// this shift — so Downtime Pareto & Production Loss opens with an actual
// distribution instead of staying empty until a line happens to go fully
// critical during the session. Tied to lines that already carry a real,
// persistent equipment fault (see EQUIPMENT-005/022's scripted drift above),
// so the inferred cause traces back to a condition that's actually true.
const SEED_DOWNTIME_MINUTES: Record<string, number> = {
  'LINE-02': 34, // EQUIPMENT-005 drift-temperature
  'PACK-01': 21, // EQUIPMENT-022 drift-temperature
  'LINE-05': 9, // an earlier brief minor stop, no persistent cause
}

export const SEED_LINES: ProductionLine[] = LINE_BLUEPRINTS.map((line) => {
  const eqIds = SEED_EQUIPMENT.filter((e) => e.lineId === line.id).map((e) => e.id)
  const status = line.mode
  return {
    id: line.id,
    name: line.name,
    areaId: line.areaId,
    status,
    equipmentIds: eqIds,
    outputUnits: status === 'running' ? Math.round(500 + seedRng() * 300) : 0,
    targetUnits: 1000,
    availabilityPct: status === 'running' ? 88 + seedRng() * 8 : status === 'idle' ? 0 : 0,
    performancePct: status === 'running' ? 85 + seedRng() * 10 : 0,
    qualityPct: status === 'running' ? 96 + seedRng() * 3 : 0,
    downtimeMinutes: SEED_DOWNTIME_MINUTES[line.id] ?? 0,
    scriptedIdle: line.mode === 'idle',
    scriptedMaintenance: line.mode === 'maintenance',
  } satisfies ProductionLine
})

export const SITE_TARGET_UNITS = 10000
