import type { BmsAsset, Floor, Room, SafetyAsset, Vehicle } from '../simulation/types'

/**
 * The spatial layer the Digital Twin navigates: building floors, the
 * building-services assets that physically sit on them, and the safety
 * infrastructure distributed through the facility. Every name here is a
 * universal manufacturing/facilities concept — nothing industry-specific.
 *
 * These records are the single source for BOTH the 3D scene and the BMS /
 * Safety module tables, so an asset can never appear in one and not the
 * other.
 */

export const SEED_FLOORS: Floor[] = [
  {
    id: 'FLR-G',
    name: 'Ground Floor',
    shortLabel: 'G',
    buildingId: 'BLD-PROD',
    level: 0,
    description: 'Material receiving, production lines, conveyors, inspection and the warehouse connection.',
  },
  {
    id: 'FLR-01',
    name: 'Floor 01',
    shortLabel: '1',
    buildingId: 'BLD-PROD',
    level: 1,
    description: 'Process control room, utility distribution skids and maintenance access platforms.',
  },
  {
    id: 'FLR-02',
    name: 'Floor 02',
    shortLabel: '2',
    buildingId: 'BLD-PROD',
    level: 2,
    description: 'Building services plant deck — air handling, chillers, electrical distribution and compressed air.',
  },
]

/** Vertical spacing between production-building levels, in scene units. */
export const FLOOR_HEIGHT = 7

export const SEED_BMS_ASSETS: BmsAsset[] = [
  // Floor 02 — the plant deck
  { id: 'AHU-01', name: 'Air Handling Unit 01', type: 'ahu', buildingId: 'BLD-PROD', floorId: 'FLR-02', zoneId: 'ZONE-PROD-A', system: 'HVAC', status: 'running', loadPct: 62, temperatureC: 22.4, powerKw: 48, speedPct: 70 },
  { id: 'AHU-02', name: 'Air Handling Unit 02', type: 'ahu', buildingId: 'BLD-PROD', floorId: 'FLR-02', zoneId: 'ZONE-PROD-B', system: 'HVAC', status: 'running', loadPct: 65, temperatureC: 22.9, powerKw: 51, speedPct: 73 },
  { id: 'AHU-03', name: 'Air Handling Unit 03', type: 'ahu', buildingId: 'BLD-PROD', floorId: 'FLR-02', zoneId: 'ZONE-PROD-B', system: 'HVAC', status: 'warning', loadPct: 84, temperatureC: 25.6, powerKw: 63, speedPct: 88 },
  { id: 'CHL-01', name: 'Chiller 01', type: 'chiller', buildingId: 'BLD-PROD', floorId: 'FLR-02', system: 'HVAC', status: 'running', loadPct: 58, temperatureC: 7.2, powerKw: 180, speedPct: 60 },
  { id: 'CHL-02', name: 'Chiller 02', type: 'chiller', buildingId: 'BLD-PROD', floorId: 'FLR-02', system: 'HVAC', status: 'idle', loadPct: 0, temperatureC: 18, powerKw: 4, speedPct: 0 },
  { id: 'PNL-01', name: 'Distribution Panel 01', type: 'panel', buildingId: 'BLD-PROD', floorId: 'FLR-02', system: 'Electrical', status: 'running', loadPct: 71, temperatureC: 34, powerKw: 0, speedPct: 0 },
  { id: 'CMP-01', name: 'Air Compressor 01', type: 'compressor', buildingId: 'BLD-PROD', floorId: 'FLR-02', system: 'Utilities', status: 'running', loadPct: 66, temperatureC: 41, powerKw: 75, speedPct: 68 },

  // Floor 01 — utility distribution
  { id: 'PMP-01', name: 'Process Water Pump 01', type: 'pump', buildingId: 'BLD-PROD', floorId: 'FLR-01', system: 'Utilities', status: 'running', loadPct: 54, temperatureC: 32, powerKw: 22, speedPct: 58 },
  { id: 'PMP-02', name: 'Process Water Pump 02', type: 'pump', buildingId: 'BLD-PROD', floorId: 'FLR-01', system: 'Utilities', status: 'idle', loadPct: 0, temperatureC: 24, powerKw: 1, speedPct: 0 },
  { id: 'PNL-02', name: 'Distribution Panel 02', type: 'panel', buildingId: 'BLD-PROD', floorId: 'FLR-01', system: 'Electrical', status: 'running', loadPct: 63, temperatureC: 31, powerKw: 0, speedPct: 0 },

  // Utility Area building
  { id: 'TRF-01', name: 'Transformer 01', type: 'transformer', buildingId: 'BLD-UTIL', floorId: 'FLR-UTIL', system: 'Electrical', status: 'running', loadPct: 68, temperatureC: 56, powerKw: 0, speedPct: 0 },
  { id: 'TRF-02', name: 'Transformer 02', type: 'transformer', buildingId: 'BLD-UTIL', floorId: 'FLR-UTIL', system: 'Electrical', status: 'running', loadPct: 61, temperatureC: 52, powerKw: 0, speedPct: 0 },
  { id: 'GEN-01', name: 'Standby Generator 01', type: 'generator', buildingId: 'BLD-UTIL', floorId: 'FLR-UTIL', system: 'Electrical', status: 'idle', loadPct: 0, temperatureC: 21, powerKw: 0, speedPct: 0 },
  { id: 'TNK-01', name: 'Process Water Tank 01', type: 'tank', buildingId: 'BLD-UTIL', floorId: 'FLR-UTIL', system: 'Utilities', status: 'running', loadPct: 74, temperatureC: 19, powerKw: 0, speedPct: 0 },
  { id: 'TNK-02', name: 'Process Water Tank 02', type: 'tank', buildingId: 'BLD-UTIL', floorId: 'FLR-UTIL', system: 'Utilities', status: 'running', loadPct: 69, temperatureC: 19, powerKw: 0, speedPct: 0 },

  // Administration building
  { id: 'AHU-04', name: 'Air Handling Unit 04', type: 'ahu', buildingId: 'BLD-ADMIN', floorId: 'FLR-ADMIN', zoneId: 'ZONE-ADM-1', system: 'HVAC', status: 'running', loadPct: 41, temperatureC: 21.8, powerKw: 26, speedPct: 48 },
]

