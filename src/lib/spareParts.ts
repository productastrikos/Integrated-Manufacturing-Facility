/**
 * Spare parts inventory, shared between the Maintenance module and the
 * cross-module cascade engine. It lives here rather than inside a page so
 * "which part does this failure need, and do we have it?" resolves to the
 * same answer whether it's asked by Equipment & Maintenance, by a
 * simulation scenario, or by Sia.
 */
export type SparePart = {
  id: string
  name: string
  onHand: number
  reorderAt: number
}

export const SPARE_PARTS: SparePart[] = [
  { id: 'SP-101', name: 'Drive Belt (Standard)', onHand: 14, reorderAt: 6 },
  { id: 'SP-204', name: 'Bearing Assembly (Type A)', onHand: 4, reorderAt: 5 },
  { id: 'SP-310', name: 'Filter Cartridge', onHand: 22, reorderAt: 10 },
  { id: 'SP-415', name: 'Vibration Sensor', onHand: 3, reorderAt: 4 },
  { id: 'SP-520', name: 'Motor Coupling', onHand: 9, reorderAt: 5 },
]

/**
 * Which part a given asset needs, keyed off the failure mode the asset is
 * actually showing rather than a random pick — a vibration fault pulls the
 * bearing/sensor parts, a thermal fault pulls the filter, and anything else
 * falls back to a stable per-asset assignment so the answer never changes
 * between two reads of the same equipment.
 */
export function sparePartForEquipment(equipmentId: string, symptom?: 'vibration' | 'temperature' | null): SparePart {
  if (symptom === 'vibration') return SPARE_PARTS[1]
  if (symptom === 'temperature') return SPARE_PARTS[2]
  const digits = equipmentId.replace(/\D/g, '')
  const n = digits ? Number.parseInt(digits, 10) : 0
  return SPARE_PARTS[n % SPARE_PARTS.length]
}

export function sparePartStatus(part: SparePart): 'ok' | 'low' | 'out' {
  if (part.onHand <= 0) return 'out'
  if (part.onHand <= part.reorderAt) return 'low'
  return 'ok'
}
