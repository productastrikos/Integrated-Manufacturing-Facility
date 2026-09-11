import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export type TrendExplainData = {
  label: string
  unit?: string
  currentValue: number
  trendWord: 'holding steady' | 'trending upward' | 'trending downward'
  confidence: 'High' | 'Moderate' | 'Low'
  volatilityPct: number
  forecastValue: number
  forecastSteps: number
  unitLabel: string
  sampleCount: number
  /** A real, state-derived reason for the current direction — e.g. "Production Line 02 is running in WARNING state, pulling the site average down." Omitted when nothing in live state explains it better than the statistics alone. */
  causeText?: string
}

/**
 * Explains a trend chart's forecast in plain language when clicked: what
 * the number is doing, the statistical basis for the projection (so "why
 * is it going down" has a real answer, not just a line), and — where the
 * calling page can point to one — a live-state reason for the direction.
 */
export function TrendExplainModal({ data, onClose }: { data: TrendExplainData; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  const fmt = (v: number) => `${v.toFixed(1)}${data.unit ? ` ${data.unit}` : ''}`
  const directionWord = data.trendWord === 'holding steady' ? 'holding steady' : data.trendWord === 'trending upward' ? 'rising' : 'falling'

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto p-6" style={{ background: 'rgba(0, 0, 0, 0.55)' }} onClick={onClose}>
      <div
        className="kpi-modal-card mt-16 w-full max-w-lg"
        style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', borderRadius: 12, boxShadow: 'var(--app-shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <h3 className="text-[14px] font-semibold" style={{ color: 'var(--app-text)' }}>
            {data.label}
          </h3>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3.5 p-4">
          <div>
            <p className="label mb-1">What's happening</p>
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              {data.label} is currently <b style={{ color: 'var(--app-text)' }}>{fmt(data.currentValue)}</b> and has been {directionWord} over the last{' '}
              {data.sampleCount}
              {data.unitLabel} of readings.
            </p>
          </div>

          {data.causeText && (
            <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
              <p className="label mb-1">Likely reason</p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                {data.causeText}
              </p>
            </div>
          )}

          <div>
            <p className="label mb-1">Why the forecast points this way</p>
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              The dashed line is a straight-line fit through the last {data.sampleCount} readings, extended {data.forecastSteps}
              {data.unitLabel} forward to <b style={{ color: 'var(--app-text)' }}>{fmt(data.forecastValue)}</b>. It isn't reacting to any single
              event — it's simply continuing the average rate of change over that window. {data.trendWord === 'holding steady' ? (
                <>Since that rate is close to zero, the line projects forward almost flat.</>
              ) : data.trendWord === 'trending upward' ? (
                <>Because recent readings have been climbing, the line continues climbing at the same pace.</>
              ) : (
                <>Because recent readings have been falling, the line continues falling at the same pace — this is an extrapolation of the recent slope, not a prediction that something will keep breaking.</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-lg px-3 py-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                Confidence
              </p>
              <p
                className="text-[13px] font-semibold"
                style={{ color: data.confidence === 'High' ? 'var(--app-success)' : data.confidence === 'Moderate' ? 'var(--app-warning)' : 'var(--app-danger)' }}
              >
                {data.confidence}
              </p>
            </div>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                Recent variability
              </p>
              <p className="tnum text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
                ±{data.volatilityPct.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                Sample size
              </p>
              <p className="tnum text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
                {data.sampleCount}
              </p>
            </div>
          </div>

          <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--app-text-faint)' }}>
            This is a simple trend projection over a short recent window, not a guarantee — a shift change, equipment event, or corrective action
            would move the real reading off this line at any time.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
