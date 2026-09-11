import { Icon, KpiTile } from '../components/ui'
import { ModuleLink } from '../components/ModuleLink'
import type { SimulationState } from '../simulation/types'
import { buildSecurityDetailLists } from '../lib/securityDetails'
import { UTILITY_INFO, type UtilityKey } from '../lib/utilityInfo'
import { KPI_THRESHOLDS, thresholdZone } from '../lib/kpiThresholds'
import { buildingAiInsight, buildingQuickStat, type ZoneStatus } from './zoneIntel'

const ZONE_COLOR: Record<ZoneStatus, string> = {
  normal: 'var(--app-success)',
  warning: 'var(--app-warning)',
  critical: 'var(--app-danger)',
}
const ZONE_LABEL: Record<ZoneStatus, string> = { normal: 'NORMAL', warning: 'WARNING', critical: 'CRITICAL' }

export function ZonePill({ zone }: { zone: ZoneStatus }) {
  return (
    <span className="status-chip" style={{ color: ZONE_COLOR[zone], borderColor: ZONE_COLOR[zone], background: 'transparent' }}>
      ● {ZONE_LABEL[zone]}
    </span>
  )
}

/** A small, always-present AI insight box — the one place every category explains itself in its own words. */
function AiInsight({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: 'var(--app-advisory-panel)', color: '#fef9ef' }}>
      <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      <p className="text-[11.5px] leading-relaxed">{text}</p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
      {children}
    </p>
  )
}

/* --------------------------------------------------------- Security Area -- */

export function SecurityAreaBody({ state }: { state: SimulationState }) {
  const { security, safetySecurity } = state
  const detail = buildSecurityDetailLists(security)
  const onlineCameras = security.cameras.filter((c) => c.status === 'online').length

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Active Cameras" value={onlineCameras} unit={`/ ${security.cameras.length}`} description="CCTV cameras currently online across the site." />
        <KpiTile label="Access Points" value={`${security.doorsOpen} / ${security.doorsTotal}`} sub="open" description="Doors currently open versus total monitored doors." />
        <KpiTile label="Active Personnel" value={security.employeesInside} description="Badged-in personnel currently on site." />
        <KpiTile label="Open Incidents" value={safetySecurity.activeSafetyIncidents} tone={safetySecurity.activeSafetyIncidents > 0 ? 'crit' : 'ok'} description="Active safety incidents currently open on site." />
      </div>
      <KpiTile label="Today's Access Events" value={security.accessEvents.length} sub="rolling log" description="Access events recorded in the current rolling window." />

      <div>
        <SectionLabel>📷 Camera Status</SectionLabel>
        <div className="flex flex-col gap-1">
          {security.cameras.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)' }}>
              <span className="font-medium" style={{ color: 'var(--app-text)' }}>
                {c.id}
              </span>
              <span style={{ color: c.status === 'online' ? 'var(--app-success)' : 'var(--app-text-faint)' }}>● {c.status}</span>
              <span style={{ color: 'var(--app-text-faint)' }}>{c.location}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>🕒 Security Events</SectionLabel>
        <div className="flex flex-col gap-1">
          {security.accessEvents.slice(0, 4).map((e) => (
            <div key={e.id} className="flex items-baseline gap-2 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
              <span className="tnum" style={{ color: 'var(--app-text-faint)' }}>
                {e.at}
              </span>
              <span>
                {e.person} — {e.decision} at {e.door}
              </span>
            </div>
          ))}
          {security.accessEvents.length === 0 && (
            <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
              No access events recorded yet this session.
            </p>
          )}
        </div>
      </div>

      {(safetySecurity.accessViolations > 0 || detail.restrictedAccessEvents.rows.length > 0) && (
        <div className="border-l-2 px-2.5 py-2" style={{ borderColor: 'var(--app-danger)', background: 'var(--app-danger-bg)' }}>
          <p className="label" style={{ color: 'var(--app-danger)' }}>
            {safetySecurity.accessViolations} Active Alert{safetySecurity.accessViolations === 1 ? '' : 's'}
          </p>
          <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--app-text)' }}>
            {safetySecurity.accessViolations > 0 ? 'Unauthorized access attempt confirmed this session.' : 'Denied access attempt(s) logged — review recommended.'}
          </p>
        </div>
      )}

      <AiInsight text={buildingAiInsight('BLD-SEC', state)} />

      <div className="flex gap-2">
        <ModuleLink to="/app/security" label="VIEW SECURITY" />
        <ModuleLink to="/app/safety" label="VIEW INCIDENTS" />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Main Gate -- */

