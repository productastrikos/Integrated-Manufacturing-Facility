import { useSearchParams } from 'react-router-dom'
import { LiveBadge } from '../components/ui'
import { useSimulation } from '../simulation/useSimulation'
import { SafetyBody } from './Safety'
import { SecurityBody } from './Security'

/**
 * Safety and physical security are one module: an unauthorized entry into a
 * restricted zone and a safety incident in that same zone are the same
 * class of question ("is the site under control?"), and both resolve
 * against the same zones, cameras and people. They stay on separate tabs
 * because the working views are genuinely different — compliance and PPE on
 * one side, access control and CCTV on the other.
 *
 * The tab lives in the URL so the deep links that used to point at the old
 * standalone /app/safety and /app/security routes still land in the right
 * place after the merge.
 */
type Tab = 'safety' | 'security'

export default function SafetySecurity() {
  const state = useSimulation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'security' ? 'security' : 'safety'

  function pick(next: Tab) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Safety &amp; Security</h1>
          <p className="page-subtitle">Site safety, regulatory compliance, access control and physical security.</p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      <div className="flex gap-1.5">
        <TabButton active={tab === 'safety'} onClick={() => pick('safety')} label="Safety & Compliance" />
        <TabButton active={tab === 'security'} onClick={() => pick('security')} label="Security & Access Control" />
      </div>

      {tab === 'safety' ? <SafetyBody /> : <SecurityBody />}
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3.5 py-1.5 text-[12px] font-semibold"
      style={{
        background: active ? 'var(--app-accent-bg)' : 'var(--app-surface-soft)',
        border: `1px solid ${active ? 'var(--app-accent-border)' : 'var(--app-border)'}`,
        color: active ? 'var(--app-accent)' : 'var(--app-text-muted)',
      }}
    >
      {label}
    </button>
  )
}
