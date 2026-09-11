import type { BmsZone, Camera, InboundShipment, Material, OutboundShipment, PurchaseOrder, Supplier } from '../simulation/types'

/**
 * Seed data for the Phase 3 modules. Generic manufacturing concepts only —
 * zones, cameras and materials use universal names, nothing industry-specific.
 */

export const SEED_BMS_ZONES: BmsZone[] = [
  { id: 'ZONE-ADM-1', name: 'Admin Open Office', buildingId: 'BLD-ADMIN', floor: 'Floor 1', temperatureC: 22, humidityPct: 42, co2Ppm: 520, airQualityIndex: 28, coolingLoadPct: 40, status: 'Normal' },
  { id: 'ZONE-ADM-2', name: 'Admin Meeting Suite', buildingId: 'BLD-ADMIN', floor: 'Floor 2', temperatureC: 21.5, humidityPct: 40, co2Ppm: 480, airQualityIndex: 25, coolingLoadPct: 32, status: 'Normal' },
  { id: 'ZONE-PROD-A', name: 'Production Area A', buildingId: 'BLD-PROD', floor: 'Floor 1', temperatureC: 24, humidityPct: 46, co2Ppm: 640, airQualityIndex: 34, coolingLoadPct: 62, status: 'Normal' },
  { id: 'ZONE-PROD-B', name: 'Production Area B', buildingId: 'BLD-PROD', floor: 'Floor 1', temperatureC: 24.5, humidityPct: 47, co2Ppm: 660, airQualityIndex: 36, coolingLoadPct: 65, status: 'Normal' },
  { id: 'ZONE-WARE-1', name: 'Warehouse Floor', buildingId: 'BLD-WARE', floor: 'Floor 1', temperatureC: 19, humidityPct: 50, co2Ppm: 460, airQualityIndex: 22, coolingLoadPct: 20, status: 'Normal' },
  { id: 'ZONE-UTIL-1', name: 'Utility Plant Room', buildingId: 'BLD-UTIL', floor: 'Floor 1', temperatureC: 27, humidityPct: 38, co2Ppm: 500, airQualityIndex: 30, coolingLoadPct: 55, status: 'Normal' },
]

export const SEED_CAMERAS: Camera[] = [
  { id: 'CAM-01', name: 'Main Gate', location: 'Main Gate', buildingId: 'BLD-GATE', status: 'online', lastEventAt: null },
  { id: 'CAM-02', name: 'Production Floor', location: 'Production Floor', buildingId: 'BLD-PROD', status: 'online', lastEventAt: null },
  { id: 'CAM-03', name: 'Warehouse', location: 'Warehouse', buildingId: 'BLD-WARE', status: 'online', lastEventAt: null },
  { id: 'CAM-04', name: 'Loading Bay', location: 'Loading Bay', buildingId: 'BLD-LOAD', status: 'online', lastEventAt: null },
  { id: 'CAM-05', name: 'Restricted Area', location: 'Restricted Area', buildingId: 'BLD-SEC', status: 'online', lastEventAt: null },
  { id: 'CAM-06', name: 'Utility Area', location: 'Utility Area', buildingId: 'BLD-UTIL', status: 'online', lastEventAt: null },
]

/* --------------------------------------------------- materials & logistics -- */

const DAY = 86_400_000
const eta = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY).toISOString()

export const SEED_SUPPLIERS: Supplier[] = [
  { id: 'SUP-ALPHA', name: 'Supplier Alpha', onTimePct: 96.4, avgLeadTimeDays: 2.8, activeOrders: 4, delayedOrders: 0, reliability: 'Excellent' },
  { id: 'SUP-BETA', name: 'Supplier Beta', onTimePct: 91.2, avgLeadTimeDays: 4.1, activeOrders: 3, delayedOrders: 1, reliability: 'Good' },
  { id: 'SUP-GAMMA', name: 'Supplier Gamma', onTimePct: 78.6, avgLeadTimeDays: 3.9, activeOrders: 5, delayedOrders: 2, reliability: 'At Risk' },
  { id: 'SUP-DELTA', name: 'Supplier Delta', onTimePct: 89.0, avgLeadTimeDays: 5.4, activeOrders: 2, delayedOrders: 0, reliability: 'Good' },
]

