import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel, StateChip } from './ui'
import type { AttentionEntry } from '../lib/attentionFeed'
import { useSimulation } from '../simulation/useSimulation'
import { ASSIGNMENT_STATUS_LABEL } from '../lib/workAllocation'

const ATTENTION_ROTATE_MS = 6000

/**
 * A single rotating attention item, auto-advancing through whatever needs
 * looking at right now — one thing at a time rather than a long static
 * list competing for the same page real estate as the primary panels
 * around it. "View All" expands the full itemized list directly beneath
 * the banner, so nothing reachable before is actually lost — it's one
 * click further away instead of always taking up the space.
 *
 * Shared between Executive Overview's "Requires Attention" and Production
 * & Operations' "Live Operational Exceptions" — same component, same
 * behavior, different filtered slice of the one `buildAttentionFeed()`
 * list and a different `label`, so the two never drift into looking or
 * behaving differently for what is fundamentally the same kind of panel.
 */
export function AttentionBanner({
  entries,
  label = 'Attention Required',
  emptyTitle = 'Nothing needs attention',
  emptyDetail,
  onOpen,
  onOpenTwin,
  onAcknowledge,
}: {
  entries: AttentionEntry[]
  label?: string
  emptyTitle?: string
  emptyDetail?: string
  onOpen: (entry: AttentionEntry) => void
  onOpenTwin: (entry: AttentionEntry) => void
  onAcknowledge: (id: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [viewAllOpen, setViewAllOpen] = useState(false)
  const current = entries[index % Math.max(1, entries.length)] ?? null

  // Keep the pointer in range as items are acknowledged or the feed
  // otherwise changes length, rather than landing past the end.
  useEffect(() => {
    if (index >= entries.length && entries.length > 0) setIndex(0)
  }, [entries.length, index])

  // Auto-advance — paused entirely once there's nothing to rotate through,
  // and always cleaned up on unmount so it doesn't keep ticking against a
  // page that's no longer mounted.
  useEffect(() => {
    if (entries.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % entries.length), ATTENTION_ROTATE_MS)
    return () => clearInterval(t)
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <div className="glass-panel flex items-center gap-3 px-4 py-3">
        <span aria-hidden="true" style={{ color: 'var(--app-success)' }}>
          ●
        </span>
        <div>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
            {emptyTitle}
          </p>
          {emptyDetail && (
            <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
              {emptyDetail}
            </p>
          )}
        </div>
      </div>
    )
  }

  const critical = current?.severity === 'critical'

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-3 rounded-lg px-4 py-3"
        style={{
          background: critical ? 'var(--app-danger-bg)' : 'var(--app-warning-bg)',
          border: `1px solid ${critical ? 'var(--app-danger-border)' : 'var(--app-warning-border)'}`,
        }}
      >
        <span aria-hidden="true" className="shrink-0 text-[15px]" style={{ color: critical ? 'var(--app-danger)' : 'var(--app-warning)' }}>
          {critical ? '!' : '▲'}
        </span>

        <div className="flex shrink-0 flex-col gap-0.5">
          <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
            {label}
          </span>
          <span className="text-[10px] font-bold uppercase" style={{ color: critical ? 'var(--app-danger)' : 'var(--app-warning)', letterSpacing: '0.05em' }}>
            {critical ? 'CRITICAL' : 'WARNING'}
          </span>
        </div>

        {current && (
          <button onClick={() => onOpen(current)} className="min-w-0 flex-1 text-left">
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
              {current.title}
            </span>
            <span className="ml-2 text-[12px]" style={{ color: 'var(--app-text-muted)' }}>
              {current.description}
            </span>
          </button>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <span className="tnum text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {index + 1} / {entries.length}
          </span>
          <button
            onClick={() => setIndex((i) => (i - 1 + entries.length) % entries.length)}
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            aria-label="Previous"
            disabled={entries.length <= 1}
          >
            ‹
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % entries.length)}
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            aria-label="Next"
            disabled={entries.length <= 1}
          >
            ›
          </button>
          <button
            onClick={() => setViewAllOpen((v) => !v)}
            className="text-[10px] font-bold"
            style={{ color: 'var(--app-info)', letterSpacing: '0.05em' }}
            aria-label={`Toggle full ${label.toLowerCase()} list`}
          >
            VIEW ALL {viewAllOpen ? '▲' : '▼'}
          </button>
          {current && (
            <button onClick={() => onAcknowledge(current.id)} className="icon-btn" style={{ width: 22, height: 22 }} aria-label="Acknowledge and dismiss">
              ✕
            </button>
          )}
        </div>
      </div>

      {viewAllOpen && (
        <Panel label={`All ${label} Items`} action={<span className="label">{entries.length} items</span>}>
          <ul>
            {entries.map((a) => (
              <AttentionRow key={a.id} entry={a} onOpen={() => onOpen(a)} onOpenTwin={() => onOpenTwin(a)} onAcknowledge={() => onAcknowledge(a.id)} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

/**
 * One row on the expanded attention list. Every item names the domain
 * (Equipment, Safety, Security, Quality, Materials, Building Services),
 * carries a one-line description of what's actually wrong, and can be
 * acknowledged — which only dismisses it for this session, since the
 * underlying condition is still live in the simulation and will resurface
 * here if it's still true next visit.
 *
 * Clicking the title is the "response flow": it opens the sidebar module
 * that owns this problem with the specific row highlighted, since that
 * page — not the Digital Twin — is where the precise operational detail
 * lives. A secondary link still offers the 3D Digital Twin view for
 * spatial context.
 */
function AttentionRow({
  entry,
  onOpen,
  onOpenTwin,
  onAcknowledge,
}: {
  entry: AttentionEntry
  onOpen: () => void
  onOpenTwin: () => void
  onAcknowledge: () => void
}) {
  const navigate = useNavigate()
  const state = useSimulation()
  const assignment = Object.values(state.assignments).find((a) => a.issueId === entry.id && a.status !== 'closed')
  const assignee = assignment ? state.personnel[assignment.employeeId] : null

  return (
    <li className="flex items-start gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
      <StateChip status={entry.severity === 'critical' ? 'critical' : 'warning'} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <button onClick={onOpen} className="truncate text-left text-[12px] font-semibold hover:underline" style={{ color: 'var(--app-accent)' }}>
            {entry.title}
          </button>
          <span className="label shrink-0">{entry.category}</span>
        </div>
        <div className="mt-0.5 text-[12px]" style={{ color: 'var(--app-text-muted)' }}>
          {entry.description}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button onClick={onOpenTwin} className="text-[10.5px] font-medium hover:underline" style={{ color: 'var(--app-info)' }}>
            View in Digital Twin →
          </button>
          <button
            onClick={() => navigate(`/app/work-allocation?issue=${encodeURIComponent(entry.id)}`)}
            className="text-[10.5px] font-medium hover:underline"
            style={{ color: 'var(--app-accent)' }}
          >
            {assignment ? `Work Allocation: ${assignee?.name ?? assignment.employeeId} — ${ASSIGNMENT_STATUS_LABEL[assignment.status]} →` : 'Assign →'}
          </button>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {entry.metric && (
          <span className="tnum font-[family-name:var(--font-mono)] text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {entry.metric}
          </span>
        )}
        <button onClick={onAcknowledge} className="text-[10px] font-medium" style={{ color: 'var(--app-text-faint)' }}>
          Acknowledge
        </button>
      </div>
    </li>
  )
}
