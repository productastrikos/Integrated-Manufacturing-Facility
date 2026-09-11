import { SEED_BMS_ASSETS, SEED_FLOORS, SEED_ROOMS, SEED_SAFETY_ASSETS, FLOOR_HEIGHT } from '../data/seedFacility'
import { SEED_CAMERAS } from '../data/seedPhase3'
import type { BmsAsset, Camera, Floor, Room, SafetyAsset } from '../simulation/types'
import { PRODUCTION_BUILDING, buildingLayoutById, type Vec3 } from './layout'

/**
 * Static placement for the spatial layer that sits alongside production:
 * building floors, building-services assets, CCTV cameras and safety
 * infrastructure. Like layout.ts this file holds zero live data — only
 * "where does this object sit". Live status is read at render time from
 * the shared simulation store.
 */

export type FloorLayout = {
  floor: Floor
  /** Slab top elevation in scene units. */
  elevation: number
  center: [number, number]
  size: [number, number]
}

export type BmsAssetLayout = {
  asset: BmsAsset
  position: Vec3
  /** Footprint used for click targets and camera framing. */
  footprint: Vec3
  rotationY: number
}

export type CameraLayout = {
  camera: Camera
  /** Mount point of the camera body. */
  position: Vec3
  /** Direction the camera is aimed, as a Y rotation in radians. */
  rotationY: number
  /** Height of the pole it sits on; 0 means wall/soffit-mounted. */
  poleHeight: number
}

export type SafetyAssetLayout = {
  asset: SafetyAsset
  position: Vec3
}

/* ------------------------------------------------------------- floors ---- */

export const FLOOR_LAYOUTS: FloorLayout[] = SEED_FLOORS.map((floor) => ({
  floor,
  elevation: floor.level * FLOOR_HEIGHT,
  center: PRODUCTION_BUILDING.center,
  size: PRODUCTION_BUILDING.size,
}))

export function floorLayoutById(id: string): FloorLayout | undefined {
  return FLOOR_LAYOUTS.find((f) => f.floor.id === id)
}

/** Elevation of a floor by id, defaulting to ground for buildings without modelled floors. */
export function elevationForFloor(floorId: string): number {
  return floorLayoutById(floorId)?.elevation ?? 0
}

/* --------------------------------------------------------- BMS assets ---- */

const PROD_C = PRODUCTION_BUILDING.center
const PROD_S = PRODUCTION_BUILDING.size

// Slots are expressed relative to the production building's own footprint so
// the deck stays laid out correctly if the building is ever resized.
const BMS_SLOTS: Record<string, { offset: [number, number]; footprint: Vec3; rotationY?: number }> = {
  // Floor 02 HVAC wing — air handlers in a row, chillers behind them, all
  // inside the mechanical plant hall on the west side of the level.
  'AHU-01': { offset: [-0.378, -0.222], footprint: [6, 3.2, 3.4] },
  'AHU-02': { offset: [-0.27, -0.222], footprint: [6, 3.2, 3.4] },
  'AHU-03': { offset: [-0.162, -0.222], footprint: [6, 3.2, 3.4] },
  'CHL-01': { offset: [-0.351, 0.037], footprint: [5, 3.6, 4.2] },
  'CHL-02': { offset: [-0.24, 0.037], footprint: [5, 3.6, 4.2] },
  'CMP-01': { offset: [-0.419, -0.093], footprint: [3.2, 2.4, 2.2] },
  // Electrical distribution sits on the corridor between the two wings.
  'PNL-01': { offset: [0.02, 0.28], footprint: [4.4, 2.6, 1.4], rotationY: Math.PI / 2 },

  // Floor 01 — utility distribution
  'PMP-01': { offset: [-0.3, 0.26], footprint: [2.4, 1.8, 1.8] },
  'PMP-02': { offset: [-0.18, 0.26], footprint: [2.4, 1.8, 1.8] },
  'PNL-02': { offset: [0.3, 0.26], footprint: [4, 2.6, 1.2], rotationY: Math.PI / 2 },
}