// Deliberately spans every status band (healthy/low/critical/out-of-stock/
// overstock) so Materials & Logistics always has a real, live mix to show —
// not a page that depends on session drift to ever look interesting.
export const SEED_MATERIALS: Material[] = [
  { id: 'RM-1001', materialCode: 'RM-1001', name: 'Steel Coil', category: 'Raw Material', unit: 'kg', stockLevel: 8420, capacity: 15000, reorderLevel: 5000, minimumStock: 2000, warehouseZone: 'Zone A', unitValue: 0.85, dailyConsumption: 920, supplierId: 'SUP-ALPHA', leadTimeDays: 3, incomingQuantity: 8000, incomingETA: eta(1), productionLines: ['LINE-01', 'LINE-02'] },
  { id: 'RM-1002', materialCode: 'RM-1002', name: 'Aluminum Sheet', category: 'Raw Material', unit: 'kg', stockLevel: 6100, capacity: 12000, reorderLevel: 4000, minimumStock: 1500, warehouseZone: 'Zone A', unitValue: 1.6, dailyConsumption: 540, supplierId: 'SUP-ALPHA', leadTimeDays: 3, incomingQuantity: 0, incomingETA: null, productionLines: ['LINE-01'] },
  { id: 'RM-1003', materialCode: 'RM-1003', name: 'Polymer Resin', category: 'Raw Material', unit: 'kg', stockLevel: 5200, capacity: 10000, reorderLevel: 3000, minimumStock: 1200, warehouseZone: 'Zone A', unitValue: 2.1, dailyConsumption: 480, supplierId: 'SUP-BETA', leadTimeDays: 4, incomingQuantity: 4000, incomingETA: eta(2), productionLines: ['LINE-03'] },
  { id: 'CMP-2001', materialCode: 'CMP-2001', name: 'Bearings', category: 'Component', unit: 'units', stockLevel: 9600, capacity: 14000, reorderLevel: 3000, minimumStock: 1000, warehouseZone: 'Zone B', unitValue: 3.5, dailyConsumption: 260, supplierId: 'SUP-ALPHA', leadTimeDays: 3, incomingQuantity: 0, incomingETA: null, productionLines: ['LINE-01', 'LINE-02'] },
  // Below reorder point with only ~3.4 days of cover — the LOW example the procurement panel is built to catch.
  { id: 'CMP-2002', materialCode: 'CMP-2002', name: 'Fasteners', category: 'Component', unit: 'units', stockLevel: 2180, capacity: 8000, reorderLevel: 3000, minimumStock: 800, warehouseZone: 'Zone B', unitValue: 0.35, dailyConsumption: 640, supplierId: 'SUP-BETA', leadTimeDays: 4, incomingQuantity: 4000, incomingETA: eta(2), productionLines: ['LINE-02'] },
  { id: 'CMP-2003', materialCode: 'CMP-2003', name: 'Electronic Controllers', category: 'Component', unit: 'units', stockLevel: 3400, capacity: 6000, reorderLevel: 1500, minimumStock: 500, warehouseZone: 'Zone B', unitValue: 42, dailyConsumption: 180, supplierId: 'SUP-DELTA', leadTimeDays: 6, incomingQuantity: 0, incomingETA: null, productionLines: ['LINE-03'] },
  // ~64 days of cover — the OVERSTOCK example.
  { id: 'CMP-2004', materialCode: 'CMP-2004', name: 'Motor Assemblies', category: 'Component', unit: 'units', stockLevel: 14200, capacity: 16000, reorderLevel: 4000, minimumStock: 1000, warehouseZone: 'Zone B', unitValue: 185, dailyConsumption: 220, supplierId: 'SUP-ALPHA', leadTimeDays: 3, incomingQuantity: 0, incomingETA: null, productionLines: ['LINE-01'] },
  // ~2.3 days of cover — the CRITICAL example the whole procurement workflow is demonstrated against.
  { id: 'PKG-3001', materialCode: 'PKG-3001', name: 'Packaging Film', category: 'Packaging', unit: 'rolls', stockLevel: 420, capacity: 5000, reorderLevel: 800, minimumStock: 200, warehouseZone: 'Zone C', unitValue: 12, dailyConsumption: 180, supplierId: 'SUP-GAMMA', leadTimeDays: 2, incomingQuantity: 3000, incomingETA: eta(1), productionLines: ['LINE-03'] },
  { id: 'PKG-3002', materialCode: 'PKG-3002', name: 'Corrugated Boxes', category: 'Packaging', unit: 'units', stockLevel: 12400, capacity: 20000, reorderLevel: 5000, minimumStock: 1500, warehouseZone: 'Zone C', unitValue: 1.2, dailyConsumption: 900, supplierId: 'SUP-GAMMA', leadTimeDays: 3, incomingQuantity: 0, incomingETA: null, productionLines: ['LINE-02', 'LINE-03'] },
  // ~5.2 days of cover, already below reorder — the LOW example used for the review (non-critical) flow.
  { id: 'CON-4001', materialCode: 'CON-4001', name: 'Industrial Lubricant', category: 'Consumable', unit: 'L', stockLevel: 320, capacity: 2000, reorderLevel: 500, minimumStock: 150, warehouseZone: 'Zone D', unitValue: 6.5, dailyConsumption: 62, supplierId: 'SUP-BETA', leadTimeDays: 3, incomingQuantity: 0, incomingETA: null, productionLines: ['LINE-01', 'LINE-02', 'LINE-03'] },
  { id: 'CON-4002', materialCode: 'CON-4002', name: 'Safety Components', category: 'Consumable', unit: 'units', stockLevel: 1840, capacity: 3000, reorderLevel: 600, minimumStock: 200, warehouseZone: 'Zone D', unitValue: 9, dailyConsumption: 45, supplierId: 'SUP-DELTA', leadTimeDays: 5, incomingQuantity: 0, incomingETA: null, productionLines: ['LINE-01'] },
  // Zero stock — the OUT OF STOCK example.
  { id: 'CON-4003', materialCode: 'CON-4003', name: 'Cleaning Solvent', category: 'Consumable', unit: 'L', stockLevel: 0, capacity: 1200, reorderLevel: 500, minimumStock: 100, warehouseZone: 'Zone D', unitValue: 4, dailyConsumption: 90, supplierId: 'SUP-GAMMA', leadTimeDays: 2, incomingQuantity: 0, incomingETA: null, productionLines: ['LINE-02'] },
]

