import { useNavigate } from 'react-router-dom'
import type { SelectionKind } from '../twin/selection'
import { twinLink } from '../twin/focusLink'

export function ViewInTwin({ kind, id, label = 'View in Digital Twin' }: { kind: SelectionKind; id: string; label?: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigate(twinLink(kind, id))
      }}
      className="inline-flex flex-shrink-0 items-center gap-1.5 text-[10.5px] font-bold whitespace-nowrap"
      style={{ color: 'var(--app-accent)', letterSpacing: '0.03em' }}
    >
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        />
      </svg>
      {label}
    </button>
  )
}