export function MainGateBody({ state }: { state: SimulationState }) {
  const trucks = state.vehicles.filter((v) => v.kind === 'truck')
  const inboundCount = state.materials.inboundShipments.length
  const delayedInbound = state.materials.inboundShipments.filter((s) => s.status === 'delayed')

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Vehicles Today" value={trucks.length} description="Trucks currently tracked moving through the site." />
        <KpiTile label="Inbound Shipments" value={inboundCount} tone={delayedInbound.length > 0 ? 'warn' : 'ok'} description="Shipments scheduled to arrive through this gate." />
        <KpiTile label="Visitors" value={state.security.visitors} description="Registered visitors currently on site." />
        <KpiTile label="Access Events" value={state.security.accessEvents.length} sub="rolling log" description="Badge scans and access events logged at all doors." />
      </div>

      <div>
        <SectionLabel>🚚 Vehicle Activity</SectionLabel>
        <div className="flex flex-col gap-1">
          {trucks.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)' }}>
              <span className="tnum font-medium" style={{ color: 'var(--app-accent)' }}>
                {v.id}
              </span>
              <span style={{ color: v.status === 'in-transit' ? 'var(--app-info)' : 'var(--app-text-muted)' }}>● {v.status}</span>
              <span className="truncate" style={{ color: 'var(--app-text-faint)' }}>
                {v.load}
              </span>
            </div>
          ))}
          {trucks.length === 0 && (
            <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
              No vehicles currently tracked at the gate.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
        <span>Last security event: {state.security.accessEvents[0]?.at ?? '—'}</span>
        <span>Doors monitored: {state.security.doorsOpen} / {state.security.doorsTotal} open</span>
      </div>

      <AiInsight text={buildingAiInsight('BLD-GATE', state)} />

      <div className="flex gap-2">
        <ModuleLink to="/app/materials" label="VIEW VEHICLES" />
        <ModuleLink to="/app/security" label="VIEW CCTV" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------- Loading/Dispatch -- */

export function LoadingDispatchBody({ state }: { state: SimulationState }) {
  const { outboundShipments, outboundToday } = state.materials
  const dispatchTrucks = state.vehicles.filter((v) => v.kind === 'truck' && (v.origin.toLowerCase().includes('dispatch') || v.origin.toLowerCase().includes('loading')))
  const totalUnitsShipped = outboundShipments.reduce((a, s) => a + s.quantity, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Trucks" value={dispatchTrucks.length} description="Vehicles currently active at the loading/dispatch yard." />
        <KpiTile label="Pending Dispatch" value={outboundShipments.filter((s) => s.status !== 'arrived').length} description="Outbound shipments not yet confirmed arrived." />
        <KpiTile label="Today's Dispatch" value={outboundToday} description="Shipments dispatched today." />
        <KpiTile label="Units Shipped" value={totalUnitsShipped.toLocaleString()} description="Total units across all tracked outbound shipments." />
      </div>

      <div>
        <SectionLabel>🚛 Active Trucks</SectionLabel>
        <div className="flex flex-col gap-1">
          {dispatchTrucks.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)' }}>
              <span className="tnum font-medium" style={{ color: 'var(--app-accent)' }}>
                {v.id}
              </span>
              <span className="truncate" style={{ color: 'var(--app-text-muted)' }}>
                {v.load}
              </span>
              <span style={{ color: 'var(--app-info)' }}>● {v.status}</span>
            </div>
          ))}
          {dispatchTrucks.length === 0 && (
            <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
              No trucks currently active at this yard.
            </p>
          )}
        </div>
      </div>

      <div>
        <SectionLabel>📋 Dispatch Queue</SectionLabel>
        <div className="flex flex-col gap-1">
          {outboundShipments.slice(0, 5).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)' }}>
              <span className="truncate" style={{ color: 'var(--app-text)' }}>
                {s.destination}
              </span>
              <span className="tnum" style={{ color: 'var(--app-text-faint)' }}>
                {s.quantity.toLocaleString()} {s.unit}
              </span>
              <span style={{ color: s.status === 'delayed' ? 'var(--app-warning)' : 'var(--app-success)' }}>● {s.status}</span>
            </div>
          ))}
        </div>
      </div>

      <AiInsight text={buildingAiInsight('BLD-LOAD', state)} />

      <div className="flex gap-2">
        <ModuleLink to="/app/materials" label="VIEW LOGISTICS" />
        <ModuleLink to="/app/materials" label="VIEW DISPATCH" />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Administration -- */