export const SEED_PURCHASE_ORDERS: PurchaseOrder[] = [
  { id: 'PO-1', poNumber: 'PO-2026-00118', materialId: 'PKG-3001', supplierId: 'SUP-GAMMA', quantity: 3000, unit: 'rolls', orderedAt: eta(-1), expectedDelivery: eta(1), status: 'ordered', priority: 'urgent', reason: 'Stock below critical threshold' },
  { id: 'PO-2', poNumber: 'PO-2026-00119', materialId: 'CMP-2002', supplierId: 'SUP-BETA', quantity: 4000, unit: 'units', orderedAt: eta(-1), expectedDelivery: eta(2), status: 'ordered', priority: 'high', reason: 'Below reorder point' },
  { id: 'PO-3', poNumber: 'PO-2026-00120', materialId: 'RM-1003', supplierId: 'SUP-BETA', quantity: 4000, unit: 'kg', orderedAt: eta(-3), expectedDelivery: eta(2), status: 'partially-received', priority: 'standard', reason: 'Scheduled replenishment' },
  { id: 'PO-4', poNumber: 'PO-2026-00121', materialId: 'RM-1001', supplierId: 'SUP-ALPHA', quantity: 8000, unit: 'kg', orderedAt: eta(-2), expectedDelivery: eta(1), status: 'ordered', priority: 'standard', reason: 'Scheduled replenishment' },
  { id: 'PO-5', poNumber: 'PO-2026-00122', materialId: 'CON-4001', supplierId: 'SUP-BETA', quantity: 1000, unit: 'L', orderedAt: eta(0), expectedDelivery: eta(3), status: 'pending-approval', priority: 'high', reason: 'Below reorder point' },
  { id: 'PO-6', poNumber: 'PO-2026-00123', materialId: 'CON-4003', supplierId: 'SUP-GAMMA', quantity: 1200, unit: 'L', orderedAt: eta(-2), expectedDelivery: eta(-0.2), status: 'delayed', priority: 'urgent', reason: 'Stock exhausted' },
  { id: 'PO-7', poNumber: 'PO-2026-00124', materialId: 'CMP-2003', supplierId: 'SUP-DELTA', quantity: 2000, unit: 'units', orderedAt: eta(0), expectedDelivery: eta(6), status: 'draft', priority: 'standard', reason: 'Scheduled replenishment' },
  { id: 'PO-8', poNumber: 'PO-2026-00125', materialId: 'CMP-2001', supplierId: 'SUP-ALPHA', quantity: 3000, unit: 'units', orderedAt: eta(-6), expectedDelivery: eta(-3), status: 'received', priority: 'standard', reason: 'Scheduled replenishment' },
]

