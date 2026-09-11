import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Chip, Icon, ICONS, LiveBadge, Panel } from '../components/ui'
import { ViewInTwin } from '../components/ViewInTwin'
import { useSimulation } from '../simulation/useSimulation'
import { simulationEngine } from '../simulation/simulationEngine'
import type { AttentionEntry } from '../lib/attentionFeed'
import {
  ASSIGNMENT_STATUS_LABEL,
  buildWorkIssues,
  candidatesForIssue,
  type Candidate,
  type WorkIssue,
} from '../lib/workAllocation'
import type { AssignmentStatus, Department, Employee, EmployeeAvailability, SimulationState } from '../simulation/types'

/* ==================================================================== display maps == */

const AVAILABILITY_STYLE: Record<EmployeeAvailability, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral'; dot: string }> = {
  available: { label: 'AVAILABLE', tone: 'success', dot: 'var(--app-success)' },
  assigned: { label: 'ASSIGNED', tone: 'accent', dot: 'var(--app-accent)' },
  'en-route': { label: 'EN ROUTE', tone: 'info', dot: 'var(--app-info)' },
  working: { label: 'WORKING', tone: 'accent', dot: 'var(--app-accent)' },
  busy: { label: 'BUSY', tone: 'warning', dot: 'var(--app-warning)' },
  'on-break': { label: 'ON BREAK', tone: 'neutral', dot: 'var(--app-text-faint)' },
  offline: { label: 'OFFLINE', tone: 'neutral', dot: 'var(--app-text-faint)' },
}

const STATUS_PIPELINE: AssignmentStatus[] = ['detected', 'assigned', 'en-route', 'on-site', 'in-progress', 'verification', 'resolved', 'closed']

const DEPARTMENTS: Department[] = ['Maintenance', 'Production', 'Quality', 'Materials', 'Safety', 'Engineering', 'Management']

function severityChipTone(entry: AttentionEntry): 'danger' | 'warning' {
  return entry.severity === 'critical' ? 'danger' : 'warning'
}

function PrimaryButton({ onClick, children, className = '' }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-md px-3 py-1.5 font-semibold ${className}`}
      style={{ background: 'var(--app-accent)', color: '#fff' }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ onClick, disabled, children, className = '', style }: { onClick: () => void; disabled?: boolean; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-md px-3 py-1.5 font-semibold ${className}`}
      style={{ background: 'var(--app-surface-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border)', ...style }}
    >
      {children}
    </button>
  )
}

/* ==================================================================== page == */

/**
 * The Work Allocation / Response Station — the one place a supervisor turns
 * an open `AttentionEntry` into a real, tracked assignment. Unlike the
 * Simulation page's what-if scenarios (strictly read-only, see
 * `scenarioAlertState.ts`), every action here genuinely mutates the shared
 * `SimulationState` via `simulationEngine.assignIssue/escalateIssue/verifyAndClose` —
 * so an assignment made here is immediately visible on every other page
 * that reads `state.personnel` / `state.assignments`.
 */
export default function WorkAllocation() {
  const state = useSimulation()
  const [params, setParams] = useSearchParams()
  const issues = useMemo(() => buildWorkIssues(state), [state])

  const requestedId = params.get('issue')
  const [selectedId, setSelectedId] = useState<string | null>(requestedId)

  useEffect(() => {
    if (requestedId && requestedId !== selectedId) setSelectedId(requestedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId])

  useEffect(() => {
    if (!selectedId && issues.length > 0) setSelectedId(issues[0].entry.id)
  }, [selectedId, issues])

  const selected = issues.find((w) => w.entry.id === selectedId) ?? null

  function selectIssue(id: string) {
    setSelectedId(id)
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.set('issue', id)
      return next
    })
  }

  const unassignedCount = issues.filter((w) => !w.assignment).length
  const activeAssignments = Object.values(state.assignments).filter((a) => a.status !== 'closed')
  const inProgressCount = activeAssignments.filter((a) => a.status === 'in-progress').length
  const verificationCount = activeAssignments.filter((a) => a.status === 'verification').length
  const availableCount = Object.values(state.personnel).filter((e) => e.availability === 'available' && e.onShift).length

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--app-text)' }}>
            Work Allocation / Response Station
          </h1>
          <p className="text-[12px]" style={{ color: 'var(--app-text-faint)' }}>
            DETECT → UNDERSTAND → ALLOCATE → RESPOND → RESOLVE → VERIFY → CLOSE
          </p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryTile label="Open Issues" value={issues.length} icon={ICONS.alert} tone={issues.length > 0 ? 'warn' : 'ok'} />
        <SummaryTile label="Unassigned" value={unassignedCount} icon={ICONS.flag} tone={unassignedCount > 0 ? 'crit' : 'ok'} />
        <SummaryTile label="In Progress" value={inProgressCount} icon={ICONS.wrench} tone="info" />
        <SummaryTile label="Awaiting Verification" value={verificationCount} icon={ICONS.clipboard} tone={verificationCount > 0 ? 'warn' : 'ok'} />
        <SummaryTile label="Personnel Available" value={availableCount} icon={ICONS.users} tone={availableCount > 0 ? 'ok' : 'crit'} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <IssueQueue issues={issues} selectedId={selectedId} onSelect={selectIssue} />
        {selected ? (
          <ResponseStation state={state} issue={selected} />
        ) : (
          <Panel label="Response Station">
            <div className="grid h-full place-items-center p-8 text-center text-[12.5px]" style={{ color: 'var(--app-text-faint)' }}>
              No active concerns right now — the queue is clear.
            </div>
          </Panel>
        )}
      </div>

      <PersonnelDirectory personnel={state.personnel} />
      <ActiveAssignmentsTracker state={state} />
    </div>
  )
}