export function AdministrationBody({ state }: { state: SimulationState }) {
  const adminZones = state.bmsZones.filter((z) => z.buildingId === 'BLD-ADMIN')
  const avgTemp = adminZones.length ? adminZones.reduce((a, z) => a + z.temperatureC, 0) / adminZones.length : state.bms.avgTemperatureC
  const avgHumidity = adminZones.length ? adminZones.reduce((a, z) => a + z.humidityPct, 0) / adminZones.length : state.bms.humidityPct

  const services: { label: string; status: ZoneStatus; emoji: string }[] = [
    { label: 'HVAC', status: state.bms.hvacStatus === 'Normal' ? 'normal' : 'warning', emoji: '❄️' },
    { label: 'Electrical', status: 'normal', emoji: '🔌' },
    { label: 'Water', status: state.utilities.water.status === 'Normal' ? 'normal' : 'warning', emoji: '💧' },
    { label: 'Fire Safety', status: state.safetyExtra.fireDetectionStatus === 'Normal' ? 'normal' : 'critical', emoji: '🧯' },
    { label: 'Access Control', status: state.safetySecurity.accessViolations > 0 ? 'warning' : 'normal', emoji: '🔐' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="HVAC Status" value={state.bms.hvacStatus} tone={state.bms.hvacStatus === 'Normal' ? 'ok' : 'warn'} description="Overall HVAC status for the administration building." />
        <KpiTile label="Avg Temperature" value={avgTemp.toFixed(1)} unit="°C" description="Average temperature across monitored administration zones." threshold={KPI_THRESHOLDS.avgTemperature} />
        <KpiTile label="Humidity" value={avgHumidity.toFixed(0)} unit="% RH" description="Average relative humidity across monitored administration zones." threshold={KPI_THRESHOLDS.humidity} />
        <KpiTile label="Access Events" value={state.security.accessEvents.length} sub="rolling log" description="Badge scans and access events logged this session." />
      </div>

      <div>
        <SectionLabel>🏢 Facility Services</SectionLabel>
        <div className="grid grid-cols-1 gap-1">
          {services.map((s) => (
            <div key={s.label} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)' }}>
              <span style={{ color: 'var(--app-text)' }}>
                {s.emoji} {s.label}
              </span>
              <span style={{ color: ZONE_COLOR[s.status] }}>● {ZONE_LABEL[s.status]}</span>
            </div>
          ))}
        </div>
      </div>

      <AiInsight text={buildingAiInsight('BLD-ADMIN', state)} />

      <div className="flex gap-2">
        <ModuleLink to="/app/bms" label="VIEW BMS" />
        <ModuleLink to="/app/safety" label="VIEW COMPLIANCE" />
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Utility -- */

export function UtilityAreaBody({ state }: { state: SimulationState }) {
  const keys = Object.keys(UTILITY_INFO) as UtilityKey[]
  const generators = state.bmsAssets.filter((a) => a.buildingId === 'BLD-UTIL' && (a.type === 'generator' || a.type === 'panel'))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Power" value={state.energy.currentDemandMw.toFixed(2)} unit="MW" description="Instantaneous site power draw." threshold={KPI_THRESHOLDS.energyDemand} />
        <KpiTile label="HVAC Load" value={state.bms.buildingEnergyKw.toFixed(0)} unit="kW" description="Non-production energy draw across the site." threshold={KPI_THRESHOLDS.buildingEnergy} />
        {keys.map((k) => (
          <KpiTile key={k} icon={<Icon d={UTILITY_INFO[k].icon} />} label={UTILITY_INFO[k].label} value={state.utilities[k].pressureBar.toFixed(2)} unit="bar" description={UTILITY_INFO[k].description} threshold={UTILITY_INFO[k].threshold} />
        ))}
      </div>

      <div>
        <SectionLabel>⚙️ Utility Status</SectionLabel>
        <div className="grid grid-cols-1 gap-1">
          {keys.map((k) => {
            const zone = thresholdZone(state.utilities[k].pressureBar, UTILITY_INFO[k].threshold)
            return (
              <div key={k} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)' }}>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Icon d={UTILITY_INFO[k].icon} /> {UTILITY_INFO[k].label}
                </span>
                <span style={{ color: ZONE_COLOR[zone] }}>● {ZONE_LABEL[zone]}</span>
              </div>
            )
          })}
          {generators.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)' }}>
              <span style={{ color: 'var(--app-text)' }}>🔋 {g.name}</span>
              <span style={{ color: g.status === 'running' ? 'var(--app-info)' : 'var(--app-text-faint)' }}>● {g.status === 'idle' ? 'standby' : g.status}</span>
            </div>
          ))}
        </div>
      </div>

      <AiInsight text={buildingAiInsight('BLD-UTIL', state)} />

      <div className="flex gap-2">
        <ModuleLink to="/app/bms" label="VIEW BMS" />
        <ModuleLink to="/app/bms" label="VIEW ENERGY" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Maintenance -- */