export const SEED_SAFETY_ASSETS: SafetyAsset[] = [
  { id: 'SAF-EXT-01', name: 'Fire Extinguisher — Production Area A', type: 'extinguisher', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'ok', lastInspected: '2026-07-14' },
  { id: 'SAF-EXT-02', name: 'Fire Extinguisher — Production Area B', type: 'extinguisher', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'ok', lastInspected: '2026-07-14' },
  { id: 'SAF-EXT-03', name: 'Fire Extinguisher — Processing Area', type: 'extinguisher', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'due', lastInspected: '2026-01-09' },
  { id: 'SAF-EXT-04', name: 'Fire Extinguisher — Plant Deck', type: 'extinguisher', buildingId: 'BLD-PROD', floorId: 'FLR-02', status: 'ok', lastInspected: '2026-07-14' },
  { id: 'SAF-EXIT-01', name: 'Emergency Exit — North', type: 'exit', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'ok', lastInspected: '2026-08-02' },
  { id: 'SAF-EXIT-02', name: 'Emergency Exit — South', type: 'exit', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'ok', lastInspected: '2026-08-02' },
  { id: 'SAF-EXIT-03', name: 'Emergency Exit — Warehouse', type: 'exit', buildingId: 'BLD-WARE', floorId: 'FLR-WARE', status: 'ok', lastInspected: '2026-08-02' },
  { id: 'SAF-FP-01', name: 'Fire Detection Panel', type: 'firePanel', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'ok', lastInspected: '2026-08-19' },
  { id: 'SAF-EYE-01', name: 'Emergency Eyewash Station', type: 'eyewash', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'ok', lastInspected: '2026-06-30' },
  { id: 'SAF-AID-01', name: 'First Aid Station', type: 'firstAid', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'ok', lastInspected: '2026-06-30' },
  { id: 'SAF-MUS-01', name: 'Emergency Muster Point', type: 'muster', buildingId: 'BLD-PROD', floorId: 'FLR-G', status: 'ok', lastInspected: '2026-08-02' },
]

/**
 * Enclosed rooms inside the production building. These give each level a
 * finished interior — partition walls, doors and ceilings — instead of an
 * open deck, and add the Room level to the navigable hierarchy.
 */
