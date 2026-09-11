import type { FloorMode, Selection } from './selection'

/**
 * One stop on a guided tour: what to select, how long to dwell there, and
 * (for stops on a specific building level) which floor to isolate so the
 * level reads clearly instead of showing every floor's contents stacked
 * together.
 */
export type TourStop = {
  id: string
  /** Short name shown in the tour bar. */
  title: string
  /** One line of context shown under the title. */
  caption: string
  /** null means the factory overview — nothing selected. */
  selection: Selection
  floor?: { activeFloorId: string; mode: FloorMode }
  dwellMs: number
}

export type TourId = 'facility' | 'material-flow'

export const TOUR_LABEL: Record<TourId, string> = {
  facility: 'Full Facility Tour',
  'material-flow': 'Material Flow: Receiving → Dispatch',
}

/**
 * The end-to-end facility walkthrough: entrance → warehouse → the
 * production floor → the building-services level (its HVAC wing, then its
 * security wing) → quality → shipping → the two off-building stages → back
 * to overview. Each stop is a real selection the rest of the twin already
 * understands, so the same camera framing, info panel and breadcrumb trail
 * a manual click would produce is what the tour shows.
 */
export const FACILITY_TOUR_STOPS: TourStop[] = [
  { id: 'overview', title: 'Facility Overview', caption: 'The complete manufacturing campus.', selection: null, dwellMs: 5000 },
  { id: 'gate', title: 'Main Gate', caption: 'Site entrance, access control and the gatehouse.', selection: { kind: 'building', id: 'BLD-GATE' }, dwellMs: 5000 },
  { id: 'admin', title: 'Administration Building', caption: 'Offices, reception and the site management functions.', selection: { kind: 'building', id: 'BLD-ADMIN' }, dwellMs: 5000 },
  { id: 'warehouse', title: 'Warehouse', caption: 'Storage racks, pallets and the receiving dock.', selection: { kind: 'building', id: 'BLD-WARE' }, dwellMs: 6000 },
  {
    id: 'procurement',
    title: 'Procurement & Receiving',
    caption: 'Purchase orders and inbound goods receipt, on Floor 01.',
    selection: { kind: 'room', id: 'RM-01-PROC' },
    floor: { activeFloorId: 'FLR-01', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'production-floor',
    title: 'Production Floor',
    caption: 'The ground floor — production areas, lines and equipment.',
    selection: { kind: 'floor', id: 'FLR-G' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'production-line',
    title: 'Production Line 01',
    caption: 'A line of physically connected equipment converting material into output.',
    selection: { kind: 'line', id: 'LINE-01' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'equipment',
    title: 'Equipment Close-up',
    caption: 'Live sensor data — health, temperature, vibration and load.',
    selection: { kind: 'equipment', id: 'EQUIPMENT-002' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'quality',
    title: 'Inspection & Quality',
    caption: 'Measurement stations checking output before it moves on.',
    selection: { kind: 'area', id: 'AREA-QA' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 5000,
  },
  {
    id: 'control-room',
    title: 'Operations Control Room',
    caption: 'Central monitoring for every production line, on Floor 01.',
    selection: { kind: 'room', id: 'RM-01-CTL' },
    floor: { activeFloorId: 'FLR-01', mode: 'isolate' },
    dwellMs: 5000,
  },
  {
    id: 'hvac-wing',
    title: 'Building Services — HVAC Wing',
    caption: 'Air handling units, chillers and compressed air on Floor 02.',
    selection: { kind: 'room', id: 'RM-02-MECH' },
    floor: { activeFloorId: 'FLR-02', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'security-wing',
    title: 'Building Services — Security Wing',
    caption: "Floor 02's other half: the Security Operations Centre.",
    selection: { kind: 'room', id: 'RM-02-SOC' },
    floor: { activeFloorId: 'FLR-02', mode: 'isolate' },
    dwellMs: 6000,
  },
  { id: 'security-area', title: 'Security Area', caption: 'Perimeter security and the main gatehouse camera coverage.', selection: { kind: 'building', id: 'BLD-SEC' }, dwellMs: 5000 },
  { id: 'utility', title: 'Utility Area', caption: 'Transformers, standby power and site water tanks.', selection: { kind: 'building', id: 'BLD-UTIL' }, dwellMs: 5000 },
  { id: 'loading', title: 'Loading & Dispatch', caption: 'Finished goods staged and loaded onto outbound vehicles.', selection: { kind: 'building', id: 'BLD-LOAD' }, dwellMs: 5000 },
  {
    id: 'commissioning',
    title: 'Commissioning & Test Yard',
    caption: 'Finished equipment run up under load and signed off before shipping.',
    selection: { kind: 'stage', id: 'installation' },
    dwellMs: 6000,
  },
  {
    id: 'construction',
    title: 'Capital Works Site',
    caption: 'A plant extension actually under construction on the expansion plot.',
    selection: { kind: 'stage', id: 'construction' },
    dwellMs: 6000,
  },
]

/**
 * The material flow: the path one unit of production physically follows
 * from the moment it arrives on site to the moment it leaves. Each stop
 * maps onto the closest real zone already modelled in the twin — this is
 * a POV walk of the pipeline, not a separate diagram, so "Quality" here is
 * the same Inspection/Quality Area the facility tour and the Quality
 * module both point at.
 */
export const MATERIAL_FLOW_STOPS: TourStop[] = [
  {
    id: 'receiving',
    title: 'Receiving',
    caption: 'Inbound material staging between the warehouse link and the production floor.',
    selection: { kind: 'room', id: 'RM-G-MH' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'storage',
    title: 'Storage',
    caption: 'The warehouse — racked and staged until material is called forward.',
    selection: { kind: 'building', id: 'BLD-WARE' },
    dwellMs: 6000,
  },
  {
    id: 'preparation',
    title: 'Preparation',
    caption: 'Material Handling Area — staged and moved onto the lines.',
    selection: { kind: 'area', id: 'AREA-MH' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'production',
    title: 'Production',
    caption: 'Production Area A — the primary conversion lines.',
    selection: { kind: 'area', id: 'AREA-A' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'assembly',
    title: 'Assembly',
    caption: 'Production Area B — downstream lines building on Area A’s output.',
    selection: { kind: 'area', id: 'AREA-B' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'quality',
    title: 'Quality',
    caption: 'Inspection / Quality Area — checked before it is allowed to move on.',
    selection: { kind: 'area', id: 'AREA-QA' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'packaging',
    title: 'Packaging',
    caption: 'Packaging Area — finishing and packing for dispatch.',
    selection: { kind: 'area', id: 'AREA-PACK' },
    floor: { activeFloorId: 'FLR-G', mode: 'isolate' },
    dwellMs: 6000,
  },
  {
    id: 'finished-goods',
    title: 'Finished Goods',
    caption: 'Loading / Dispatch — packed output staged ready to load.',
    selection: { kind: 'building', id: 'BLD-LOAD' },
    dwellMs: 6000,
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    caption: 'Loaded and on its way out through the main gate.',
    selection: { kind: 'vehicle', id: 'TRK-047' },
    dwellMs: 6000,
  },
]

export const TOUR_STOPS_BY_ID: Record<TourId, TourStop[]> = {
  facility: FACILITY_TOUR_STOPS,
  'material-flow': MATERIAL_FLOW_STOPS,
}