export function MaintenanceAreaBody({ state }: { state: SimulationState }) {
  const equipment = Object.values(state.equipment)
  const critical = equipment.filter((e) => e.status === 'critical')
  const dueSoon = equipment.filter((e) => e.maintenanceDueInDays <= 7 && e.maintenanceDueInDays > 0)
  const overdue = equipment.filter((e) => e.maintenanceDueInDays <= 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Open Work Orders" value={critical.length + dueSoon.length} description="Equipment currently critical or due for maintenance within 7 days." />
        <KpiTile label="Due This Week" value={dueSoon.length} tone={dueSoon.length > 0 ? 'warn' : 'ok'} description="Equipment with maintenance due within 7 days." />
        <KpiTile label="Overdue" value={overdue.length} tone={overdue.length > 0 ? 'crit' : 'ok'} description="Equipment past its scheduled maintenance window." />
        <KpiTile label="Predictive Risk" value={critical.length} tone={critical.length > 0 ? 'crit' : 'ok'} description="Assets currently in a critical operating state." />
      </div>

      <AiInsight text={buildingAiInsight('BLD-MAINT', state)} />

      <div className="flex gap-2">
        <ModuleLink to="/app/maintenance" label="VIEW MAINTENANCE" />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Production Ops -- */

export function ProductionOperationsSummary({ state }: { state: SimulationState }) {
  const { kpis, lines } = state

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile label="Lines Active" value={kpis.linesRunning} unit={`/ ${kpis.linesTotal}`} description="Production lines currently running." />
        <KpiTile label="OEE" value={kpis.oeePct.toFixed(1)} unit="%" description="Overall Equipment Effectiveness across the site." threshold={KPI_THRESHOLDS.oee} />
        <KpiTile label="Availability" value={kpis.oeeAvailabilityPct.toFixed(1)} unit="%" description="Share of scheduled time lines were available to run." />
        <KpiTile label="Performance" value={kpis.oeePerformancePct.toFixed(1)} unit="%" description="Actual cycle rate versus ideal cycle rate." />
        <KpiTile label="Quality" value={kpis.oeeQualityPct.toFixed(1)} unit="%" description="Share of output meeting quality specification." threshold={KPI_THRESHOLDS.quality} />
        <KpiTile label="Downtime Today" value={kpis.downtimeMinutes.toFixed(0)} unit="min" description="Cumulative downtime across all lines this session." threshold={KPI_THRESHOLDS.downtime} />
      </div>

      <div>
        <SectionLabel>🏭 Production Lines</SectionLabel>
        <div className="flex flex-col gap-1">
          {lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)' }}>
              <span className="truncate" style={{ color: 'var(--app-text)' }}>
                {l.name}
              </span>
              <span style={{ color: l.status === 'running' ? 'var(--app-success)' : l.status === 'warning' || l.status === 'critical' ? 'var(--app-warning)' : 'var(--app-text-faint)' }}>● {l.status}</span>
              <span className="tnum" style={{ color: 'var(--app-text-faint)' }}>
                OEE {((l.availabilityPct / 100) * (l.performancePct / 100) * (l.qualityPct / 100) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <AiInsight text={buildingAiInsight('BLD-PROD', state)} />

      <div className="flex gap-2">
        <ModuleLink to="/app/operations" label="VIEW PRODUCTION" />
        <ModuleLink to="/app/quality" label="VIEW OEE" />
      </div>
    </div>
  )
}

/** Shared small header row used at the top of every category-specific building body. */
export function BuildingBodyHeader({ id, state }: { id: string; state: SimulationState }) {
  const stat = buildingQuickStat(id, state)
  return (
    <div className="flex items-center justify-between">
      <span className="label">Status</span>
      <ZonePill zone={stat.zone} />
    </div>
  )
}