// The Utility Area building holds the site's electrical and water plant.
const UTIL_SLOTS: Record<string, { offset: [number, number]; footprint: Vec3 }> = {
  'TRF-01': { offset: [-0.16, 0.28], footprint: [3, 2.6, 2.4] },
  'TRF-02': { offset: [0.04, 0.28], footprint: [3, 2.6, 2.4] },
  'GEN-01': { offset: [0.28, 0.28], footprint: [4.4, 2.6, 2.2] },
  'TNK-01': { offset: [-0.26, -0.22], footprint: [3.4, 5.2, 3.4] },
  'TNK-02': { offset: [0.22, -0.22], footprint: [3.4, 5.2, 3.4] },
}

const ADMIN_SLOTS: Record<string, { offset: [number, number]; footprint: Vec3 }> = {
  'AHU-04': { offset: [0.26, -0.24], footprint: [4, 2.2, 2.4] },
}

export const BMS_ASSET_LAYOUTS: BmsAssetLayout[] = SEED_BMS_ASSETS.flatMap((asset) => {
  if (asset.buildingId === 'BLD-PROD') {
    const slot = BMS_SLOTS[asset.id]
    if (!slot) return []
    const y = elevationForFloor(asset.floorId) + 0.2
    return [
      {
        asset,
        position: [PROD_C[0] + slot.offset[0] * PROD_S[0], y, PROD_C[1] + slot.offset[1] * PROD_S[1]] as Vec3,
        footprint: slot.footprint,
        rotationY: slot.rotationY ?? 0,
      },
    ]
  }

  if (asset.buildingId === 'BLD-UTIL') {
    const util = buildingLayoutById('BLD-UTIL')
    const slot = UTIL_SLOTS[asset.id]
    if (!util || !slot) return []
    return [
      {
        asset,
        position: [util.center[0] + slot.offset[0] * util.size[0], 0.1, util.center[1] + slot.offset[1] * util.size[1]] as Vec3,
        footprint: slot.footprint,
        rotationY: 0,
      },
    ]
  }

  if (asset.buildingId === 'BLD-ADMIN') {
    const admin = buildingLayoutById('BLD-ADMIN')
    const slot = ADMIN_SLOTS[asset.id]
    if (!admin || !slot) return []
    // Roof-mounted plant on the administration building.
    return [
      {
        asset,
        position: [admin.center[0] + slot.offset[0] * admin.size[0], admin.height + 0.45, admin.center[1] + slot.offset[1] * admin.size[1]] as Vec3,
        footprint: slot.footprint,
        rotationY: 0,
      },
    ]
  }

  return []
})

export function bmsAssetLayoutById(id: string): BmsAssetLayout | undefined {
  return BMS_ASSET_LAYOUTS.find((a) => a.asset.id === id)
}

/* ------------------------------------------------------------ cameras ---- */

// Each camera is mounted where it can plausibly see the zone it covers:
// gate cameras on poles by the road, interior cameras high on a column.
const CAMERA_MOUNTS: Record<string, { position: Vec3; rotationY: number; poleHeight: number }> = {
  'CAM-01': { position: [6, 5.4, 50], rotationY: Math.PI, poleHeight: 5.4 },
  'CAM-02': { position: [-2, 6.2, 14], rotationY: Math.PI, poleHeight: 0 },
  'CAM-03': { position: [50, 5.6, -9], rotationY: 0, poleHeight: 0 },
  'CAM-04': { position: [46, 5.2, 34], rotationY: 0, poleHeight: 0 },
  'CAM-05': { position: [-17, 5, 45], rotationY: Math.PI, poleHeight: 0 },
  'CAM-06': { position: [48, 4.6, -31], rotationY: Math.PI, poleHeight: 4.6 },
}

export const CAMERA_LAYOUTS: CameraLayout[] = SEED_CAMERAS.flatMap((camera) => {
  const mount = CAMERA_MOUNTS[camera.id]
  if (!mount) return []
  return [{ camera, position: mount.position, rotationY: mount.rotationY, poleHeight: mount.poleHeight }]
})

export function cameraLayoutById(id: string): CameraLayout | undefined {
  return CAMERA_LAYOUTS.find((c) => c.camera.id === id)
}

/* ------------------------------------------------------ safety assets ---- */

