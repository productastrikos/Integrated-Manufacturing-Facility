import type { SelectionKind } from './selection'
import type { TourId } from './tourStops'

/**
 * Builds a link to the Digital Twin that focuses a specific object on
 * load. Passing `tour` also starts that guided tour on arrival — used by
 * the Procurement stage's "Walk the Material Flow" link, so following it
 * from Operations doesn't just point a camera at a room, it walks the
 * whole receiving-to-dispatch pipeline the way the Digital Twin already
 * knows how to.
 */
export function twinLink(kind: SelectionKind, id: string, opts?: { tour?: TourId }): string {
  const base = `/app/digital-twin?focus=${kind}:${encodeURIComponent(id)}`
  return opts?.tour ? `${base}&tour=${opts.tour}` : base
}

/** Reads the `tour` query param, if present and a known tour id. */
export function parseTourParam(search: string): TourId | null {
  const raw = new URLSearchParams(search).get('tour')
  return raw === 'facility' || raw === 'material-flow' ? raw : null
}

/** Reads the `focus` query param back into a selection, if present and well-formed. */
export function parseFocusParam(search: string): { kind: SelectionKind; id: string } | null {
  const raw = new URLSearchParams(search).get('focus')
  if (!raw) return null
  const sep = raw.indexOf(':')
  if (sep < 0) return null
  const kind = raw.slice(0, sep)
  const id = decodeURIComponent(raw.slice(sep + 1))
  if (!id) return null
  const KINDS = ['site', 'building', 'floor', 'room', 'area', 'line', 'equipment', 'bms', 'camera', 'safety', 'vehicle', 'stage']
  if (!KINDS.includes(kind)) return null
  return { kind: kind as SelectionKind, id }
}

/** Maps a camera/warehouse "location" name to the building the twin can actually focus. */
export const LOCATION_TO_BUILDING: Record<string, string> = {
  'Main Gate': 'BLD-GATE',
  'Production Floor': 'BLD-PROD',
  Warehouse: 'BLD-WARE',
  'Warehouse Zone A': 'BLD-WARE',
  'Warehouse Zone B': 'BLD-WARE',
  'Warehouse Zone C': 'BLD-WARE',
  'Loading Bay': 'BLD-LOAD',
  'Restricted Area': 'BLD-SEC',
  'Utility Area': 'BLD-UTIL',
}
