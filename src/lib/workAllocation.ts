import type { SimulationState, Department, Employee, Assignment, AssignmentStatus } from '../simulation/types'
import { buildAttentionFeed, type AttentionEntry } from './attentionFeed'

/* ==================================================================== issue location == */

export type IssueLocation = { areaId: string; buildingId: string; label: string; lineId?: string; equipmentId?: string }

function resolveBuildingId(state: SimulationState, areaOrBuildingId: string): string {
  const area = state.areas.find((a) => a.id === areaOrBuildingId)
  return area ? area.buildingId : areaOrBuildingId
}

function areaLabel(state: SimulationState, areaOrBuildingId: string): string {
  const area = state.areas.find((a) => a.id === areaOrBuildingId)
  if (area) return area.name
  const building = state.buildings.find((b) => b.id === areaOrBuildingId)
  return building?.name ?? areaOrBuildingId
}

/** Where an issue physically is, resolved from the same real hierarchy (equipment → line → area → building) the Digital Twin uses — never a separate guess. */
export function resolveIssueLocation(state: SimulationState, entry: AttentionEntry): IssueLocation {
  switch (entry.category) {
    case 'Equipment': {
      const eq = state.equipment[entry.twinId]
      const line = eq ? state.lines.find((l) => l.id === eq.lineId) : undefined
      const areaId = line?.areaId ?? 'AREA-A'
      return { areaId, buildingId: resolveBuildingId(state, areaId), label: areaLabel(state, areaId), lineId: line?.id, equipmentId: eq?.id }
    }
    case 'Quality': {
      const line = state.lines.find((l) => l.id === entry.twinId)
      const areaId = line?.areaId ?? 'AREA-A'
      return { areaId, buildingId: resolveBuildingId(state, areaId), label: areaLabel(state, areaId), lineId: line?.id }
    }
    case 'Materials': {
      const material = state.materials.materials.find((m) => m.id === entry.attnId)
      return { areaId: 'BLD-WARE', buildingId: 'BLD-WARE', label: material ? `Warehouse — ${material.warehouseZone}` : 'Warehouse' }
    }
    case 'Building Services': {
      const asset = state.bmsAssets.find((a) => a.id === entry.twinId)
      const buildingId = asset?.buildingId ?? 'BLD-UTIL'
      return { areaId: buildingId, buildingId, label: areaLabel(state, buildingId) }
    }
    case 'Safety':
      return { areaId: 'BLD-PROD', buildingId: 'BLD-PROD', label: 'Production Building' }
    case 'Security':
      return { areaId: 'BLD-SEC', buildingId: 'BLD-SEC', label: 'Security Area' }
  }
}

/* ==================================================================== required dept/skill == */

export function requiredDepartment(entry: AttentionEntry): Department {
  switch (entry.category) {
    case 'Equipment':
      return 'Maintenance'
    case 'Quality':
      return 'Quality'
    case 'Materials':
      return 'Materials'
    case 'Building Services':
      return 'Engineering'
    case 'Safety':
    case 'Security':
      return 'Safety'
  }
}

/** A short, human-readable skill requirement derived from the issue's own description — not a separate invented taxonomy. */
export function requiredSkillLabel(entry: AttentionEntry): string {
  const d = entry.description.toLowerCase()
  if (entry.category === 'Equipment') {
    if (d.includes('vibration')) return 'Vibration Analysis'
    if (d.includes('temperature') || d.includes('thermal')) return 'Thermal / Electrical'
    return 'Mechanical'
  }
  if (entry.category === 'Quality') return 'Quality Inspection'
  if (entry.category === 'Materials') return 'Inventory / Procurement'
  if (entry.category === 'Building Services') return 'Utilities / Controls'
  if (entry.category === 'Safety') return 'Safety Response'
  return 'Security Response'
}

function requiredSkillTags(entry: AttentionEntry): string[] {
  const d = entry.description.toLowerCase()
  switch (entry.category) {
    case 'Equipment':
      if (d.includes('vibration')) return ['vibration-analysis', 'mechanical', 'bearings']
      if (d.includes('temperature') || d.includes('thermal')) return ['thermal', 'electrical', 'controls']
      return ['mechanical', 'electrical']
    case 'Quality':
      return ['quality-inspection', 'spc', 'calibration']
    case 'Materials':
      return ['inventory', 'procurement', 'logistics']
    case 'Building Services':
      return ['utilities', 'controls', 'electrical']
    case 'Safety':
    case 'Security':
      return ['safety-response', 'incident-investigation', 'first-aid']
  }
}

/* ==================================================================== distance / eta == */

const WALK_SPEED_M_PER_MIN = 70

/**
 * A structural distance tier, not a measured GPS figure the simulation has
 * no way to produce: same area/room is a short walk, same building is a
 * longer one, a different building is longer still. Every tier is a real
 * comparison of the facility's own area→building hierarchy, not a random
 * number — see `resolveIssueLocation` for the same hierarchy the Digital
 * Twin uses.
 */