export const SEED_ROOMS: Room[] = [
  // Ground floor — production support spaces around the line hall
  { id: 'RM-G-MH', name: 'Material Receiving', kind: 'storage', buildingId: 'BLD-PROD', floorId: 'FLR-G', description: 'Inbound material staging between the warehouse link and the production floor.', capacity: 8 },
  { id: 'RM-G-QA', name: 'Inspection Room', kind: 'quality', buildingId: 'BLD-PROD', floorId: 'FLR-G', description: 'Measurement and sampling stations serving the production lines.', capacity: 6 },
  { id: 'RM-G-MNT', name: 'Line-side Maintenance', kind: 'maintenance', buildingId: 'BLD-PROD', floorId: 'FLR-G', description: 'Workbenches and spares held at the line for first-response repairs.', capacity: 5 },
  { id: 'RM-G-STAFF', name: 'Staff Facilities', kind: 'staff', buildingId: 'BLD-PROD', floorId: 'FLR-G', description: 'Changing area, break room and first aid station.', capacity: 40 },

  // Floor 01 — control and distribution
  { id: 'RM-01-CTL', name: 'Operations Control Room', kind: 'control', buildingId: 'BLD-PROD', floorId: 'FLR-01', description: 'Central monitoring for all production lines, overlooking the floor.', capacity: 8 },
  { id: 'RM-01-ELEC', name: 'Electrical Room', kind: 'electrical', buildingId: 'BLD-PROD', floorId: 'FLR-01', description: 'Distribution boards and switchgear feeding the production floor.', capacity: 3 },
  { id: 'RM-01-SRV', name: 'Server / IT Room', kind: 'server', buildingId: 'BLD-PROD', floorId: 'FLR-01', description: 'Network and control-system racks with dedicated cooling.', capacity: 3 },
  { id: 'RM-01-PROC', name: 'Procurement & Receiving Office', kind: 'control', buildingId: 'BLD-PROD', floorId: 'FLR-01', description: 'Purchase orders, supplier scheduling and inbound goods receipt.', capacity: 6 },

  // Floor 02 — plant
  { id: 'RM-02-MECH', name: 'Mechanical Plant Room', kind: 'mechanical', buildingId: 'BLD-PROD', floorId: 'FLR-02', description: 'Air handling, chillers and compressed air serving the building.', capacity: 4 },
  { id: 'RM-02-ELEC', name: 'HV Switch Room', kind: 'electrical', buildingId: 'BLD-PROD', floorId: 'FLR-02', description: 'High-voltage distribution and metering for the production building.', capacity: 2 },
  { id: 'RM-02-STORE', name: 'Plant Store', kind: 'storage', buildingId: 'BLD-PROD', floorId: 'FLR-02', description: 'Filters, belts and consumables for building services maintenance.', capacity: 4 },
  // East side of Floor 02 is the security wing, facing the HVAC plant across a central corridor.
  { id: 'RM-02-SOC', name: 'Security Operations Centre', kind: 'security', buildingId: 'BLD-PROD', floorId: 'FLR-02', description: 'CCTV monitoring wall, access-control administration and incident response.', capacity: 6 },
  { id: 'RM-02-SRV', name: 'Security Server Room', kind: 'server', buildingId: 'BLD-PROD', floorId: 'FLR-02', description: 'Video recording, access-control controllers and network core.', capacity: 2 },
]

export const SEED_VEHICLES: Vehicle[] = [
  { id: 'TRK-024', kind: 'truck', name: 'Inbound Material Truck', status: 'unloading', load: 'Steel Coil', loadPct: 74, origin: 'Supplier Depot', destination: 'Receiving Dock 01', etaMinutes: 0, speedKph: 0, routeProgress: 0.5, materialId: 'RM-1001' },
  { id: 'TRK-031', kind: 'truck', name: 'Finished Goods Truck', status: 'loading', load: 'Finished Assemblies', loadPct: 38, origin: 'Dispatch Bay 03', destination: 'Distribution Centre', etaMinutes: 18, speedKph: 0, routeProgress: 0.5 },
  { id: 'TRK-047', kind: 'truck', name: 'Outbound Truck', status: 'in-transit', load: 'Finished Assemblies', loadPct: 100, origin: 'Dispatch Bay 02', destination: 'Main Gate', etaMinutes: 3, speedKph: 12, routeProgress: 0 },
  { id: 'FLT-06', kind: 'forklift', name: 'Yard Forklift 06', status: 'in-transit', load: 'Pallet PAL-02481', loadPct: 100, origin: 'Dispatch Yard', destination: 'Dispatch Bay 03', etaMinutes: 1, speedKph: 7, routeProgress: 0 },
  { id: 'FLT-09', kind: 'forklift', name: 'Warehouse Forklift 09', status: 'in-transit', load: 'Pallet PAL-02502', loadPct: 100, origin: 'Warehouse Aisle B', destination: 'Material Receiving', etaMinutes: 2, speedKph: 6, routeProgress: 0.3 },
]
