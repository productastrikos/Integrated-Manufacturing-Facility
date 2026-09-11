import { useLocation } from 'react-router-dom'
import { Panel } from '../components/ui'
import { MODULE_META, NAV_ITEMS } from '../data/navigation'

/**
 * Every nav item routes to something real today. Modules not yet built are
 * stated honestly, with the phase and scope that will fill them in — an
 * empty page that looks finished is worse than one that says what's next.
 */
export default function PlaceholderModule() {
  const { pathname } = useLocation()
  const id = pathname.split('/').pop() ?? ''
  const item = NAV_ITEMS.find((n) => n.id === id)
  const meta = MODULE_META[id]
  if (!item || !meta) return null

  return (
    <Panel label={item.label}>
      <div className="flex flex-col items-start gap-4 px-6 py-12">
        <span className="status-chip status-chip-accent">{meta.phase}</span>
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--app-text)' }}>
          {item.label} is scheduled, not stubbed
        </h2>
        <p className="max-w-[62ch] text-[13px]" style={{ color: 'var(--app-text-muted)' }}>
          The shared simulation store and asset model this module needs already exist. What ships in{' '}
          {meta.phase.toLowerCase()}:
        </p>
        <ul className="flex flex-col gap-1.5">
          {meta.scope.map((s) => (
            <li key={s} className="flex gap-2.5 text-[12.5px]" style={{ color: 'var(--app-text-muted)' }}>
              <span style={{ color: 'var(--app-accent)' }}>—</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
