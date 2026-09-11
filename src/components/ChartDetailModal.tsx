import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export type ChartDetailData = {
  label: string
  unit?: string
  currentValue: number
  minValue: number
  maxValue: number
  averageValue: number
  windowLabel: string
  threshold?: { warning: number; critical: number; direction: 'above' | 'below' }
  /** A real, state-derived reason worth calling out — e.g. which assets are driving the number. Omitted when nothing beats the stats alone. */
  detailText?: string
}

/** A compact click-through summary for a non-forecast trend chart — current value, the range it's moved through, and threshold context, plus a real reason where the caller has one. */
export function ChartDetailModal({ data, onClose }: { data: ChartDetailData; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  const fmt = (v: number) => `${v.toFixed(1)}${data.unit ? ` ${data.unit}` : ''}`
  const zone = data.threshold
    ? data.threshold.direction === 'below'
      ? data.currentValue <= data.threshold.critical
        ? 'critical'
        : data.currentValue <= data.threshold.warning
          ? 'warning'
          : 'normal'
      : data.currentValue >= data.threshold.critical
        ? 'critical'
        : data.currentValue >= data.threshold.warning
          ? 'warning'
          : 'normal'
    : 'normal'
  const zoneColor = zone === 'critical' ? 'var(--app-danger)' : zone === 'warning' ? 'var(--app-warning)' : 'var(--app-success)'

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
          <div className="flex items-center gap-4 rounded-lg px-3 py-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                Current
              </p>
              <p className="tnum text-[16px] font-bold" style={{ color: zoneColor }}>
                {fmt(data.currentValue)}
              </p>
            </div>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                {data.windowLabel} range
              </p>
              <p className="tnum text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
                {fmt(data.minValue)} – {fmt(data.maxValue)}
              </p>
            </div>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                Average
              </p>
              <p className="tnum text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
                {fmt(data.averageValue)}
              </p>
            </div>
          </div>

          {data.detailText && (
            <div>
              <p className="label mb-1">What's driving this</p>
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                {data.detailText}
              </p>
            </div>
          )}

          {data.threshold && (
            <div>
              <p className="label mb-1">Thresholds</p>
              <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--app-text-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--app-warning)' }} />
                  Warning at {fmt(data.threshold.warning)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--app-danger)' }} />
                  Critical at {fmt(data.threshold.critical)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
