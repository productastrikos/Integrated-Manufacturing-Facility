import * as THREE from 'three'
import { MATERIAL_HEX, STATUS_HEX } from './colors'
import type { EquipmentStatus, LineStatus } from '../simulation/types'

/**
 * Shared, reusable geometries and materials — created exactly once at
 * module scope, then referenced (not cloned) by every mesh that needs
 * them. Equipment bodies scale a unit box/cylinder/cone rather than each
 * allocating their own BufferGeometry, and status materials are cached
 * per status so 30 equipment units share a handful of material objects.
 */

export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
export const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 20)
export const UNIT_CONE = new THREE.ConeGeometry(0.5, 1, 16)
export const UNIT_SPHERE = new THREE.SphereGeometry(0.5, 16, 12)

/**
 * Base emissive intensity and breathing-pulse settings per status. Critical
 * pulses noticeably faster than a normal running unit; idle/offline/
 * maintenance hold a steady low glow rather than breathing, since a slow
 * pulse on every unit at once would read as scene-wide flicker instead of
 * drawing attention to what actually needs it.
 */
const STATUS_PULSE: Record<EquipmentStatus | LineStatus, { base: number; amplitude: number; speed: number }> = {
  running: { base: 0.22, amplitude: 0.12, speed: 1.1 },
  warning: { base: 0.4, amplitude: 0.22, speed: 2.2 },
  critical: { base: 0.55, amplitude: 0.3, speed: 3.6 },
  idle: { base: 0.06, amplitude: 0, speed: 0 },
  offline: { base: 0.03, amplitude: 0, speed: 0 },
  maintenance: { base: 0.3, amplitude: 0.08, speed: 0.7 },
}

const statusMaterialCache = new Map<string, THREE.MeshStandardMaterial>()
export function getStatusMaterial(status: EquipmentStatus | LineStatus): THREE.MeshStandardMaterial {
  const cached = statusMaterialCache.get(status)
  if (cached) return cached
  const mat = new THREE.MeshStandardMaterial({
    color: STATUS_HEX[status],
    roughness: 0.5,
    metalness: 0.2,
    emissive: STATUS_HEX[status],
    emissiveIntensity: STATUS_PULSE[status].base,
  })
  statusMaterialCache.set(status, mat)
  return mat
}

/**
 * Advances every cached status material's emissive intensity along its own
 * slow "breathing" sine wave. Called once per frame from a single driver
 * component (see StatusPulseDriver) rather than per mesh — every equipment
 * body, status stripe and beacon that shares a status material (running,
 * warning, critical, …) picks up the same pulse for free, since they all
 * reference the one cached THREE.Material instance rather than a clone.
 */
export function updateStatusMaterialPulses(elapsedTime: number) {
  statusMaterialCache.forEach((mat, status) => {
    const p = STATUS_PULSE[status as EquipmentStatus | LineStatus]
    if (!p || p.amplitude === 0) return
    mat.emissiveIntensity = p.base + p.amplitude * (0.5 + 0.5 * Math.sin(elapsedTime * p.speed))
  })
}

const neutralCache = new Map<number, THREE.MeshStandardMaterial>()
export function getNeutralMaterial(hex: number, roughness = 0.75, metalness = 0.15): THREE.MeshStandardMaterial {
  const key = hex * 1000 + roughness * 10 + metalness
  const cached = neutralCache.get(key)
  if (cached) return cached
  const mat = new THREE.MeshStandardMaterial({ color: hex, roughness, metalness })
  neutralCache.set(key, mat)
  return mat
}

export const MATERIALS = {
  steel: getNeutralMaterial(MATERIAL_HEX.steel, 0.45, 0.55),
  steelDark: getNeutralMaterial(MATERIAL_HEX.steelDark, 0.5, 0.5),
  concrete: getNeutralMaterial(MATERIAL_HEX.concrete, 0.95, 0),
  concreteLight: getNeutralMaterial(MATERIAL_HEX.concreteLight, 0.9, 0),
  wall: getNeutralMaterial(MATERIAL_HEX.wall, 0.85, 0.05),
  wallLight: getNeutralMaterial(MATERIAL_HEX.wallLight, 0.8, 0.05),
  wallCool: getNeutralMaterial(MATERIAL_HEX.wallCool, 0.75, 0.12),
  wallWarm: getNeutralMaterial(MATERIAL_HEX.wallWarm, 0.82, 0.06),
  roof: getNeutralMaterial(MATERIAL_HEX.roof, 0.7, 0.1),
  glass: getNeutralMaterial(MATERIAL_HEX.glass, 0.2, 0.6),
  road: getNeutralMaterial(MATERIAL_HEX.road, 0.95, 0),
  walkway: getNeutralMaterial(MATERIAL_HEX.walkway, 0.9, 0),
  fence: getNeutralMaterial(MATERIAL_HEX.fence, 0.6, 0.3),
  rack: getNeutralMaterial(MATERIAL_HEX.rack, 0.7, 0.2),
  pallet: getNeutralMaterial(MATERIAL_HEX.pallet, 0.85, 0),
  tank: getNeutralMaterial(MATERIAL_HEX.tank, 0.4, 0.6),
  transformer: getNeutralMaterial(MATERIAL_HEX.transformer, 0.55, 0.4),
  pipe: getNeutralMaterial(MATERIAL_HEX.pipe, 0.45, 0.5),
  // Lower roughness + a touch of metalness than the general concrete, so
  // the outdoor ground plane picks up ambient light and status glow
  // instead of sitting as a flat, light-absorbing fill.
  groundReflective: getNeutralMaterial(MATERIAL_HEX.groundReflective, 0.55, 0.12),
}
