/**
 * Generic manufacturing data model. Every identifier here is a universal
 * manufacturing concept (site, building, production line, equipment) —
 * nothing industry-specific. This is the contract the simulation engine
 * fills in and the UI (and, in Phase 2, the digital twin) reads from.
 */

export type EquipmentStatus = 'running' | 'idle' | 'warning' | 'critical' | 'offline' | 'maintenance'
export type LineStatus = 'running' | 'idle' | 'warning' | 'critical' | 'offline' | 'maintenance'

export type Equipment = {
  id: string
  name: string
  lineId: string
  type: 'machine' | 'process-unit' | 'equipment'
  status: EquipmentStatus
  health: number // 0-100
  temperatureC: number
  vibrationMmS: number
  powerKw: number
  speedRpm: number
  operatingHours: number
  maintenanceDueInDays: number
  loadPct: number
  targetLoadPct: number
  scripted?: 'drift-vibration' | 'drift-temperature' // marks demo assets with a persistent developing issue
}

export type ProductionLine = {
  id: string
  name: string
  areaId: string
  status: LineStatus
  equipmentIds: string[]
  outputUnits: number
  targetUnits: number
  availabilityPct: number
  performancePct: number
  qualityPct: number
  downtimeMinutes: number
  scriptedIdle?: boolean
  scriptedMaintenance?: boolean
}

export type ProductionArea = {
  id: string
  name: string
  buildingId: string
}

/* --------------------------------------------------- work allocation -- */

export type Department = 'Maintenance' | 'Production' | 'Quality' | 'Materials' | 'Safety' | 'Engineering' | 'Management'

/**
 * An employee's live standing — driven only by real assignment events (see
 * `tickAssignments` in simulationEngine.ts), never a random walk. Starts at
 * `available`, `on-break` or `offline` from the seed roster (a realistic
 * snapshot of who's on shift right now) and only changes because a real
 * issue was assigned to them or their work finished.
 */
export type EmployeeAvailability = 'available' | 'assigned' | 'en-route' | 'working' | 'busy' | 'on-break' | 'offline'

export type Employee = {
  id: string
  name: string
  role: string
  department: Department
  /** Lowercase skill tags an issue's required-skill string is matched against — e.g. 'mechanical', 'vibration-analysis', 'electrical'. */
  skills: string[]
  availability: EmployeeAvailability
  /** The issue currently assigned to this person, if any — the one place "who's working what" is recorded, so the employee list and the issue list can never disagree. */
  currentAssignmentId: string | null
  /** Where this person actually is right now — a line/area id while working, or a fixed home base (break room, workshop) when idle. */
  locationAreaId: string
  locationLabel: string
  /** Completed-and-active task count this shift — a real running tally, not a random number. */
  activeTaskCount: number
  onShift: boolean
}

export type AssignmentStatus = 'detected' | 'assigned' | 'en-route' | 'on-site' | 'in-progress' | 'verification' | 'resolved' | 'closed'

export type AssignmentEvent = { status: AssignmentStatus; at: string }

/**
 * One issue's response record — created the moment a supervisor assigns an
 * `AttentionEntry` to an employee, and the single source of truth both the
 * issue's displayed status and the employee's `currentAssignmentId` read
 * from. Time-based fields (`etaMinutes`, `workMinutes`) are the same real
 * numbers the recommendation engine computed when the assignment was made,
 * so the auto-progression through en-route → on-site → in-progress plays
 * out at the pace that was actually promised.
 */
export type Assignment = {
  id: string
  /** The `AttentionEntry.id` this responds to. */
  issueId: string
  employeeId: string
  status: AssignmentStatus
  assignedAt: string
  /** Real clock ms this assignment entered its current status — drives auto-progression without needing a raw tick counter. */
  statusSinceMs: number
  etaMinutes: number
  workMinutes: number
  distanceM: number
  history: AssignmentEvent[]
  escalated?: { toDepartment: Department; at: string }
}

export type Building = {
  id: string
  name: string
  siteId: string
  /** Presentation hint for the digital twin — doesn't affect simulation. */
  kind: 'gate' | 'building' | 'area'
}

export type Site = {
  id: string
  name: string
}

