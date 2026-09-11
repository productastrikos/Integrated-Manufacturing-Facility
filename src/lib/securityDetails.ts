import type { AccessEvent, SecurityState } from '../simulation/types'
import { ACCESS_DOORS } from '../data/seedPhase3'
import type { KpiDetailList } from '../components/KpiDetailPanel'

/**
 * Most Security KPIs are counts over the same rolling access-event log —
 * classifying and filtering that one log is what keeps a tile and the
 * detail list it opens from disagreeing. Visitors is the exception: it's
 * backed by a real roster (`security.visitorsOnSite`) rather than the log,
 * since "on site right now" is a headcount, not a history of scans.
 */
type PersonKind = 'employee' | 'visitor' | 'contractor'

function personKind(person: string): PersonKind {
  if (person.startsWith('Visitor')) return 'visitor'
  if (person.startsWith('Contractor')) return 'contractor'
  return 'employee'
}

const EVENT_COLUMNS = ['Person', 'Door', 'Zone', 'Time', 'Decision']
const ROLLING_LOG_NOTE = 'Drawn from the most recent access events this session (a rolling 40-event log) — earlier badge-ins from this shift may not appear here.'

function rowsFromEvents(events: AccessEvent[]): (string | number)[][] {
  return events.map((e) => [e.person, e.door, e.zone, e.at, e.decision])
}

export function buildSecurityDetailLists(security: SecurityState) {
  const events = security.accessEvents
  const employeeEvents = events.filter((e) => personKind(e.person) === 'employee')
  const restrictedEvents = events.filter((e) => e.decision !== 'granted')
  const gateEvents = events.filter((e) => e.door.includes('Gate'))
  const violationEvents = events.filter((e) => e.decision === 'tailgate')

  const employeesInside: KpiDetailList = {
    title: 'Recent Employee Badge-Ins',
    columns: EVENT_COLUMNS,
    rows: rowsFromEvents(employeeEvents),
    emptyText: 'No employee badge-ins recorded yet this session.',
    note: `Current headcount (${security.employeesInside}) is tracked separately from this log; ${ROLLING_LOG_NOTE}`,
  }

  const visitors: KpiDetailList = {
    title: 'Visitors On Site',
    columns: ['Visitor', 'Host', 'Checked In', 'Door', 'Zone'],
    rows: security.visitorsOnSite.map((v) => [v.name, v.host, v.checkedInAt, v.door, v.zone]),
    emptyText: 'No visitors are currently on site.',
    note: 'This is the full current roster, not a rolling log — it always matches the Visitors count exactly.',
  }

  const accessAttempts: KpiDetailList = {
    title: 'Access Attempts — Rolling Log',
    columns: EVENT_COLUMNS,
    rows: rowsFromEvents(events),
    emptyText: 'No access events recorded yet this session.',
    note: ROLLING_LOG_NOTE,
  }

  const restrictedAccessEvents: KpiDetailList = {
    title: 'Denied & Tailgate Events',
    columns: EVENT_COLUMNS,
    rows: rowsFromEvents(restrictedEvents),
    emptyText: 'No denied or tailgate events in the current window — every recent attempt was granted.',
    note: ROLLING_LOG_NOTE,
  }

  const doorStatus: KpiDetailList = {
    title: 'Monitored Doors',
    columns: ['Door', 'Zone', 'Status', 'Last Activity'],
    rows: ACCESS_DOORS.map((d, i) => {
      const lastEvent = events.find((e) => e.door === d.door)
      return [d.door, d.zone, i < security.doorsOpen ? 'Open' : 'Closed', lastEvent ? `${lastEvent.at} · ${lastEvent.person} (${lastEvent.decision})` : 'No activity this session']
    }),
    note: 'Open/closed reflects the current site-wide open-door count applied to the monitored door list, not a per-door sensor feed.',
  }

  const badgeEvents: KpiDetailList = {
    title: 'Badge Events — All Doors',
    columns: EVENT_COLUMNS,
    rows: rowsFromEvents(events),
    emptyText: 'No badge events recorded yet this session.',
    note: `Same underlying log as Access Attempts. ${ROLLING_LOG_NOTE}`,
  }

  const gateActivity: KpiDetailList = {
    title: 'Main Gate Activity',
    columns: EVENT_COLUMNS,
    rows: rowsFromEvents(gateEvents),
    emptyText: 'No gate activity recorded yet this session.',
    note: ROLLING_LOG_NOTE,
  }

  const accessViolations: KpiDetailList = {
    title: 'Confirmed Access Violations',
    columns: EVENT_COLUMNS,
    rows: rowsFromEvents(violationEvents),
    emptyText: 'No confirmed tailgate violations in the current window.',
    note: `A violation is a tailgate event — someone passing a door on another person's badge without their own scan. ${ROLLING_LOG_NOTE}`,
  }

  return { employeesInside, visitors, accessAttempts, restrictedAccessEvents, doorStatus, badgeEvents, gateActivity, accessViolations }
}