export const SEED_INBOUND_SHIPMENTS: InboundShipment[] = [
  { id: 'SHP-IN-01', supplierId: 'SUP-ALPHA', materialId: 'RM-1001', quantity: 8000, unit: 'kg', truck: 'TRK-024', gate: 'Gate 01', etaLabel: '14:30', destinationZone: 'Zone A', status: 'on-time', vehicleId: 'TRK-024' },
  { id: 'SHP-IN-02', supplierId: 'SUP-DELTA', materialId: 'CMP-2003', quantity: 4000, unit: 'units', truck: 'TR-031', gate: 'Gate 02', etaLabel: 'Tomorrow 09:15', destinationZone: 'Zone B', status: 'on-time' },
  { id: 'SHP-IN-03', supplierId: 'SUP-GAMMA', materialId: 'PKG-3001', quantity: 3000, unit: 'rolls', truck: 'TR-044', gate: 'Gate 01', etaLabel: 'Tomorrow', destinationZone: 'Zone C', status: 'delayed' },
  { id: 'SHP-IN-04', supplierId: 'SUP-BETA', materialId: 'RM-1003', quantity: 4000, unit: 'kg', truck: 'TR-052', gate: 'Gate 02', etaLabel: '16:00', destinationZone: 'Zone A', status: 'on-time' },
  { id: 'SHP-IN-05', supplierId: 'SUP-BETA', materialId: 'CMP-2002', quantity: 4000, unit: 'units', truck: 'TR-058', gate: 'Gate 01', etaLabel: 'Today 18:45', destinationZone: 'Zone B', status: 'unloading' },
  { id: 'SHP-IN-06', supplierId: 'SUP-ALPHA', materialId: 'RM-1002', quantity: 5000, unit: 'kg', truck: 'TR-061', gate: 'Gate 02', etaLabel: 'Tomorrow 11:00', destinationZone: 'Zone A', status: 'on-time' },
  { id: 'SHP-IN-07', supplierId: 'SUP-GAMMA', materialId: 'PKG-3002', quantity: 6000, unit: 'units', truck: 'TR-067', gate: 'Gate 01', etaLabel: 'Tomorrow 13:30', destinationZone: 'Zone C', status: 'on-time' },
  { id: 'SHP-IN-08', supplierId: 'SUP-DELTA', materialId: 'CON-4002', quantity: 1200, unit: 'units', truck: 'TR-071', gate: 'Gate 02', etaLabel: 'In 2 days', destinationZone: 'Zone D', status: 'on-time' },
  { id: 'SHP-IN-09', supplierId: 'SUP-GAMMA', materialId: 'CON-4003', quantity: 1200, unit: 'L', truck: 'TR-073', gate: 'Gate 01', etaLabel: 'Delayed — new ETA pending', destinationZone: 'Zone D', status: 'delayed' },
]

export const SEED_OUTBOUND_SHIPMENTS: OutboundShipment[] = [
  { id: 'SHP-OUT-01', dispatchNumber: 'DSP-2026-0041', destination: 'Distribution Centre North', product: 'Finished Assemblies', quantity: 1200, unit: 'units', truck: 'TRK-031', etaLabel: 'Today 17:00', status: 'on-time', vehicleId: 'TRK-031' },
  { id: 'SHP-OUT-02', dispatchNumber: 'DSP-2026-0042', destination: 'Main Gate', product: 'Finished Assemblies', quantity: 800, unit: 'units', truck: 'TRK-047', etaLabel: 'Today 15:20', status: 'on-time', vehicleId: 'TRK-047' },
  { id: 'SHP-OUT-03', dispatchNumber: 'DSP-2026-0043', destination: 'Export Terminal', product: 'Packaged Goods', quantity: 2400, unit: 'units', truck: 'TR-082', etaLabel: 'Tomorrow', status: 'delayed' },
  { id: 'SHP-OUT-04', dispatchNumber: 'DSP-2026-0044', destination: 'Regional Distribution Hub', product: 'Finished Assemblies', quantity: 640, unit: 'units', truck: 'TR-088', etaLabel: 'Arrived', status: 'arrived' },
]

const ACCESS_NAMES = ['R. Adeyemi', 'T. Nakamura', 'M. Lindqvist', 'S. Okoye', 'J. Petrov', 'A. Silva', 'Contractor 118', 'Contractor 204', 'Visitor 12']
export const ACCESS_DOORS = [
  { door: 'Main Gate Entry', zone: 'Main Gate' },
  { door: 'Production Floor Entry', zone: 'Production Floor' },
  { door: 'Warehouse Roller Door', zone: 'Warehouse' },
  { door: 'Loading Bay Door', zone: 'Loading Bay' },
  { door: 'Restricted Area Door', zone: 'Restricted Area' },
  { door: 'Utility Plant Room', zone: 'Utility Area' },
]

export function randomAccessPerson(rng: () => number) {
  return ACCESS_NAMES[Math.floor(rng() * ACCESS_NAMES.length)]
}
export function randomAccessDoor(rng: () => number) {
  return ACCESS_DOORS[Math.floor(rng() * ACCESS_DOORS.length)]
}

const VISITOR_HOSTS = ['Operations', 'Quality', 'Procurement', 'Executive Team', 'Maintenance', 'Safety & Compliance']
export function randomVisitorHost(rng: () => number) {
  return VISITOR_HOSTS[Math.floor(rng() * VISITOR_HOSTS.length)]
}