export type EnergyState = {
  currentDemandMw: number
  consumptionMwh: number
  intensityMwhPerKUnit: number
  efficiencyPct: number
}

export type BmsState = {
  hvacStatus: 'Normal' | 'Attention'
  buildingEnergyKw: number
  avgTemperatureC: number
  humidityPct: number
  airQualityIndex: number
  utilityStatus: 'Normal' | 'Attention'
}

export type SafetySecurityState = {
  activeSafetyIncidents: number
  nearMisses: number
  securityEvents: number
  accessViolations: number
  criticalAlerts: number
}

export type SiteKpis = {
  outputUnits: number
  targetUnits: number
  achievementPct: number
  efficiencyPct: number
  oeePct: number
  oeeAvailabilityPct: number
  oeePerformancePct: number
  oeeQualityPct: number
  equipmentAvailabilityPct: number
  linesRunning: number
  linesIdle: number
  linesMaintenance: number
  linesOffline: number
  linesTotal: number
  equipmentTotal: number
  equipmentRunning: number
  equipmentIdle: number
  equipmentMaintenance: number
  equipmentWarning: number
  equipmentFaultOffline: number
  equipmentHealthScore: number
  systemHealthPct: number
  downtimeMinutes: number
}

export type HistoryPoint = {
  t: number
  productionRatePerMin: number
  oeePct: number
  energyDemandMw: number
  equipmentHealthScore: number
  downtimeMinutes: number
  criticalAlerts: number
}

/**
 * One real, accumulating slice of the current production shift's clock —
 * built incrementally tick by tick as the engine runs, not reconstructed
 * or estimated. `outputStart`/`downtimeStart` are the site's cumulative
 * totals at the moment this bucket opened, so a consumer can read "units
 * produced this bucket" as `outputEnd - outputStart` without ever
 * touching the seeded session-start baseline those cumulative totals
 * carry. `oeeSum`/`oeeSamples` is a running mean of every tick's OEE
 * while this bucket was open. Buckets are `SHIFT_BUCKET_MINUTES` wide
 * (see simulationEngine.ts) — narrower than a full shift-hour so a chart
 * has more than one real point to draw within a normal session, while
 * still being tied to real shift-clock time rather than an arbitrary
 * rolling window of ticks.
 */
/**
 * One real, accumulating 10-minute slice of a rolling 24-hour equipment
 * health window — built tick by tick the same way `ShiftHourBucket` is,
 * just not shift-scoped (equipment health doesn't reset at a shift
 * boundary). `sum`/`samples` is a running mean of every tick's
 * `kpis.equipmentHealthScore` while this bucket was open.
 */
export type HealthLogBucket = {
  bucketIndex: number
  label: string // clock time this bucket opened, e.g. "14:30"
  sum: number
  samples: number
}

export type ShiftHourBucket = {
  shiftId: string
  bucketIndex: number
  label: string // shift-clock time this bucket opened, e.g. "16:05"
  outputStart: number
  outputEnd: number
  downtimeStart: number
  downtimeEnd: number
  oeeSum: number
  oeeSamples: number
}

export type AttentionItem = {
  equipmentId: string
  equipmentName: string
  lineId: string
  status: EquipmentStatus
  reason: string
  metric: string
}

/* ------------------------------------------------------- Phase 3 slices -- */

export type UtilityReading = { flow: number; flowUnit: string; pressureBar: number; status: 'Normal' | 'Attention' }
export type UtilitiesState = {
  water: UtilityReading
  gas: UtilityReading
  compressedAir: UtilityReading
  steam: UtilityReading
}

export type BmsZone = {
  id: string
  name: string
  buildingId: string
  floor: string
  temperatureC: number
  humidityPct: number
  co2Ppm: number
  airQualityIndex: number
  coolingLoadPct: number
  status: 'Normal' | 'Attention'
}

export type Camera = {
  id: string
  name: string
  location: string
  buildingId: string
  status: 'online' | 'offline'
  lastEventAt: string | null
}

export type AccessEvent = {
  id: string
  at: string
  person: string
  door: string
  zone: string
  decision: 'granted' | 'denied' | 'tailgate'
}

export type VisitorRecord = {
  id: string
  name: string
  checkedInAt: string
  door: string
  zone: string
  host: string
}