function SummaryTile({ label, value, icon, tone }: { label: string; value: number; icon: string; tone: 'ok' | 'warn' | 'crit' | 'info' }) {
  const color = tone === 'crit' ? 'var(--app-danger)' : tone === 'warn' ? 'var(--app-warning)' : tone === 'info' ? 'var(--app-info)' : 'var(--app-success)'
  return (
    <div className="glass-panel flex items-center gap-3 px-3 py-2.5">
      <span style={{ color }}>
        <Icon d={icon} size={16} />
      </span>
      <div className="min-w-0">
        <div className="tnum text-lg font-bold leading-none" style={{ color: 'var(--app-text)' }}>
          {value}
        </div>
        <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>
          {label}
        </div>
      </div>
    </div>
  )
}

/* ==================================================================== issue queue == */

function IssueQueue({ issues, selectedId, onSelect }: { issues: WorkIssue[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <Panel label="Active Concerns" action={<span className="label">{issues.length} open</span>}>
      <div className="max-h-[560px] overflow-y-auto">
        {issues.length === 0 ? (
          <div className="p-6 text-center text-[12.5px]" style={{ color: 'var(--app-text-faint)' }}>
            Nothing requires attention right now.
          </div>
        ) : (
          <ul>
            {issues.map((w) => (
              <IssueQueueRow key={w.entry.id} issue={w} selected={w.entry.id === selectedId} onSelect={() => onSelect(w.entry.id)} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

function IssueQueueRow({ issue, selected, onSelect }: { issue: WorkIssue; selected: boolean; onSelect: () => void }) {
  const { entry, assignment } = issue
  return (
    <li>
      <button
        onClick={onSelect}
        className="flex w-full flex-col gap-1.5 px-4 py-3 text-left"
        style={{
          borderBottom: '1px solid var(--app-border)',
          background: selected ? 'var(--app-surface-soft)' : 'transparent',
          borderLeft: selected ? '3px solid var(--app-accent)' : '3px solid transparent',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Chip tone={severityChipTone(entry)}>{entry.severity === 'critical' ? 'CRITICAL' : 'WARNING'}</Chip>
            <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
              {entry.title}
            </span>
          </div>
          <span className="label shrink-0">{entry.category}</span>
        </div>
        <p className="truncate text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
          {issue.location.label}
        </p>
        <div className="flex items-center justify-between gap-2">
          {assignment ? (
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--app-accent)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--app-accent)' }} />
              {ASSIGNMENT_STATUS_LABEL[assignment.status]}
            </span>
          ) : (
            <span className="text-[11px] font-semibold" style={{ color: 'var(--app-danger)' }}>
              Unassigned
            </span>
          )}
          <span className="label">{issue.skillLabel}</span>
        </div>
      </button>
    </li>
  )
}

/* ==================================================================== response station == */

function ResponseStation({ state, issue }: { state: SimulationState; issue: WorkIssue }) {
  const { entry, assignment } = issue
  const candidates = useMemo(() => candidatesForIssue(state, entry), [state, entry])
  const [escalateOpen, setEscalateOpen] = useState(false)

  const assignedEmployee = assignment ? state.personnel[assignment.employeeId] : null

  function assign(candidate: Candidate) {
    simulationEngine.assignIssue(entry.id, candidate.employee.id, candidate.etaMinutes, workMinutesFor(entry.severity), candidate.distanceM)
  }

  function findAvailablePerson() {
    const next = candidates.find((c) => c.employee.availability === 'available' && c.employee.onShift && c.employee.id !== assignment?.employeeId)
    if (next) assign(next)
  }

  return (
    <Panel label="Response Station">
      <div className="flex flex-col gap-4 p-4">
        {/* Issue detail block — spec section 10 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg p-3" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
          <Field label="Issue ID" value={entry.id} />
          <Field label="Issue Type" value={entry.category} />
          <Field label="Severity" value={entry.severity === 'critical' ? 'Critical' : 'Warning'} valueColor={entry.severity === 'critical' ? 'var(--app-danger)' : 'var(--app-warning)'} />
          <Field label="Status" value={assignment ? ASSIGNMENT_STATUS_LABEL[assignment.status] : 'Detected — Unassigned'} />
          <Field label="Affected Equipment / Line" value={issue.location.equipmentId ?? issue.location.lineId ?? '—'} />
          <Field label="Location / Station" value={issue.location.label} />
          <Field label="Time Detected" value={issue.detectedAt} />
          <Field label="Required Skill" value={issue.skillLabel} />
          <Field label="Required Department" value={issue.department} />
          <Field label="Description" value={entry.description} span2 />
        </div>

        {/* Current assignee / progress, or the recommended-assignee card */}
        {assignment && assignedEmployee ? (
          <AssignmentProgress state={state} issue={issue} employee={assignedEmployee} />
        ) : (
          <RecommendedAssigneeCard candidates={candidates} onAssign={assign} />
        )}

        {/* Full candidate roster for this issue — spec section 11/12 */}
        <div>
          <h3 className="mb-2 label">Available Personnel — {issue.department}</h3>
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--app-border)' }}>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr style={{ background: 'var(--app-surface-soft)' }}>
                  {['Name', 'Role', 'Skill Match', 'Availability', 'Distance', 'ETA', 'Workload', 'Shift', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-2.5 py-4 text-center" style={{ color: 'var(--app-text-faint)' }}>
                      No personnel with a matching department or skill are on the roster.
                    </td>
                  </tr>
                )}
                {candidates.map((c) => (
                  <CandidateRow key={c.employee.id} candidate={c} isAssigned={assignment?.employeeId === c.employee.id} onAssign={() => assign(c)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Forward / escalate — spec section 14 */}
        <div className="flex flex-wrap items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--app-border)' }}>
          <SecondaryButton onClick={findAvailablePerson} className="text-[11.5px]">
            Find Available Person
          </SecondaryButton>
          <div className="relative">
            <SecondaryButton onClick={() => setEscalateOpen((v) => !v)} className="text-[11.5px]">
              Forward / Escalate ▾
            </SecondaryButton>
            {escalateOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
                {DEPARTMENTS.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      simulationEngine.escalateIssue(entry.id, d)
                      setEscalateOpen(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-[11.5px] hover:opacity-80"
                    style={{ color: 'var(--app-text)' }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
          {assignment?.escalated && (
            <span className="text-[11px]" style={{ color: 'var(--app-warning)' }}>
              Escalated to {assignment.escalated.toDepartment} at {assignment.escalated.at}
            </span>
          )}
          <div className="ml-auto">
            <ViewInTwin kind={entry.twinKind} id={entry.twinId} />
          </div>
        </div>
      </div>
    </Panel>
  )
}

function workMinutesFor(severity: 'warning' | 'critical'): number {
  return severity === 'critical' ? 25 : 15
}

function Field({ label, value, valueColor, span2 }: { label: string; value: string; valueColor?: string; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>
        {label}
      </div>
      <div className="mt-0.5 text-[12px]" style={{ color: valueColor ?? 'var(--app-text)' }}>
        {value}
      </div>
    </div>
  )
}

function RecommendedAssigneeCard({ candidates, onAssign }: { candidates: Candidate[]; onAssign: (c: Candidate) => void }) {
  const recommended = candidates.find((c) => c.recommended)
  if (!recommended) {
    return (
      <div className="rounded-lg p-3 text-[12px]" style={{ background: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)', color: 'var(--app-danger)' }}>
        No available, on-shift personnel currently match this issue's department or skill — escalate to another department or wait for someone to come off break.
      </div>
    )
  }
  const e = recommended.employee
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--app-success-bg)', border: '1px solid var(--app-success)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-success)' }}>
            ★ Recommended Assignee
          </div>
          <div className="mt-0.5 text-[13.5px] font-bold" style={{ color: 'var(--app-text)' }}>
            {e.name} — {e.role}
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
            {e.department} · Skill match {recommended.skillMatch} · {recommended.distanceM}m away · ETA {recommended.etaMinutes} min · {e.activeTaskCount} active task{e.activeTaskCount === 1 ? '' : 's'}
          </div>
        </div>
        <PrimaryButton onClick={() => onAssign(recommended)} className="shrink-0 text-[12px]">
          Assign
        </PrimaryButton>
      </div>
    </div>
  )
}

function CandidateRow({ candidate, isAssigned, onAssign }: { candidate: Candidate; isAssigned: boolean; onAssign: () => void }) {
  const e = candidate.employee
  const style = AVAILABILITY_STYLE[e.availability]
  const canAssign = (e.availability === 'available' || e.availability === 'on-break') && e.onShift
  return (
    <tr style={{ borderTop: '1px solid var(--app-border)', background: candidate.recommended ? 'var(--app-surface-soft)' : 'transparent' }}>
      <td className="whitespace-nowrap px-2.5 py-2 font-semibold" style={{ color: 'var(--app-text)' }}>
        {candidate.recommended && <span style={{ color: 'var(--app-success)' }}>★ </span>}
        {e.name}
        <div className="text-[10px] font-normal" style={{ color: 'var(--app-text-faint)' }}>
          {e.id}
        </div>
      </td>
      <td className="whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
        {e.role}
      </td>
      <td className="whitespace-nowrap px-2.5 py-2">
        <Chip tone={candidate.skillMatch === 'HIGH' ? 'success' : candidate.skillMatch === 'MEDIUM' ? 'info' : 'neutral'}>{candidate.skillMatch}</Chip>
      </td>
      <td className="whitespace-nowrap px-2.5 py-2">
        <span className="flex items-center gap-1.5" style={{ color: style.dot }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: style.dot, display: 'inline-block' }} />
          <span style={{ color: 'var(--app-text)' }}>{style.label}</span>
        </span>
      </td>
      <td className="tnum whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
        {candidate.distanceM}m
      </td>
      <td className="tnum whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
        {candidate.etaMinutes} min
      </td>
      <td className="tnum whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
        {e.activeTaskCount} task{e.activeTaskCount === 1 ? '' : 's'}
      </td>
      <td className="whitespace-nowrap px-2.5 py-2" style={{ color: e.onShift ? 'var(--app-text-muted)' : 'var(--app-text-faint)' }}>
        {e.onShift ? 'On Shift' : 'Off Shift'}
      </td>
      <td className="whitespace-nowrap px-2.5 py-2 text-right">
        {isAssigned ? (
          <span className="text-[10.5px] font-bold" style={{ color: 'var(--app-accent)' }}>
            Assigned
          </span>
        ) : (
          <SecondaryButton onClick={onAssign} disabled={!canAssign} className="text-[10.5px] disabled:opacity-40" style={{ padding: '3px 10px' }}>
            Assign
          </SecondaryButton>
        )}
      </td>
    </tr>
  )
}

/* ==================================================================== assignment progress == */

function AssignmentProgress({ state, issue, employee }: { state: SimulationState; issue: WorkIssue; employee: Employee }) {
  const assignment = issue.assignment!
  const currentIndex = STATUS_PIPELINE.indexOf(assignment.status)

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-accent)' }}>
            Assigned To
          </div>
          <div className="mt-0.5 text-[13.5px] font-bold" style={{ color: 'var(--app-text)' }}>
            {employee.name} — {employee.role}
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
            {assignment.distanceM}m away · ETA {assignment.etaMinutes} min · est. {assignment.workMinutes} min on site
          </div>
        </div>
        {assignment.status === 'verification' && (
          <PrimaryButton onClick={() => simulationEngine.verifyAndClose(assignment.id)} className="shrink-0 text-[12px]">
            Verify &amp; Close
          </PrimaryButton>
        )}
      </div>

      {/* Workflow pipeline — spec section 13 */}
      <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_PIPELINE.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
              style={{
                background: i <= currentIndex ? 'var(--app-accent)' : 'var(--app-surface)',
                color: i <= currentIndex ? '#fff' : 'var(--app-text-faint)',
                border: i <= currentIndex ? 'none' : '1px solid var(--app-border)',
              }}
            >
              {ASSIGNMENT_STATUS_LABEL[s]}
            </span>
            {i < STATUS_PIPELINE.length - 1 && (
              <span style={{ color: i < currentIndex ? 'var(--app-accent)' : 'var(--app-border)' }}>→</span>
            )}
          </div>
        ))}
      </div>

      {/* Live event timeline for this assignment — spec section 16 */}
      <div className="mt-3 space-y-1">
        {assignment.history.map((h, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--app-accent)' }} />
            <span className="tnum">{h.at}</span>
            <span style={{ color: 'var(--app-text-muted)' }}>{ASSIGNMENT_STATUS_LABEL[h.status]}</span>
          </div>
        ))}
      </div>

      {issue.entry.category === 'Equipment' && state.equipment[issue.location.equipmentId ?? '']?.scripted === undefined && assignment.status !== 'assigned' && assignment.status !== 'en-route' && assignment.status !== 'on-site' && (
        <p className="mt-2 text-[10.5px]" style={{ color: 'var(--app-success)' }}>
          Equipment condition is recovering — health, temperature and vibration are returning to normal.
        </p>
      )}
    </div>
  )
}

/* ==================================================================== personnel directory == */

function PersonnelDirectory({ personnel }: { personnel: Record<string, Employee> }) {
  const employees = Object.values(personnel).sort((a, b) => {
    const rank = (e: Employee) => (e.availability === 'available' ? 0 : e.availability === 'on-break' ? 1 : e.availability === 'busy' ? 2 : e.availability === 'offline' ? 5 : 3)
    return rank(a) - rank(b) || a.department.localeCompare(b.department)
  })

  return (
    <Panel label="Personnel Directory" action={<span className="label">{employees.length} on roster</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr style={{ background: 'var(--app-surface-soft)' }}>
              {['Name', 'Employee ID', 'Role', 'Department', 'Availability', 'Current Assignment', 'Location', 'Workload', 'Shift'].map((h) => (
                <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const style = AVAILABILITY_STYLE[e.availability]
              return (
                <tr key={e.id} style={{ borderTop: '1px solid var(--app-border)' }}>
                  <td className="whitespace-nowrap px-2.5 py-2 font-semibold" style={{ color: 'var(--app-text)' }}>
                    {e.name}
                  </td>
                  <td className="tnum whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-faint)' }}>
                    {e.id}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
                    {e.role}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
                    {e.department}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2">
                    <span className="flex items-center gap-1.5">
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: style.dot, display: 'inline-block' }} />
                      <span style={{ color: 'var(--app-text)' }}>{style.label}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-faint)' }}>
                    {e.currentAssignmentId ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
                    {e.locationLabel}
                  </td>
                  <td className="tnum whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
                    {e.activeTaskCount} task{e.activeTaskCount === 1 ? '' : 's'}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2" style={{ color: e.onShift ? 'var(--app-success)' : 'var(--app-text-faint)' }}>
                    {e.onShift ? 'On Shift' : 'Off Shift'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/* ==================================================================== active assignments tracker == */

function ActiveAssignmentsTracker({ state }: { state: SimulationState }) {
  const active = Object.values(state.assignments).filter((a) => a.status !== 'closed')
  const issuesById = useMemo(() => new Map(buildWorkIssues(state).map((w) => [w.entry.id, w])), [state])

  return (
    <Panel label="Active Assignments" action={<span className="label">{active.length} in flight</span>}>
      {active.length === 0 ? (
        <div className="p-4 text-center text-[12px]" style={{ color: 'var(--app-text-faint)' }}>
          Nothing currently assigned.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr style={{ background: 'var(--app-surface-soft)' }}>
                {['Issue', 'Assigned To', 'Status', 'ETA', 'Since'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((a) => {
                const w = issuesById.get(a.issueId)
                const emp = state.personnel[a.employeeId]
                return (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--app-border)' }}>
                    <td className="px-2.5 py-2" style={{ color: 'var(--app-text)' }}>
                      {w?.entry.title ?? a.issueId}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
                      {emp?.name ?? a.employeeId}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-accent)' }}>
                      {ASSIGNMENT_STATUS_LABEL[a.status]}
                    </td>
                    <td className="tnum whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-muted)' }}>
                      {a.etaMinutes} min
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2" style={{ color: 'var(--app-text-faint)' }}>
                      {a.assignedAt}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
