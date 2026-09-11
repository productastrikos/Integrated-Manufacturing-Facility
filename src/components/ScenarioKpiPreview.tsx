import { useState } from 'react'
import { impactsForModule, useScenarioAlert } from '../simulation/scenarioAlertState'
import type { ImpactModule } from '../lib/factoryEvents'

/**
 * A small pinned badge on a KPI tile showing that module's share of the
 * currently-run scenario's real, already-computed cross-module impact —
 * the same `deriveCascade` list the Simulation page's "Cross-Module
 * Impact" section shows, just surfaced right on the tile it concerns.
 * Purely a visual overlay (absolutely positioned, no layout shift): it
 * never touches the tile's real value, only sits next to it.
 *
 * Wrap the tile in a `relative` container and render this as a sibling:
 *   <div className="relative"><KpiTile .../><ScenarioKpiPreview module="production" /></div>
 */
export function ScenarioKpiPreview({ module, kpiLabel }: { module: ImpactModule; kpiLabel?: string }) {
  const alert = useScenarioAlert()
  const [open, setOpen] = useState(false)
  const impacts = impactsForModule(alert, module)
  const match = (kpiLabel ? impacts.find((i) => i.kpi?.label === kpiLabel) : impacts.find((i) => i.kpi)) ?? impacts[0]
  if (!match) return null

  return (
    <div className="absolute -right-1.5 -top-1.5 z-10">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="pulse-dot flex items-center justify-center rounded-full"
        style={{ width: 16, height: 16, background: 'var(--app-danger)', border: '2px solid var(--app-panel)' }}
        aria-label="Scenario preview affects this KPI"
        title={match.kpi ? `Scenario preview: ${match.kpi.before} → ${match.kpi.after}` : `Scenario preview: ${match.headline}`}
      >
        <span style={{ fontSize: 8, color: '#fff', lineHeight: 1 }}>!</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-5 z-20 w-56 rounded-lg p-2.5 text-left shadow-lg"
          style={{ background: 'var(--app-panel)', border: '1px solid var(--app-danger-border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-danger)' }}>
            Scenario Preview
          </p>
          {match.kpi && (
            <p className="tnum mt-1 text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>
              {match.kpi.before} → {match.kpi.after}
            </p>
          )}
          <p className="mt-1 text-[10.5px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            {match.detail}
          </p>
          <p className="mt-1.5 text-[9px] italic" style={{ color: 'var(--app-text-faint)' }}>
            Hypothetical, not live — see the banner above for the full scenario.
          </p>
        </div>
      )}
    </div>
  )
}
