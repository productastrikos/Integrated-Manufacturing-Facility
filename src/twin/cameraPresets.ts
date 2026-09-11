import {
  AREA_LAYOUTS,
  BUILDING_LAYOUTS,
  EQUIPMENT_LAYOUTS,
  LINE_LAYOUTS,
  SITE_GROUND,
  type Vec3,
} from './layout'
import { BMS_ASSET_LAYOUTS, CAMERA_LAYOUTS, FLOOR_LAYOUTS, ROOM_LAYOUTS, SAFETY_ASSET_LAYOUTS, stageZoneById, vehiclePosition } from './facilityLayout'
import type { Selection } from './selection'

export type CameraPreset = { position: Vec3; target: Vec3 }

/**
 * Last known route progress per vehicle, refreshed by the scene each tick.
 * Vehicles move, so their camera framing has to read a live value; keeping
 * it in one small map avoids threading state through the preset function.
 */
export const VEHICLE_FRAME_PROGRESS = new Map<string, number>()

export const FACTORY_OVERVIEW: CameraPreset = { position: [95, 78, 118], target: [0, 2, 0] }

/**
 * A wide, high establishing shot the camera starts from on first load. The
 * Canvas's initial camera is set to this position rather than
 * FACTORY_OVERVIEW directly, so the very first camera transition IS the
 * one-time cinematic dolly-in — CameraRig's normal preset-transition system
 * carries it in, no separate animation path needed. Every later transition
 * starts from wherever the camera already is, so this plays once only.
 *
 * Kept close enough that it still sits inside the scene's fog falloff (see
 * the Canvas's fog `far` distance) — start it further out than that and
 * the facility is fully fogged to the background color at the very first
 * frame, i.e. an empty canvas until the dolly-in has covered most of its
 * distance. This should read as "emerging from haze," not "loading."
 */
export const INTRO_START: CameraPreset = { position: [-70, 115, 175], target: [0, 4, 0] }

/** Steep-down framing for the "Top View" toggle — approximates an orthographic floor plan with a narrow-fov perspective camera. */
export const TOP_VIEW: CameraPreset = { position: [0, 190, 6], target: [0, 0, 0] }

