import { useNavigate } from 'react-router-dom'

/**
 * The reverse of ViewInTwin — a button that leaves the 3D scene for the
 * sidebar module that owns the data just shown, so the twin acts as a
 * spatial entry point into the rest of the platform rather than a dead end.
 */
export function ModuleLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigate(to)
      }}
      className="rounded-sm px-2.5 py-1.5 text-[11px] font-bold"
      style={{ background: 'var(--app-accent-bg)', color: 'var(--app-accent)', border: '1px solid var(--app-accent-border)', letterSpacing: '0.02em' }}
    >
      {label}
    </button>
  )
}
