import { useNavigate } from 'react-router-dom'
import { LiveBadge } from '../components/ui'
import { useSimulation } from '../simulation/useSimulation'
import { summarizeInventory } from '../lib/materialsIntelligence'

export function StatusBar() {
  const state = useSimulation()
  const navigate = useNavigate()
  const { kpis, safetySecurity, energy } = state
  const materialsSummary = summarizeInventory(state.materials.materials)

  return (
    <div className="glass-panel flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-semibold tracking-[-0.005em]" style={{ color: 'var(--app-text)' }}>
          Digital Twin
        </span>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-1">
        <Metric label="Facility Health" value={`${kpis.systemHealthPct.toFixed(0)}%`} tone={kpis.systemHealthPct >= 90 ? 'ok' : kpis.systemHealthPct >= 75 ? 'warn' : 'crit'} />
        <Metric label="Active Equipment" value={`${kpis.equipmentRunning} / ${kpis.equipmentTotal}`} />
        <Metric label="Production Lines" value={`${kpis.linesRunning} / ${kpis.linesTotal}`} />
        <Metric label="Critical Alerts" value={safetySecurity.criticalAlerts} tone={safetySecurity.criticalAlerts > 0 ? 'crit' : 'ok'} />
        <Metric label="Energy Consumption" value={`${energy.currentDemandMw.toFixed(2)} MW`} />
        <Metric
          label="Material Health"
          value={`${materialsSummary.healthPct.toFixed(0)}%`}
          tone={materialsSummary.critical + materialsSummary.outOfStock > 0 ? 'crit' : materialsSummary.low > 0 ? 'warn' : 'ok'}
          sub={materialsSummary.low + materialsSummary.critical > 0 ? `${materialsSummary.low} low · ${materialsSummary.critical} critical` : undefined}
          onClick={() => navigate('/app/materials')}
        />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'neutral',
  sub,
  onClick,
}: {
  label: string
  value: string | number
  tone?: 'neutral' | 'ok' | 'warn' | 'crit'
  sub?: string
  onClick?: () => void
}) {
  const color =
    tone === 'ok' ? 'var(--app-success)' : tone === 'warn' ? 'var(--app-warning)' : tone === 'crit' ? 'var(--app-danger)' : 'var(--app-text)'
  const content = (
    <div className="flex items-baseline gap-1.5">
      <span className="label">{label}</span>
      <span className="tnum text-[13px] font-semibold" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="tnum text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
          {sub}
        </span>
      )}
    </div>
  )
  if (!onClick) return content
  return (
    <button onClick={onClick} className="hover:opacity-80">
      {content}
    </button>
  )
}