/** Resolves the current selection into a camera framing — position + look-at target. */
export function presetForSelection(selection: Selection): CameraPreset {
  if (!selection) return FACTORY_OVERVIEW

  if (selection.kind === 'site') return FACTORY_OVERVIEW

  if (selection.kind === 'building') {
    const b = BUILDING_LAYOUTS.find((x) => x.building.id === selection.id)
    if (!b) return FACTORY_OVERVIEW
    const reach = Math.max(b.size[0], b.size[1]) * 1.1
    return {
      position: [b.center[0] + reach * 0.75, b.height + reach * 0.55, b.center[1] + reach * 0.75],
      target: [b.center[0], b.height * 0.35, b.center[1]],
    }
  }

  if (selection.kind === 'floor') {
    const f = FLOOR_LAYOUTS.find((x) => x.floor.id === selection.id)
    if (!f) return FACTORY_OVERVIEW
    const [fw, fd] = f.size
    // Selecting a floor also opens the building (see FloorSelector), so this
    // frames the whole level from just above and outside its open edge —
    // close enough to read individual rooms and plant, wide enough to see how
    // the level is zoned. Framing it from far outside while the envelope was
    // still closed was what previously showed the user a blank wall.
    return {
      position: [f.center[0] + fw * 0.52, f.elevation + 15, f.center[1] + fd * 0.78],
      target: [f.center[0], f.elevation + 1, f.center[1] - fd * 0.06],
    }
  }

  if (selection.kind === 'area') {
    const a = AREA_LAYOUTS.find((x) => x.area.id === selection.id)
    if (!a) return FACTORY_OVERVIEW
    const reach = Math.max(a.size[0], a.size[1]) * 2.4
    return {
      position: [a.center[0] + reach * 0.62, reach * 0.58, a.center[1] + reach * 0.62],
      target: [a.center[0], 1, a.center[1]],
    }
  }

  if (selection.kind === 'line') {
    const l = LINE_LAYOUTS.find((x) => x.line.id === selection.id)
    if (!l) return FACTORY_OVERVIEW
    const reach = Math.max(l.length, 10)
    return {
      position: [l.center[0] - reach * 0.15, reach * 0.95, l.center[1] + reach * 1.05],
      target: [l.center[0], 1.4, l.center[1]],
    }
  }

  if (selection.kind === 'room') {
    const r = ROOM_LAYOUTS.find((x) => x.room.id === selection.id)
    if (!r) return FACTORY_OVERVIEW
    const [rx, ry, rz] = r.position
    const reach = Math.max(r.size[0], r.size[1]) * 1.5
    return {
      position: [rx + reach * 0.8, ry + reach * 0.6, rz + reach * 0.9],
      target: [rx, ry + 1.4, rz],
    }
  }

  if (selection.kind === 'vehicle') {
    // Vehicles move, so their framing is computed from live route progress
    // rather than a fixed slot (the caller passes the current selection each
    // render, so this re-resolves as the vehicle drives).
    const placement = vehiclePosition(selection.id, VEHICLE_FRAME_PROGRESS.get(selection.id) ?? 0)
    if (!placement) return FACTORY_OVERVIEW
    const [vx, vy, vz] = placement.position
    return {
      position: [vx + 16, vy + 12, vz + 16],
      target: [vx, vy + 2, vz],
    }
  }

  if (selection.kind === 'stage') {
    const z = stageZoneById(selection.id)
    if (!z) return FACTORY_OVERVIEW
    const [zw, zd] = z.size
    const reach = Math.max(zw, zd)
    // Framed from outside the hoarding looking in, high enough to clear the
    // tower crane on the construction plot.
    return {
      position: [z.center[0] + reach * 0.85, reach * 0.72, z.center[1] + reach * 0.9],
      target: [z.center[0], 4, z.center[1]],
    }
  }

  if (selection.kind === 'bms') {
    const a = BMS_ASSET_LAYOUTS.find((x) => x.asset.id === selection.id)
    if (!a) return FACTORY_OVERVIEW
    const [ax, ay, az] = a.position
    const reach = Math.max(a.footprint[0], a.footprint[2]) * 3.4
    return {
      position: [ax + reach, ay + a.footprint[1] + reach * 0.7, az + reach],
      target: [ax, ay + a.footprint[1] * 0.5, az],
    }
  }

  if (selection.kind === 'camera') {
    const c = CAMERA_LAYOUTS.find((x) => x.camera.id === selection.id)
    if (!c) return FACTORY_OVERVIEW
    const [cx, cy, cz] = c.position
    // Stand behind the camera looking along its line of sight, so the shot
    // shows what the camera covers. Framing it from a fixed diagonal offset
    // instead pushes the viewpoint through whatever the camera is mounted
    // on — for a ceiling-mounted unit that means straight into the slab.
    const fx = Math.sin(c.rotationY)
    const fz = Math.cos(c.rotationY)
    return {
      position: [cx - fx * 11, cy + 5, cz - fz * 11],
      target: [cx + fx * 14, Math.max(1.5, cy - 3.5), cz + fz * 14],
    }
  }

  if (selection.kind === 'safety') {
    const s = SAFETY_ASSET_LAYOUTS.find((x) => x.asset.id === selection.id)
    if (!s) return FACTORY_OVERVIEW
    const [sx, sy, sz] = s.position
    return {
      position: [sx + 7, sy + 5, sz + 7],
      target: [sx, sy + 0.8, sz],
    }
  }

  // equipment
  const e = EQUIPMENT_LAYOUTS.find((x) => x.equipment.id === selection.id)
  if (!e) return FACTORY_OVERVIEW
  const [ex, , ez] = e.position
  const h = e.footprint[1]
  return {
    position: [ex + 8, h + 9, ez + 8],
    target: [ex, h * 0.5, ez],
  }
}

export const SITE_GROUND_HALF: [number, number] = [SITE_GROUND[0] / 2, SITE_GROUND[1] / 2]
