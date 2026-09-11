import { useNavigate } from 'react-router-dom'
import { twinLink } from '../twin/focusLink'
import { useSimulation } from '../simulation/useSimulation'
import type { ValueChainStage } from '../simulation/types'

/**
 * The facility's end-to-end operational flow — procurement through to
 * commissioning and capital works — shown as connected stages. Every stage
 * reads live values from the same simulation the rest of the app uses, and
 * every stage names the place in the Digital Twin where that work happens,
 * so the business process and the building stay tied together.
 */
export function ValueChainFlow() {
  const state = useSimulation()
  const navigate = useNavigate()

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="label">Operational Flow: procurement to commissioning</p>
        <span className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
          Each stage opens its physical location in the Digital Twin
        </span>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {state.valueChain.map((stage, i) => (
          <div key={stage.id} className="flex min-w-0 flex-1 items-stretch gap-2">
            <StageCard
              stage={stage}
              onOpen={() => navigate(twinLink(stage.focusKind, stage.focusId))}
              // Procurement is the pipeline's starting point, so its card also
              // offers the full receiving-to-dispatch walkthrough rather than
              // just a static focus on the receiving office.
              onWalkFlow={stage.id === 'procurement' ? () => navigate(twinLink(stage.focusKind, stage.focusId, { tour: 'material-flow' })) : undefined}
            />
            {i < state.valueChain.length - 1 && (
              <div className="hidden shrink-0 items-center lg:flex" aria-hidden>
                <span className="text-[13px]" style={{ color: 'var(--app-text-faint)' }}>
                  →
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

const STATUS_STYLE: Record<ValueChainStage['status'], { chip: string; label: string }> = {
  'on-track': { chip: 'status-chip-success', label: 'On track' },
  attention: { chip: 'status-chip-warning', label: 'Attention' },
  blocked: { chip: 'status-chip-danger', label: 'Blocked' },
}

function StageCard({ stage, onOpen, onWalkFlow }: { stage: ValueChainStage; onOpen: () => void; onWalkFlow?: () => void }) {
  const style = STATUS_STYLE[stage.status]

  return (
    <div className="glass-panel flex min-w-0 flex-1 flex-col gap-2.5 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
          {stage.name}
        </p>
        <span className={`status-chip shrink-0 ${style.chip}`}>{style.label}</span>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="tnum text-[22px] font-semibold leading-none" style={{ color: 'var(--app-text)' }}>
            {stage.progressPct.toFixed(0)}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
            %
          </span>
        </div>
        <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
          {stage.progressLabel}
        </p>
        {/* progress rail */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--app-border)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, stage.progressPct))}%`,
              background: stage.status === 'attention' ? 'var(--app-warning)' : 'var(--app-accent)',
            }}
          />
        </div>
      </div>

      <dl className="flex flex-col gap-1 text-[11px]">
        <div className="flex items-baseline justify-between gap-2">
          <dt style={{ color: 'var(--app-text-faint)' }}>Open</dt>
          <dd className="tnum" style={{ color: 'var(--app-text-muted)' }}>
            {stage.openItems}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt style={{ color: 'var(--app-text-faint)' }}>Done today</dt>
          <dd className="tnum" style={{ color: 'var(--app-text-muted)' }}>
            {stage.completedToday}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="truncate" style={{ color: 'var(--app-text-faint)' }}>
            {stage.metricLabel}
          </dt>
          <dd className="tnum shrink-0" style={{ color: 'var(--app-text-muted)' }}>
            {stage.metricValue}
          </dd>
        </div>
      </dl>

      <p className="text-[10.5px] leading-snug" style={{ color: 'var(--app-text-faint)' }}>
        {stage.locationLabel}
      </p>

      <div className="mt-auto flex flex-col gap-1.5">
        <button
          onClick={onOpen}
          className="rounded-sm border px-2 py-1 text-[10.5px] font-medium"
          style={{ borderColor: 'var(--app-accent-border)', color: 'var(--app-accent)' }}
        >
          View in Digital Twin
        </button>
        {onWalkFlow && (
          <button
            onClick={onWalkFlow}
            className="rounded-sm border px-2 py-1 text-[10.5px] font-medium"
            style={{ borderColor: 'color-mix(in srgb, var(--twin-amber, #d9a441) 45%, transparent)', color: 'var(--twin-amber, #d9a441)' }}
            title="Guided walkthrough: Receiving → Storage → Preparation → Production → Assembly → Quality → Packaging → Finished Goods → Dispatch"
          >
            Walk the Material Flow
          </button>
        )}
      </div>
    </div>
  )
}