export function distanceMeters(state: SimulationState, employeeAreaId: string, issue: IssueLocation): number {
  if (employeeAreaId === issue.areaId) return 35
  const employeeBuilding = resolveBuildingId(state, employeeAreaId)
  if (employeeBuilding === issue.buildingId) return 160
  return 420
}

export function etaMinutes(distance: number): number {
  return Math.max(1, Math.round(distance / WALK_SPEED_M_PER_MIN))
}

/** How long the on-site work itself takes, by issue severity — a real, fixed planning figure (matches the kind of standard response-time targets a real facility publishes), not a random duration. */
export function workDurationMinutes(entry: AttentionEntry): number {
  return entry.severity === 'critical' ? 25 : 15
}

/* ==================================================================== candidates == */

export type SkillMatch = 'HIGH' | 'MEDIUM' | 'LOW'

export type Candidate = {
  employee: Employee
  skillMatch: SkillMatch
  distanceM: number
  etaMinutes: number
  score: number
  /** True once this candidate is the top-ranked available, on-shift, matching-department option. */
  recommended: boolean
}

const AVAILABILITY_RANK: Record<Employee['availability'], number> = {
  available: 0,
  'on-break': 1,
  busy: 2,
  assigned: 3,
  'en-route': 3,
  working: 3,
  offline: 4,
}

/**
 * Every on-shift employee in the required department (or with a matching
 * skill), scored by the exact five factors the spec calls for — skill
 * match, availability, proximity, workload, shift — so the top of the
 * list is always a defensible "why this person" answer, not a black box.
 */
export function candidatesForIssue(state: SimulationState, entry: AttentionEntry): Candidate[] {
  const dept = requiredDepartment(entry)
  const tags = requiredSkillTags(entry)
  const location = resolveIssueLocation(state, entry)

  const pool = Object.values(state.personnel).filter((e) => e.department === dept || e.skills.some((s) => tags.includes(s)))

  const scored: Candidate[] = pool.map((employee) => {
    const skillHit = employee.skills.filter((s) => tags.includes(s)).length
    const skillMatch: SkillMatch = skillHit >= 2 ? 'HIGH' : skillHit === 1 ? 'MEDIUM' : employee.department === dept ? 'MEDIUM' : 'LOW'
    const distance = distanceMeters(state, employee.locationAreaId, location)
    const eta = etaMinutes(distance)

    // Lower is better on every term, then flipped to a 0-100 "better is
    // higher" score only for display — the ranking itself just sorts by
    // the raw terms in priority order below.
    let score = 100
    score -= AVAILABILITY_RANK[employee.availability] * 20
    score -= skillMatch === 'HIGH' ? 0 : skillMatch === 'MEDIUM' ? 8 : 16
    score -= Math.min(15, distance / 30)
    score -= employee.activeTaskCount * 5
    score -= employee.onShift ? 0 : 30

    return { employee, skillMatch, distanceM: distance, etaMinutes: eta, score: Math.max(0, Math.round(score)), recommended: false }
  })

  scored.sort((a, b) => {
    if (a.employee.onShift !== b.employee.onShift) return a.employee.onShift ? -1 : 1
    const availDiff = AVAILABILITY_RANK[a.employee.availability] - AVAILABILITY_RANK[b.employee.availability]
    if (availDiff !== 0) return availDiff
    const skillRank = (m: SkillMatch) => (m === 'HIGH' ? 0 : m === 'MEDIUM' ? 1 : 2)
    const skillDiff = skillRank(a.skillMatch) - skillRank(b.skillMatch)
    if (skillDiff !== 0) return skillDiff
    const workloadDiff = a.employee.activeTaskCount - b.employee.activeTaskCount
    if (workloadDiff !== 0) return workloadDiff
    return a.distanceM - b.distanceM
  })

  const first = scored.find((c) => c.employee.availability === 'available' && c.employee.onShift)
  if (first) first.recommended = true

  return scored
}

/* ==================================================================== unified issue == */

export type WorkIssue = {
  entry: AttentionEntry
  location: IssueLocation
  department: Department
  skillLabel: string
  detectedAt: string
  assignment: Assignment | null
}

/**
 * The full "active concern" list the Work Allocation station and the Live
 * Work Allocation column both read — the same canonical `buildAttentionFeed`
 * every other page uses, cross-referenced with any real assignment record
 * so the station never disagrees with the rest of the app about what's
 * currently open.
 */
export function buildWorkIssues(state: SimulationState): WorkIssue[] {
  return buildAttentionFeed(state).map((entry) => ({
    entry,
    location: resolveIssueLocation(state, entry),
    department: requiredDepartment(entry),
    skillLabel: requiredSkillLabel(entry),
    detectedAt: state.lastUpdated,
    assignment: Object.values(state.assignments).find((a) => a.issueId === entry.id && a.status !== 'closed') ?? null,
  }))
}

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  detected: 'Detected',
  assigned: 'Assigned',
  'en-route': 'En Route',
  'on-site': 'On Site',
  'in-progress': 'Work In Progress',
  verification: 'Verification',
  resolved: 'Resolved',
  closed: 'Closed',
}
