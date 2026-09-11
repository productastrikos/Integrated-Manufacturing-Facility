import type { KpiDetailList } from '../components/KpiDetailPanel'
import type { Equipment, SafetyExtra, SafetySecurityState, SecurityState } from '../simulation/types'

export type SafetySeverity = 'ok' | 'warn' | 'crit'

/**
 * The one place "is the site under control right now" gets decided —
 * Safety & Compliance's banner and Executive Overview's Safety Status tile
 * both read this, so a critical incident can never show as normal in one
 * place and critical in the other.
 */
export function safetySeverity(safetySecurity: SafetySecurityState, safetyExtra: SafetyExtra): SafetySeverity {
  if (safetySecurity.activeSafetyIncidents > 0) return 'crit'
  if (safetySecurity.nearMisses > 0 || safetyExtra.emergencyEventsActive > 0) return 'warn'
  return 'ok'
}

export const SAFETY_SEVERITY_LABEL: Record<SafetySeverity, string> = {
  ok: 'Normal',
  warn: 'Attention',
  crit: 'Critical',
}

/**
 * `activeSafetyIncidents` and `nearMisses` are fixed counts in the
 * simulation (seeded once, never ticked) — so a matching fixed record for
 * each is always accurate, not a snapshot that can drift out of sync with
 * the number on the tile.
 */
const SAFETY_INCIDENTS = [
  {
    id: 'INC-2026-014',
    type: 'Slip/Trip Hazard',
    zone: 'Warehouse Floor',
    reportedBy: 'S. Okoye',
    reportedAt: '08:12',
    status: 'Open',
    description: 'Coolant spill near Aisle 3, cordoned off — cleanup crew dispatched, awaiting close-out.',
  },
]

const NEAR_MISSES = [
  {
    id: 'NM-2026-031',
    type: 'Forklift Near Miss',
    zone: 'Loading Bay',
    reportedBy: 'T. Nakamura',
    reportedAt: '10:47',
    description: 'Forklift reversed without a spotter near a pedestrian walkway. No contact, no injury — added to the toolbox talk.',
  },
]

export function buildSafetyIncidentsList(count: number): KpiDetailList {
  return {
    title: 'Active Safety Incidents',
    columns: ['Incident', 'Type', 'Zone', 'Reported By', 'Time', 'Status'],
    rows: count > 0 ? SAFETY_INCIDENTS.map((i) => [i.id, i.type, i.zone, i.reportedBy, i.reportedAt, i.status]) : [],
    emptyText: 'No active safety incidents on site.',
    note: SAFETY_INCIDENTS[0] ? SAFETY_INCIDENTS[0].description : undefined,
  }
}

export function buildNearMissesList(count: number): KpiDetailList {
  return {
    title: 'Logged Near Misses',
    columns: ['Record', 'Type', 'Zone', 'Reported By', 'Time'],
    rows: count > 0 ? NEAR_MISSES.map((n) => [n.id, n.type, n.zone, n.reportedBy, n.reportedAt]) : [],
    emptyText: 'No near misses logged this session.',
    note: NEAR_MISSES[0] ? NEAR_MISSES[0].description : undefined,
  }
}

/** Security Events and Access Violations, on the Executive Overview, draw from the same access-event log Security itself does. */
export function buildSecurityEventsList(security: SecurityState, cumulativeCount: number): KpiDetailList {
  return {
    title: 'Security Events — Rolling Log',
    columns: ['Person', 'Door', 'Zone', 'Time', 'Decision'],
    rows: security.accessEvents.map((e) => [e.person, e.door, e.zone, e.at, e.decision]),
    emptyText: 'No security events recorded yet this session.',
    note: `${cumulativeCount.toLocaleString()} badge scans and access events logged cumulatively this session; showing the most recent 40.`,
  }
}

export function buildEmergencyEventsList(count: number): KpiDetailList {
  return {
    title: 'Active Emergency Events',
    columns: ['Event', 'Type', 'Zone', 'Declared At', 'Status'],
    rows: [],
    emptyText: count > 0 ? `${count} emergency event${count > 1 ? 's are' : ' is'} active — no further detail is on record.` : 'No emergency has been declared this session.',
    note: 'Covers a declared fire, evacuation or other site-wide emergency response — distinct from an individual safety incident or near miss.',
  }
}

/** Real equipment in a critical fault state — the same count `safetySecurity.criticalAlerts` is derived from. */
export function buildCriticalAlertsList(equipment: Record<string, Equipment>): KpiDetailList {
  const critical = Object.values(equipment).filter((e) => e.status === 'critical')
  return {
    title: 'Equipment In Critical State',
    columns: ['Equipment', 'Line', 'Health', 'Temperature', 'Vibration'],
    rows: critical.map((e) => [e.name, e.lineId, `${e.health.toFixed(0)}/100`, `${e.temperatureC.toFixed(1)}°C`, `${e.vibrationMmS.toFixed(2)} mm/s`]),
    emptyText: 'No equipment is currently in a critical fault state.',
    note: 'Feeds directly into Facility Health and the security posture score — each critical unit needs its own corrective work order.',
  }
}

export function buildAccessViolationsList(security: SecurityState): KpiDetailList {
  const violations = security.accessEvents.filter((e) => e.decision === 'tailgate')
  return {
    title: 'Confirmed Access Violations',
    columns: ['Person', 'Door', 'Zone', 'Time', 'Decision'],
    rows: violations.map((e) => [e.person, e.door, e.zone, e.at, e.decision]),
    emptyText: 'No confirmed violations in the current rolling window.',
    note: 'A violation is a tailgate event — someone passing a door on another person\'s badge without their own scan.',
  }
}