export type SecurityState = {
  cameras: Camera[]
  accessEvents: AccessEvent[]
  employeesInside: number
  /** Always visitorsOnSite.length — a real roster, not an independent counter, so this can never disagree with the Visitors detail list. */
  visitors: number
  visitorsOnSite: VisitorRecord[]
  doorsOpen: number
  doorsTotal: number
  gateActivityCount: number
}

export type SafetyExtra = {
  fireDetectionStatus: 'Normal' | 'Attention'
  ppeCompliancePct: number
  inspectionStatus: 'Up to date' | 'Due' | 'Overdue'
  complianceScorePct: number
  emergencyEventsActive: number
}

export type MaterialCategory = 'Raw Material' | 'Component' | 'Packaging' | 'Consumable'

export type Material = {
  id: string
  /** Short catalog code shown in tables and purchase orders, e.g. "RM-1042". */
  materialCode: string
  name: string
  category: MaterialCategory
  unit: string
  stockLevel: number
  capacity: number
  reorderLevel: number
  /** Below this, stock is treated as effectively unrecoverable without expediting — see materialsIntelligence. */
  minimumStock: number
  warehouseZone: string
  unitValue: number
  /** Steady-state consumption used to project stock cover and stockout date — independent of the live production tie-in. */
  dailyConsumption: number
  supplierId: string
  leadTimeDays: number
  /** Quantity already on order/in transit, not yet in stockLevel. */
  incomingQuantity: number
  /** ISO timestamp of the next incoming delivery, or null if nothing is inbound. */
  incomingETA: string | null
  /** Production lines this material feeds — drives the "production impact" read on a shortage. */
  productionLines: string[]
}

export type Supplier = {
  id: string
  name: string
  onTimePct: number
  avgLeadTimeDays: number
  activeOrders: number
  delayedOrders: number
  reliability: 'Excellent' | 'Good' | 'At Risk'
}

export type PurchaseOrderStatus = 'draft' | 'pending-approval' | 'ordered' | 'partially-received' | 'received' | 'delayed'
export type PurchaseOrderPriority = 'standard' | 'high' | 'urgent'

export type PurchaseOrder = {
  id: string
  poNumber: string
  materialId: string
  supplierId: string
  quantity: number
  unit: string
  orderedAt: string
  expectedDelivery: string
  status: PurchaseOrderStatus
  priority: PurchaseOrderPriority
  reason: string
}

export type ShipmentStatus = 'on-time' | 'delayed' | 'arrived' | 'unloading'

export type InboundShipment = {
  id: string
  supplierId: string
  materialId: string
  quantity: number
  unit: string
  truck: string
  gate: string
  etaLabel: string
  destinationZone: string
  status: ShipmentStatus
  /** Links to a live 3D truck when one exists for this shipment. */
  vehicleId?: string
}

export type OutboundShipment = {
  id: string
  dispatchNumber: string
  destination: string
  product: string
  quantity: number
  unit: string
  truck: string
  etaLabel: string
  status: ShipmentStatus
  vehicleId?: string
}

export type MaterialsState = {
  materials: Material[]
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  inboundShipments: InboundShipment[]
  outboundShipments: OutboundShipment[]
  inboundToday: number
  outboundToday: number
  openDeliveries: number
}

export type SimulationState = {
  lastUpdated: string // HH:MM:SS
  tick: number
  site: Site
  buildings: Building[]
  areas: ProductionArea[]
  lines: ProductionLine[]
  equipment: Record<string, Equipment>
  kpis: SiteKpis
  energy: EnergyState
  bms: BmsState
  safetySecurity: SafetySecurityState
  attention: AttentionItem[]
  history: HistoryPoint[]
  shiftHourly: ShiftHourBucket[]
  healthLog: HealthLogBucket[]
  utilities: UtilitiesState
  bmsZones: BmsZone[]
  security: SecurityState
  safetyExtra: SafetyExtra
  materials: MaterialsState
  floors: Floor[]
  rooms: Room[]
  bmsAssets: BmsAsset[]
  safetyAssets: SafetyAsset[]
  vehicles: Vehicle[]
  valueChain: ValueChainStage[]
  personnel: Record<string, Employee>
  assignments: Record<string, Assignment>
}

