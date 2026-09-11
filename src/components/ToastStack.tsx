import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dismissNotification, useNotifications, type Notification } from '../lib/notifications'

const TYPE_STYLE: Record<Notification['type'], { color: string; glyph: string }> = {
  success: { color: 'var(--app-success)', glyph: '✓' },
  info: { color: 'var(--app-info)', glyph: '●' },
  warning: { color: 'var(--app-warning)', glyph: '▲' },
}

const AUTO_DISMISS_MS = 7000

/** Auto-dismissing toast popups for one-off events (a purchase order placed, etc.) — mounted once in AppShell so it renders above every route, well clear of the header and any page content underneath. */
export function ToastStack() {
  const notifications = useNotifications()
  const visible = notifications.slice(0, 4)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[600] flex flex-col-reverse gap-3">
      {visible.map((n) => (
        <Toast key={n.id} note={n} />
      ))}
    </div>
  )
}

function Toast({ note }: { note: Notification }) {
  const navigate = useNavigate()
  const style = TYPE_STYLE[note.type]

  useEffect(() => {
    const t = setTimeout(() => dismissNotification(note.id), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [note.id])

  return (
    <div
      className="animate-slide-up pointer-events-auto w-[340px] rounded-lg p-3"
      style={{
        background: 'var(--app-panel)',
        border: '1px solid var(--app-border)',
        borderLeft: `3px solid ${style.color}`,
        boxShadow: 'var(--app-shadow-lg, 0 8px 24px rgba(0,0,0,0.45))',
      }}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-[13px]" style={{ color: style.color }} aria-hidden="true">
          {style.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
            {note.title}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            {note.message}
          </p>
          {note.href && (
            <button
              onClick={() => {
                dismissNotification(note.id)
                navigate(note.href!)
              }}
              className="mt-1.5 text-[10.5px] font-bold"
              style={{ color: style.color, letterSpacing: '0.03em' }}
            >
              {note.hrefLabel ?? 'VIEW →'}
            </button>
          )}
        </div>
        <button onClick={() => dismissNotification(note.id)} className="icon-btn shrink-0" style={{ width: 20, height: 20 }} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  )
}