const SAFETY_POSITIONS: Record<string, Vec3> = {
  'SAF-EXT-01': [-34, 0.9, -14],
  'SAF-EXT-02': [-10, 0.9, -14],
  'SAF-EXT-03': [14, 0.9, -14],
  'SAF-EXT-04': [-30, FLOOR_HEIGHT * 2 + 1.1, -22],
  'SAF-EXIT-01': [-2, 1.2, -35],
  'SAF-EXIT-02': [-2, 1.2, 19],
  'SAF-EXIT-03': [50, 1.2, -11],
  'SAF-FP-01': [-36, 1.1, 16],
  'SAF-EYE-01': [8, 0.7, -12],
  'SAF-AID-01': [-36, 1.1, 13],
  'SAF-MUS-01': [-20, 0.1, 30],
}

export const SAFETY_ASSET_LAYOUTS: SafetyAssetLayout[] = SEED_SAFETY_ASSETS.flatMap((asset) => {
  const position = SAFETY_POSITIONS[asset.id]
  if (!position) return []
  return [{ asset, position }]
})

export function safetyAssetLayoutById(id: string): SafetyAssetLayout | undefined {
  return SAFETY_ASSET_LAYOUTS.find((a) => a.asset.id === id)
}

/* -------------------------------------------------------------- rooms ---- */

export type RoomLayout = {
  room: Room
  /** Room centre in world space (x, y at floor level, z). */
  position: Vec3
  size: [number, number] // width (x), depth (z)
  height: number
  /** Which wall the door sits in, so the room reads as enterable. */
  doorSide: 'north' | 'south' | 'east' | 'west'
}

const ROOM_HEIGHT = 3.4

// Rooms are placed along the building's edges, leaving the middle of each
// level clear for the production hall / plant it serves.
const ROOM_SLOTS: Record<string, { offset: [number, number]; size: [number, number]; doorSide: RoomLayout['doorSide'] }> = {
  // Ground floor — support spaces around the line hall
  'RM-G-MH': { offset: [0.36, -0.3], size: [14, 14], doorSide: 'west' },
  'RM-G-QA': { offset: [0.36, 0.06], size: [14, 12], doorSide: 'west' },
  'RM-G-MNT': { offset: [-0.4, 0.3], size: [12, 11], doorSide: 'east' },
  'RM-G-STAFF': { offset: [-0.12, 0.36], size: [16, 10], doorSide: 'north' },

  // Floor 01 — control, procurement and distribution
  'RM-01-CTL': { offset: [-0.14, -0.3], size: [18, 10], doorSide: 'south' },
  'RM-01-ELEC': { offset: [0.3, -0.3], size: [12, 10], doorSide: 'south' },
  'RM-01-SRV': { offset: [0.3, -0.06], size: [12, 8], doorSide: 'west' },
  'RM-01-PROC': { offset: [-0.36, -0.3], size: [12, 10], doorSide: 'south' },

  // Floor 02 is zoned into two wings either side of a central corridor: the
  // WEST half is the mechanical / HVAC plant hall, the EAST half is the
  // security wing. Both open onto the same spine, so the split reads as
  // deliberate zoning rather than rooms scattered across a deck.
  'RM-02-MECH': { offset: [-0.26, -0.08], size: [30, 26], doorSide: 'east' },
  'RM-02-STORE': { offset: [-0.34, 0.3], size: [13, 9], doorSide: 'north' },
  'RM-02-SOC': { offset: [0.26, -0.14], size: [24, 18], doorSide: 'west' },
  'RM-02-SRV': { offset: [0.3, 0.26], size: [14, 10], doorSide: 'north' },
  'RM-02-ELEC': { offset: [0.02, 0.28], size: [12, 9], doorSide: 'north' },
}

/** The corridor that divides Floor 02 into its HVAC wing and its security wing. */
export const FLOOR_02_CORRIDOR = {
  center: [PRODUCTION_BUILDING.center[0], PRODUCTION_BUILDING.center[1] - 8] as [number, number],
  width: 9,
  depth: 30,
}

export const ROOM_LAYOUTS: RoomLayout[] = SEED_ROOMS.flatMap((room) => {
  const slot = ROOM_SLOTS[room.id]
  if (!slot) return []
  const y = elevationForFloor(room.floorId) + 0.25
  return [
    {
      room,
      position: [PROD_C[0] + slot.offset[0] * PROD_S[0], y, PROD_C[1] + slot.offset[1] * PROD_S[1]] as Vec3,
      size: slot.size,
      height: ROOM_HEIGHT,
      doorSide: slot.doorSide,
    },
  ]
})

