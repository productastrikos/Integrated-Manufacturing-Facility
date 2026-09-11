import { CameraFeedPlayer } from '../components/CameraFeedPlayer'
import { KpiTile, Panel, StateChip } from '../components/ui'
import type { SimulationState } from '../simulation/types'
import { BMS_ASSET_LAYOUTS, CAMERA_LAYOUTS, FLOOR_LAYOUTS, ROOM_LAYOUTS, SAFETY_ASSET_LAYOUTS, STAGE_ZONE_LAYOUTS } from './facilityLayout'
import type { SelectionKind } from './selection'

/**
 * Information panels for the spatial layer the twin gained alongside
 * production: building levels, building-services assets, CCTV and safety
 * infrastructure. Each reads the same shared simulation state as the rest
 * of the app, so a value shown here is the value the BMS, Security and
 * Safety modules are showing at the same instant.
 */

/* --------------------------------------------------- value-chain stage - */

/**
 * A value-chain stage that owns a physical plot on the campus — the
 * commissioning yard and the capital-works site. The numbers here are the
 * same ones the Operations module shows for that stage, read from the same
 * live state, so the yard and the dashboard can never disagree.
 */
export function StagePanel({ id, state }: { id: string; state: SimulationState }) {
  const stage = state.valueChain.find((s) => s.id === id)
  const zone = STAGE_ZONE_LAYOUTS.find((z) => z.stageId === id)
  if (!stage || !zone) return null

  const areaM2 = zone.size[0] * zone.size[1]
  const chip = stage.status === 'on-track' ? 'status-chip-success' : stage.status === 'attention' ? 'status-chip-warning' : 'status-chip-danger'
  const statusLabel = stage.status === 'on-track' ? 'On track' : stage.status === 'attention' ? 'Attention' : 'Blocked'

  return (
    <Panel label="Operational Stage" action={<span className="label">{zone.name}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="text-[15px] font-semibold">{stage.name}</div>
          <span className={`status-chip mt-1.5 ${chip}`}>{statusLabel}</span>
          <p className="mt-1.5 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
            {stage.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile
            label={stage.progressLabel}
            value={stage.progressPct.toFixed(0)}
            unit="%"
            tone={stage.status === 'attention' ? 'warn' : undefined}
            description={`Headline progress for the ${stage.name} stage.`}
          />
          <KpiTile label="Open" value={stage.openItems} description="Units of work currently open in this stage." />
          <KpiTile label="Done Today" value={stage.completedToday} description="Items completed in this stage today." />
          <KpiTile label="Plot Area" value={areaM2.toFixed(0)} unit="m²" description="Ground area of this stage's plot on the campus." />
        </div>

        <dl className="flex flex-col gap-2">
          <DetailRow label={stage.metricLabel} value={stage.metricValue} />
          <DetailRow label="Location" value={zone.name} />
        </dl>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ room - */

const ROOM_KIND_LABEL: Record<string, string> = {
  control: 'Control Room',
  electrical: 'Electrical Room',
  server: 'Server / IT Room',
  maintenance: 'Maintenance Room',
  quality: 'Quality Room',
  security: 'Security Room',
  mechanical: 'Mechanical Plant Room',
  storage: 'Storage Room',
  staff: 'Staff Facilities',
  production: 'Production Space',
}

export function RoomPanel({
  id,
  state,
  onSelect,
}: {
  id: string
  state: SimulationState
  onSelect: (k: SelectionKind, id: string) => void
}) {
  const room = state.rooms.find((r) => r.id === id)
  const layout = ROOM_LAYOUTS.find((r) => r.room.id === id)
  if (!room || !layout) return null

  const building = state.buildings.find((b) => b.id === room.buildingId)
  const floor = state.floors.find((f) => f.id === room.floorId)
  // Rooms don't each carry their own sensor; they inherit the conditioned
  // zone their part of the building sits in.
  const zone = state.bmsZones.find((z) => z.buildingId === room.buildingId)
  const bmsHere = state.bmsAssets.filter((a) => a.floorId === room.floorId && a.buildingId === room.buildingId)
  const floorArea = layout.size[0] * layout.size[1]

  return (
    <Panel label="Room" action={<span className="label">{room.id}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="text-[15px] font-semibold">{room.name}</div>
          <p className="mt-1 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
            {room.description}
          </p>
          <p className="mt-1.5 text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {building?.name}
            {floor ? ` · ${floor.name}` : ''}
          </p>
        </div>

        <dl className="flex flex-col gap-2">
          <DetailRow label="Type" value={ROOM_KIND_LABEL[room.kind] ?? room.kind} />
        </dl>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Floor Area" value={floorArea.toFixed(0)} unit="m²" description="Internal floor area of this room." />
          <KpiTile label="Capacity" value={room.capacity} description="Nominal number of people this room is planned for." />
          {zone && <KpiTile label="Temperature" value={zone.temperatureC.toFixed(1)} unit="°C" description="Conditioned air temperature for this part of the building." />}
          {zone && <KpiTile label="Humidity" value={zone.humidityPct.toFixed(0)} unit="%" description="Relative humidity for this part of the building." />}
        </div>

        {bmsHere.length > 0 && (
          <div className="border-t border-[var(--app-border)] pt-3">
            <p className="label mb-2">Services on this level</p>
            <ul className="flex flex-col gap-1.5">
              {bmsHere.map((a) => (
                <li key={a.id}>
                  <button
                    className="flex w-full items-center justify-between gap-2 rounded-sm border border-[var(--app-border)] px-2.5 py-1.5 text-left hover:border-[var(--app-accent-border)]"
                    onClick={() => onSelect('bms', a.id)}
                  >
                    <span className="truncate text-[12px]">{a.name}</span>
                    <StateChip status={a.status === 'warning' ? 'warning' : a.status === 'idle' ? 'idle' : 'running'} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {floor && (
          <button
            className="w-full rounded-sm border border-[var(--app-border)] px-2.5 py-1.5 text-[12px] hover:border-[var(--app-accent-border)]"
            onClick={() => onSelect('floor', floor.id)}
          >
            View {floor.name}
          </button>
        )}
      </div>
    </Panel>
  )
}

/* --------------------------------------------------------------- vehicle - */

const VEHICLE_STATUS_LABEL: Record<string, string> = {
  loading: 'Loading',
  unloading: 'Unloading',
  'in-transit': 'In transit',
  idle: 'Idle',
  departing: 'Departing',
}

export function VehiclePanel({ id, state }: { id: string; state: SimulationState }) {
  const vehicle = state.vehicles.find((v) => v.id === id)
  if (!vehicle) return null

  const busy = vehicle.status === 'loading' || vehicle.status === 'unloading' || vehicle.status === 'in-transit'

  return (
    <Panel label={vehicle.kind === 'truck' ? 'Vehicle' : 'Material Handling'} action={<span className="label">{vehicle.id}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="text-[15px] font-semibold">{vehicle.name}</div>
          <span className={`status-chip mt-1.5 ${busy ? 'status-chip-success' : 'status-chip-neutral'}`}>
            {VEHICLE_STATUS_LABEL[vehicle.status] ?? vehicle.status}
          </span>
        </div>

        <dl className="flex flex-col gap-2">
          <DetailRow label="Load" value={vehicle.load} />
          <DetailRow label="Origin" value={vehicle.origin} />
          <DetailRow label="Destination" value={vehicle.destination} />
        </dl>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Load Level" value={vehicle.loadPct.toFixed(0)} unit="%" description="How full this vehicle currently is." />
          <KpiTile
            label="ETA"
            value={vehicle.etaMinutes > 0 ? vehicle.etaMinutes.toFixed(0) : '—'}
            unit={vehicle.etaMinutes > 0 ? 'min' : undefined}
            description="Estimated time until this vehicle reaches its destination or finishes loading."
          />
          <KpiTile
            label="Speed"
            value={vehicle.speedKph > 0 ? vehicle.speedKph.toFixed(0) : '0'}
            unit="km/h"
            description="Current speed on the internal site roads."
          />
          <KpiTile label="Type" value={vehicle.kind === 'truck' ? 'Truck' : 'Forklift'} description="Vehicle category." />
        </div>

        <div className="border-t border-[var(--app-border)] pt-3">
          <p className="label mb-2">Site logistics</p>
          <div className="grid grid-cols-2 gap-2">
            <KpiTile label="Inbound Today" value={state.materials.inboundToday} description="Deliveries received at the site today." />
            <KpiTile label="Outbound Today" value={state.materials.outboundToday} description="Shipments dispatched from the site today." />
          </div>
        </div>
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------------------- floor - */

export function FloorPanel({
  id,
  state,
  onSelect,
}: {
  id: string
  state: SimulationState
  onSelect: (k: SelectionKind, id: string) => void
}) {
  const floor = state.floors.find((f) => f.id === id)
  const layout = FLOOR_LAYOUTS.find((f) => f.floor.id === id)
  if (!floor || !layout) return null

  const isGround = floor.level === 0
  const areasOnFloor = isGround ? state.areas.filter((a) => a.buildingId === floor.buildingId) : []
  const bmsOnFloor = state.bmsAssets.filter((a) => a.floorId === id)
  const safetyOnFloor = state.safetyAssets.filter((a) => a.floorId === id)

  const linesOnFloor = isGround ? state.lines.filter((l) => areasOnFloor.some((a) => a.id === l.areaId)) : []
  const equipmentOnFloor = linesOnFloor.flatMap((l) => l.equipmentIds.map((eid) => state.equipment[eid])).filter(Boolean)

  return (
    <Panel label="Floor" action={<span className="label">{id}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="text-[15px] font-semibold">{floor.name}</div>
          <p className="mt-1 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
            {floor.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Level" value={floor.shortLabel} description="Building level identifier used throughout the twin." />
          <KpiTile label="Elevation" value={layout.elevation.toFixed(0)} unit="m" description="Height of this floor slab above the ground floor." />
          <KpiTile
            label={isGround ? 'Production Areas' : 'Services Assets'}
            value={isGround ? areasOnFloor.length : bmsOnFloor.length}
            description={isGround ? 'Production areas located on this level.' : 'Building-services assets installed on this level.'}
          />
          <KpiTile
            label={isGround ? 'Equipment' : 'Safety Assets'}
            value={isGround ? equipmentOnFloor.length : safetyOnFloor.length}
            description={isGround ? 'Equipment units on this level.' : 'Safety infrastructure items on this level.'}
          />
        </div>

        {areasOnFloor.length > 0 && (
          <SelectList label="Production areas" items={areasOnFloor.map((a) => ({ id: a.id, label: a.name }))} kind="area" onSelect={onSelect} />
        )}

        {bmsOnFloor.length > 0 && (
          <div className="border-t border-[var(--app-border)] pt-3">
            <p className="label mb-2">Building services on this level</p>
            <ul className="flex flex-col gap-1.5">
              {bmsOnFloor.map((a) => (
                <li key={a.id}>
                  <button
                    className="flex w-full items-center justify-between gap-2 rounded-sm border border-[var(--app-border)] px-2.5 py-1.5 text-left hover:border-[var(--app-accent-border)]"
                    onClick={() => onSelect('bms', a.id)}
                  >
                    <span className="truncate text-[12px]">{a.name}</span>
                    <StateChip status={a.status === 'warning' ? 'warning' : a.status === 'idle' ? 'idle' : 'running'} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------- BMS asset - */

export function BmsAssetPanel({ id, state }: { id: string; state: SimulationState }) {
  const asset = state.bmsAssets.find((a) => a.id === id)
  const layout = BMS_ASSET_LAYOUTS.find((a) => a.asset.id === id)
  if (!asset || !layout) return null

  const building = state.buildings.find((b) => b.id === asset.buildingId)
  const floor = state.floors.find((f) => f.id === asset.floorId)
  const zone = asset.zoneId ? state.bmsZones.find((z) => z.id === asset.zoneId) : null

  return (
    <Panel label={asset.system} action={<span className="label">{asset.id}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="text-[15px] font-semibold">{asset.name}</div>
          <div className="mt-1.5">
            <StateChip status={asset.status === 'warning' ? 'warning' : asset.status === 'idle' ? 'idle' : asset.status === 'maintenance' ? 'maintenance' : 'running'} />
          </div>
          <p className="mt-1.5 text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {building?.name}
            {floor ? ` · ${floor.name}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Load" value={asset.loadPct.toFixed(0)} unit="%" tone={asset.loadPct > 88 ? 'warn' : undefined} description="Current operating load for this asset." />
          <KpiTile label="Temperature" value={asset.temperatureC.toFixed(1)} unit="°C" description="Measured operating temperature." />
          {asset.powerKw > 0 && <KpiTile label="Power" value={asset.powerKw.toFixed(0)} unit="kW" description="Electrical power drawn by this asset." />}
          {asset.speedPct > 0 && <KpiTile label="Speed" value={asset.speedPct.toFixed(0)} unit="%" description="Fan or drive speed as a percentage of maximum." />}
        </div>

        {zone && (
          <div className="border-t border-[var(--app-border)] pt-3">
            <p className="label mb-2">Zone served — {zone.name}</p>
            <div className="grid grid-cols-2 gap-2">
              <KpiTile label="Zone Temp" value={zone.temperatureC.toFixed(1)} unit="°C" description="Air temperature in the zone this asset conditions." />
              <KpiTile label="Humidity" value={zone.humidityPct.toFixed(0)} unit="%" description="Relative humidity in the served zone." />
              <KpiTile label="CO₂" value={zone.co2Ppm.toFixed(0)} unit="ppm" description="Carbon dioxide concentration in the served zone." />
              <KpiTile label="Cooling Load" value={zone.coolingLoadPct.toFixed(0)} unit="%" description="Share of available cooling capacity currently in use." />
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

/* ---------------------------------------------------------------- camera - */

export function CameraPanel({ id, state }: { id: string; state: SimulationState }) {
  const camera = state.security.cameras.find((c) => c.id === id)
  const layout = CAMERA_LAYOUTS.find((c) => c.camera.id === id)
  if (!camera || !layout) return null

  const building = state.buildings.find((b) => b.id === camera.buildingId)

  return (
    <Panel label="Camera" action={<span className="label">{camera.id}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="text-[15px] font-semibold">{camera.name}</div>
          <div className="mt-1.5">
            <StateChip status={camera.status === 'online' ? 'running' : 'offline'} />
          </div>
        </div>

        <dl className="flex flex-col gap-2">
          <DetailRow label="Location" value={camera.location} />
          <DetailRow label="Coverage" value={building?.name ?? String.fromCharCode(8212)} />
          <DetailRow label="Last Event" value={camera.lastEventAt ?? "Normal"} />
        </dl>

        <CameraFeedPlayer cameraId={camera.id} online={camera.status === 'online'} location={camera.location} />
      </div>
    </Panel>
  )
}

/* ---------------------------------------------------------- safety asset - */

const SAFETY_TYPE_LABEL: Record<string, string> = {
  extinguisher: 'Fire Extinguisher',
  exit: 'Emergency Exit',
  muster: 'Muster Point',
  firePanel: 'Fire Detection Panel',
  eyewash: 'Eyewash Station',
  firstAid: 'First Aid Station',
}

export function SafetyAssetPanel({ id, state }: { id: string; state: SimulationState }) {
  const asset = state.safetyAssets.find((a) => a.id === id)
  const layout = SAFETY_ASSET_LAYOUTS.find((a) => a.asset.id === id)
  if (!asset || !layout) return null

  const building = state.buildings.find((b) => b.id === asset.buildingId)
  const floor = state.floors.find((f) => f.id === asset.floorId)

  return (
    <Panel label="Safety Asset" action={<span className="label">{asset.id}</span>}>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        <div>
          <div className="text-[15px] font-semibold">{asset.name}</div>
          <span className={`status-chip mt-1.5 ${asset.status === 'ok' ? 'status-chip-success' : asset.status === 'due' ? 'status-chip-warning' : 'status-chip-danger'}`}>
            {asset.status === 'ok' ? 'Inspection current' : asset.status === 'due' ? 'Inspection due' : 'Fault'}
          </span>
          <p className="mt-1.5 text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {building?.name}
            {floor ? ` · ${floor.name}` : ''}
          </p>
        </div>

        <dl className="flex flex-col gap-2">
          <DetailRow label="Type" value={SAFETY_TYPE_LABEL[asset.type] ?? asset.type} />
          <DetailRow label="Last Inspected" value={asset.lastInspected} />
        </dl>

        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Fire Detection" value={state.safetyExtra.fireDetectionStatus} description="Facility-wide fire detection system status." />
          <KpiTile label="PPE Compliance" value={state.safetyExtra.ppeCompliancePct.toFixed(0)} unit="%" description="Site-wide personal protective equipment compliance rate." />
        </div>
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------------------- shared - */

/** A label/value row for text values that would overflow a numeric KPI tile. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 rounded-sm border px-2.5 py-1.5"
      style={{ borderColor: "var(--app-border)" }}
    >
      <dt className="label shrink-0">{label}</dt>
      <dd className="text-right text-[12px]" style={{ color: "var(--app-text)" }}>
        {value}
      </dd>
    </div>
  )
}

function SelectList({
  label,
  items,
  kind,
  onSelect,
}: {
  label: string
  items: { id: string; label: string }[]
  kind: SelectionKind
  onSelect: (k: SelectionKind, id: string) => void
}) {
  return (
    <div className="border-t border-[var(--app-border)] pt-3">
      <p className="label mb-2">{label}</p>
      <ul className="flex flex-col gap-1">
        {items.map((i) => (
          <li key={i.id}>
            <button
              className="w-full rounded-sm border border-[var(--app-border)] px-2.5 py-1.5 text-left text-[12px] hover:border-[var(--app-accent-border)]"
              onClick={() => onSelect(kind, i.id)}
            >
              {i.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
