import { useNavigate } from 'react-router-dom'
import { clearScenarioAlert, useScenarioAlert } from '../simulation/scenarioAlertState'
import { twinLink } from '../twin/focusLink'

/**
 * A persistent, dismissible banner reflecting the currently-run scenario's
 * worst impact — shown on every page (mounted once in AppShell), not just
 * the Simulation page, so a critical scenario preview stays visible while
 * you go look at it elsewhere. Explicitly labeled "SCENARIO PREVIEW" and
 * never touches `state.attention` or any real alert list: this is a
 * hypothetical the scenario runner computed, not something actually
 * happening on the floor right now.
 */
export function ScenarioAlertBanner() {
  const alert = useScenarioAlert()
  const navigate = useNavigate()
  if (!alert) return null

  const color = alert.severity === 'critical' ? 'var(--app-danger)' : 'var(--app-warning)'
  const bg = alert.severity === 'critical' ? 'var(--app-danger-bg)' : 'var(--app-warning-bg)'
  const border = alert.severity === 'critical' ? 'var(--app-danger-border)' : 'var(--app-warning-border)'

  return (
    <div className="flex items-start gap-3 px-4 py-2.5" style={{ background: bg, borderBottom: `1px solid ${border}` }}>
      <span className="pulse-dot mt-0.5 shrink-0" style={{ width: 8, height: 8, borderRadius: 999, background: color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color }}>
            Hypothetical What-If — Not Live Data
          </span>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>
            {alert.scenarioLabel}: {alert.title}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          {alert.whatIsHappening}
        </p>
        <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--app-text-faint)' }}>
          <span className="font-semibold" style={{ color: 'var(--app-success)' }}>
            If this happened, you'd do:
          </span>{' '}
          {alert.resolution}
        </p>
        <p className="mt-1 text-[10px] italic" style={{ color: 'var(--app-text-faint)' }}>
          This is a simulated "what if" from the Simulation page — it has not happened and does not change real inventory, equipment, or any other live
          KPI on this screen.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {alert.targetKind && alert.targetId && (
          <button
            onClick={() => navigate(twinLink(alert.targetKind!, alert.targetId!))}
            className="app-btn h-7 px-2.5 text-[10.5px] font-bold"
            style={{ borderColor: border, color }}
          >
            VIEW IN DIGITAL TWIN →
          </button>
        )}
        <button onClick={clearScenarioAlert} className="icon-btn shrink-0" style={{ width: 22, height: 22 }} aria-label="Dismiss scenario preview">
          ✕
        </button>
      </div>
    </div>
  )
}