export function roomLayoutById(id: string): RoomLayout | undefined {
  return ROOM_LAYOUTS.find((r) => r.room.id === id)
}

/* ------------------------------------------------------------ vehicles --- */

export type VehicleRoute = {
  /** Start and end of the leg this vehicle travels, in world space. */
  from: [number, number]
  to: [number, number]
  /** Parked vehicles ignore the route and sit here instead. */
  parked?: [number, number]
  headingOffset?: number
}

// Routes follow the internal roads laid out in FacilityScene, and parked
// positions sit on the apron outside a building rather than inside its
// footprint — a truck standing in the middle of the racking reads as a bug.
const VEHICLE_ROUTES: Record<string, VehicleRoute> = {
  // Backed onto the warehouse receiving dock, on the east apron.
  'TRK-024': { from: [70, 4], to: [70, 4], parked: [70, 4], headingOffset: Math.PI / 2 },
  // On the dispatch apron in front of the Loading / Dispatch building.
  'TRK-031': { from: [38, 52], to: [38, 52], parked: [38, 52] },
  // Running the main east-west spine out toward the gate.
  'TRK-047': { from: [44, 23], to: [4, 23] },
  // Working the dispatch yard.
  'FLT-06': { from: [52, 50], to: [34, 50] },
  // Shuttling up the warehouse spine toward the production building.
  'FLT-09': { from: [48, -14], to: [48, 16] },
}

export function vehicleRouteFor(id: string): VehicleRoute | undefined {
  return VEHICLE_ROUTES[id]
}

/** Interpolates a vehicle's world position from its route and progress. */
export function vehiclePosition(id: string, routeProgress: number): { position: Vec3; rotationY: number } | null {
  const route = VEHICLE_ROUTES[id]
  if (!route) return null

  if (route.parked) {
    return { position: [route.parked[0], 0, route.parked[1]], rotationY: route.headingOffset ?? 0 }
  }

  const [fx, fz] = route.from
  const [tx, tz] = route.to
  const x = fx + (tx - fx) * routeProgress
  const z = fz + (tz - fz) * routeProgress
  const rotationY = Math.atan2(tx - fx, tz - fz) + (route.headingOffset ?? 0)
  return { position: [x, 0, z], rotationY }
}

/* ------------------------------------------------- value-chain zones ----- */

export type StageZoneLayout = {
  stageId: 'installation' | 'construction'
  name: string
  center: [number, number]
  size: [number, number]
}

/**
 * Physical plots for the two value-chain stages that have no home in an
 * existing building: the commissioning yard where finished equipment is
 * tested and signed off before dispatch, and the capital-works site where
 * plant extensions are actually under construction.
 *
 * Both sit on free ground clear of every existing building footprint.
 */
export const STAGE_ZONE_LAYOUTS: StageZoneLayout[] = [
  { stageId: 'installation', name: 'Commissioning & Test Yard', center: [74, 32], size: [20, 24] },
  { stageId: 'construction', name: 'Capital Works Site', center: [-70, -5], size: [22, 40] },
]

export function stageZoneById(id: string): StageZoneLayout | undefined {
  return STAGE_ZONE_LAYOUTS.find((z) => z.stageId === id)
}

/**
 * Does focusing this object require the production building to be opened?
 *
 * Anything that physically sits inside BLD-PROD is invisible from outside a
 * closed envelope — focusing it without opening the building drops the
 * camera behind cladding and shows the user a blank wall. The floor picker
 * already opens the building; this lets deep links, search and in-scene
 * clicks do the same for everything else indoors.
 */
export function selectionIsIndoors(kind: string, id: string): boolean {
  if (kind === 'floor' || kind === 'room' || kind === 'area' || kind === 'line' || kind === 'equipment') return true
  if (kind === 'bms') return BMS_ASSET_LAYOUTS.some((a) => a.asset.id === id && a.asset.buildingId === 'BLD-PROD')
  if (kind === 'camera') return CAMERA_LAYOUTS.some((c) => c.camera.id === id && c.camera.buildingId === 'BLD-PROD')
  if (kind === 'safety') return SEED_SAFETY_ASSETS.some((a) => a.id === id && a.buildingId === 'BLD-PROD')
  return false
}