/** Alert thresholds — the single source of truth the alert engine (Phase 4) will read. */
export const THRESHOLDS = {
  temperatureC: { warning: 80, critical: 90 },
  vibrationMmS: { warning: 3, critical: 5 },
} as const

/* ------------------------------------------- Phase 2R: spatial hierarchy -- */

/**
 * A building level. Floors sit between Building and Zone/ProductionArea in
 * the spatial hierarchy, so the twin can isolate one level at a time.
 */
export type Floor = {
  id: string
  name: string
  /** Short badge label for the floor selector — "G", "1", "2". */
  shortLabel: string
  buildingId: string
  /** 0 = ground; elevation is derived from this in the twin's layout. */
  level: number
  description: string
}

export type BmsAssetType = 'ahu' | 'chiller' | 'transformer' | 'generator' | 'compressor' | 'pump' | 'panel' | 'tank'

/**
 * A physical building-services asset. These are real, selectable objects in
 * the 3D scene as well as rows in the BMS module — the same record drives
 * both, so the twin and the module can never disagree.
 */
export type BmsAsset = {
  id: string
  name: string
  type: BmsAssetType
  buildingId: string
  floorId: string
  /** Optional link to the BmsZone this asset conditions. */
  zoneId?: string
  system: 'HVAC' | 'Electrical' | 'Utilities'
  status: 'running' | 'warning' | 'idle' | 'maintenance'
  /** Live values — meaning depends on type; unused fields stay 0. */
  loadPct: number
  temperatureC: number
  powerKw: number
  speedPct: number
}

export type SafetyAssetType = 'extinguisher' | 'exit' | 'muster' | 'firePanel' | 'eyewash' | 'firstAid'

export type SafetyAsset = {
  id: string
  name: string
  type: SafetyAssetType
  buildingId: string
  floorId: string
  status: 'ok' | 'due' | 'fault'
  lastInspected: string
}

/**
 * An enclosed space on a floor — control room, electrical room, workshop,
 * store and so on. Rooms sit between Floor and Zone in the hierarchy and
 * are what make a building interior read as finished rather than as bare
 * structure.
 */
export type RoomKind =
  | 'control'
  | 'electrical'
  | 'server'
  | 'maintenance'
  | 'quality'
  | 'security'
  | 'mechanical'
  | 'storage'
  | 'staff'
  | 'production'

export type Room = {
  id: string
  name: string
  kind: RoomKind
  buildingId: string
  floorId: string
  description: string
  /** Nominal occupancy used by the room info panel. */
  capacity: number
}

/** A moving logistics asset — truck, forklift or service vehicle. */
export type VehicleKind = 'truck' | 'forklift' | 'service'

export type Vehicle = {
  id: string
  kind: VehicleKind
  name: string
  status: 'loading' | 'unloading' | 'in-transit' | 'idle' | 'departing'
  load: string
  loadPct: number
  origin: string
  destination: string
  etaMinutes: number
  speedKph: number
  /** Progress along its route, 0..1 — drives position in the twin. */
  routeProgress: number
  /** Optional link to the material this vehicle is carrying, for Materials & Logistics cross-references. */
  materialId?: string
}

/**
 * End-to-end operational stages the facility runs, from buying materials
 * through to commissioning delivered product on a customer site. Each stage
 * has a physical home in the twin, so "where does procurement happen" has a
 * spatial answer as well as a set of numbers.
 */
export type ValueChainStageId = 'procurement' | 'manufacturing' | 'quality' | 'shipping' | 'installation' | 'construction'

export type ValueChainStage = {
  id: ValueChainStageId
  name: string
  description: string
  /** Where in the twin this stage physically happens. */
  locationLabel: string
  /** Twin target the "View in Digital Twin" action focuses. */
  focusKind: 'building' | 'room' | 'area' | 'floor' | 'stage'
  focusId: string
  status: 'on-track' | 'attention' | 'blocked'
  /** Open units of work in this stage — POs, orders, shipments, jobs. */
  openItems: number
  /** Items completed today. */
  completedToday: number
  /** Headline percentage for the stage — meaning differs per stage. */
  progressPct: number
  progressLabel: string
  /** Secondary metric shown alongside progress. */
  metricValue: string
  metricLabel: string
}
