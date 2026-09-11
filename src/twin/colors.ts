import type { EquipmentStatus, LineStatus } from '../simulation/types'

/**
 * Hex equivalents of the app's CSS status tokens, for use in Three.js
 * materials (which need real color values, not CSS custom properties).
 * Kept in one place so the twin's palette never drifts from the rest of
 * the product's muted, industrial language.
 */
export const STATUS_HEX: Record<EquipmentStatus | LineStatus, number> = {
  running: 0x5aa578,
  idle: 0x454d55,
  warning: 0xc79a45,
  critical: 0xc06a5c,
  offline: 0x6e7780,
  maintenance: 0x6f9dc4,
}

/** Selection/focus accent for the 3D twin — amber, distinct from status colors, per the twin's own visual language. */
export const ACCENT_HEX = 0xd9a441

/**
 * Sky/fog per time-of-day preset. Fog color intentionally matches the sky
 * background (see DigitalTwin.tsx) so the haze reads as atmosphere rather
 * than a visible boundary.
 */
export const SKY = {
  // Daylight sky, not the app's panel background — an overcast-bright
  // steel blue. A near-black sky was what made "day" read as dusk.
  day: { bg: '#8fa6bb', fogNear: 110, fogFar: 340 },
  // Deeper and cooler than day, with fog pulled in a bit closer — a facility
  // at night reads by its own lights, not by seeing all the way to the fence.
  night: { bg: '#060911', fogNear: 45, fogFar: 210 },
} as const

export const MATERIAL_HEX = {
  steel: 0x7b858f,
  steelDark: 0x565f68,
  concrete: 0x454e57,
  concreteLight: 0x525c66,
  wall: 0x3e4650,
  wallLight: 0x525c66,
  // Cooler and warmer wall variants so buildings read as distinct real
  // structures rather than one material repeated across the whole campus.
  wallCool: 0x4c5866,
  wallWarm: 0x5c5347,
  roof: 0x2c333a,
  // A touch more saturated/cyan than a flat grey-blue — reads as glazing
  // catching the sky rather than a dull panel.
  glass: 0x5f93bd,
  road: 0x2a2f35,
  walkway: 0x626d78,
  hazard: 0xc79a45,
  fence: 0x6b7580,
  rack: 0x8a6a3a,
  pallet: 0x9c7a4a,
  tank: 0x6d7882,
  transformer: 0x3a4148,
  pipe: 0x5c6970,
  // Slightly less matte than the general concrete, so the ground picks up
  // a little of the ambient light and status glow above it.
  groundReflective: 0x3d4650,
}

/** Warm sodium-vapor tone for the night-time perimeter/entrance floodlights — distinct from the cool moonlight key light so the site reads as lit by its own fixtures. */
export const FLOODLIGHT_HEX = 0xffb066
