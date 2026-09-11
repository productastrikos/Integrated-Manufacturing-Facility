import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { EquipmentStatus } from '../simulation/types'
import { KpiDetailPanel, type KpiDetailList } from './KpiDetailPanel'
import { thresholdCaption, thresholdZone, type KpiThreshold } from '../lib/kpiThresholds'
import astrikosLogo from '../assets/astrikos-logo.png'

/* --------------------------------------------------------------- Icon --- */

export function Icon({ d, size = 12 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export const ICONS = {
  output: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  target: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  trend: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  gauge: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  plug: 'M13 10V3L4 14h7v7l9-11h-7z',
  leaf: 'M17 8C8 10 5.9 16.17 3.82 19.34A9.49 9.49 0 0012 22c5.52 0 10-4.48 10-10A10 10 0 0017 8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  alert: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01',
  building: 'M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M3 21h18M9 8h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1',
  thermometer: 'M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z',
  wind: 'M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2',
  box: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  droplet: 'M12 2.5S5.5 10.8 5.5 15.3a6.5 6.5 0 1013 0C18.5 10.8 12 2.5 12 2.5z',
  snowflake: 'M12 2v20M4.2 6.2l15.6 11.6M4.2 17.8L19.8 6.2M2 12h20M7 4l10 16M17 4L7 20',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
  lock: 'M6 10V7a6 6 0 1112 0v3M5 10h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V10z',
  battery: 'M17 7H7a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2zM22 11v2',
  ban: 'M12 2a10 10 0 100 20 10 10 0 000-20zM4.93 4.93l14.14 14.14',
  clipboard: 'M9 2h6a1 1 0 011 1v1h1a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2h1V3a1 1 0 011-1zM9 12h6M9 16h6',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  hourglass: 'M6 2h12M6 22h12M6 2c0 5 6 6 6 10s-6 5-6 10M18 2c0 5-6 6-6 10s6 5 6 10',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  user: 'M12 12a5 5 0 100-10 5 5 0 000 10zM4 22a8 8 0 0116 0',
  door: 'M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M4 21h14M9 12h.01',
  flag: 'M5 3v18M5 4h11l-2 4 2 4H5',
  flame: 'M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z M12 13a3 3 0 100-6 3 3 0 000 6z',
} as const

/* ---------------------------------------------------------------- Logo -- */

export function Mark({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        flexShrink: 0,
        background: 'linear-gradient(135deg,#0ea5e9 0%,#3b7de8 55%,#8b5cf6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 12px rgba(59,125,232,0.35)',
      }}
    >
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17h18M5 17V9l7-5 7 5v8M9 17v-5h6v5" />
      </svg>
    </div>
  )
}

/**
 * The Astrikos logo stacked above the facility name — used in the sidebar
 * header. The real logo image, never the generic `Mark` glyph, carries the
 * brand; `Mark` stays available separately for the collapsed icon-only rail.
 */
export function Wordmark({ sub, size = 36 }: { sub?: string; size?: number }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1.5">
      <img
        src={astrikosLogo}
        alt="Astrikos"
        style={{ height: Math.round(size * 0.9), width: 'auto', display: 'block', alignSelf: 'flex-start', flexShrink: 0 }}
      />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>
          Integrated Manufacturing Facility
        </div>
        {sub && (
          <div className="truncate text-[9px] uppercase tracking-widest" style={{ color: 'var(--app-text-faint)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Panel -- */

export function Panel({
  label,
  action,
  children,
  className = '',
}: {
  label?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`glass-panel flex min-w-0 flex-col ${className}`}>
      {label && (
        <header
          className="flex items-center justify-between gap-3 px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--app-border)' }}
        >
          <h2 className="label">{label}</h2>
          {action}
        </header>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

/* ---------------------------------------------------------- Live badge -- */

export function LiveBadge({ lastUpdated: _lastUpdated }: { lastUpdated: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="status-chip status-chip-success">
        <span aria-hidden="true" className="pulse-dot">
          ●
        </span>{' '}
        live simulation
      </span>
    </div>
  )
}

/* ---------------------------------------------------------- State chip -- */

type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral'

const STATE_STYLE: Record<EquipmentStatus, { glyph: string; tone: ChipTone; text: string }> = {
  running: { glyph: '●', tone: 'success', text: 'Running' },
  idle: { glyph: '○', tone: 'neutral', text: 'Idle' },
  warning: { glyph: '◆', tone: 'warning', text: 'Warning' },
  critical: { glyph: '▲', tone: 'danger', text: 'Critical' },
  offline: { glyph: '✕', tone: 'neutral', text: 'Offline' },
  maintenance: { glyph: '⚙', tone: 'info', text: 'Maintenance' },
}

export function StateChip({ status }: { status: EquipmentStatus }) {
  const s = STATE_STYLE[status]
  return (
    <span className={`status-chip status-chip-${s.tone}`}>
      <span aria-hidden="true">{s.glyph}</span>
      {s.text}
    </span>
  )
}

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`status-chip status-chip-${tone}`}>{children}</span>
}

/**
 * A slim progress rail plus a plain-language gap-to-target line — what
 * turns "5,135 / 10,000" from a static ratio into something the reader can
 * act on ("4,865 units behind target" reads very differently from "51%").
 */
function ProgressToTarget({ progress, tone }: { progress: { value: number; target: number; unit?: string }; tone: string }) {
  const pct = progress.target > 0 ? Math.min(100, Math.max(0, (progress.value / progress.target) * 100)) : 0
  const gap = progress.target - progress.value
  const unitSuffix = progress.unit ? ` ${progress.unit}` : ''

  return (
    <div className="mt-2">
      <Meter value={progress.value} max={progress.target} tone={tone} />
      <div className="mt-1 flex items-baseline justify-between text-[10.5px]">
        <span style={{ color: 'var(--app-text-faint)' }}>{pct.toFixed(0)}% of target</span>
        <span className="tnum" style={{ color: gap > 0 ? 'var(--app-text-muted)' : 'var(--app-success)' }}>
          {gap > 0 ? `${gap.toLocaleString(undefined, { maximumFractionDigits: 0 })}${unitSuffix} to go` : 'Target reached'}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ KPI tile -- */

const RAG_STYLE = {
  ok: { color: 'var(--app-success)', dot: 'var(--app-success)', label: 'NORMAL' },
  warn: { color: 'var(--app-warning)', dot: 'var(--app-warning)', label: 'WARNING' },
  crit: { color: 'var(--app-danger)', dot: 'var(--app-danger)', label: 'CRITICAL' },
} as const

const TREND_ARROW = { up: '▲', down: '▼', flat: '–' } as const

/**
 * The tick-over-tick movement badge shown next to a KPI's value — arrow
 * direction says which way it just moved, color is the tile's own
 * red/amber/green status so the badge never tells a different story than
 * the tile it sits on. Clicking it opens the same detail panel the DETAILS
 * button does, since that's where the relevant context (trend, forecast,
 * roadmap) already lives — no separate tooltip system to keep in sync.
 */
function TrendBadge({ delta, color, onClick }: { delta: { pct: number; dir: 'up' | 'down' | 'flat' }; color: string; onClick?: () => void }) {
  const sign = delta.pct > 0 ? '+' : ''
  const content = (
    <span className="tnum flex items-center gap-0.5 text-[10px] font-semibold" style={{ color }}>
      <span aria-hidden="true">{TREND_ARROW[delta.dir]}</span>
      {sign}
      {delta.pct.toFixed(1)}%
    </span>
  )
  if (!onClick) return content
  return (
    <button onClick={onClick} className="rounded-sm hover:opacity-80" title="View details" aria-label={`Trend: ${delta.dir}, ${sign}${delta.pct.toFixed(1)}%. Open details.`}>
      {content}
    </button>
  )
}

export function KpiTile({
  label,
  value,
  unit,
  icon,
  sub,
  subValues,
  tone = 'neutral',
  progress,
  description,
  threshold,
  detailList,
  roadmap,
}: {
  label: string
  value: string | number
  unit?: string
  icon?: ReactNode
  sub?: ReactNode
  subValues?: { label: string; value: string | number }[]
  tone?: 'neutral' | 'ok' | 'warn' | 'crit'
  /** Renders a progress rail plus a plain-language gap-to-target line under the value. */
  progress?: { value: number; target: number; unit?: string }
  /** One-line explanation of the metric. Providing this turns on "View details". */
  description?: string
  /** Warning/critical cutoffs for this metric — shown as a caption and driven through to the 7-day chart. */
  threshold?: KpiThreshold
  /** For log/event-style metrics (visitors, access events…) — shows an itemized table in Details instead of a trend chart, since there's nothing to chart. */
  detailList?: KpiDetailList
  /**
   * Overrides the Recommended Roadmap shown in Details. Pass an explicit
   * empty array to hide the Roadmap section entirely when no generic
   * next-step is actually relevant to this metric.
   */
  roadmap?: string[]
}) {
  const numericValue = typeof value === 'number' ? value : Number.parseFloat(value.replace(/,/g, ''))
  const hasNumericTrend = Number.isFinite(numericValue)

  // A threshold, when present, decides the tile's normal/warning/critical
  // state from the live value itself rather than trusting a separately
  // passed `tone` — so the color and the number never disagree.
  const zone = threshold && hasNumericTrend ? thresholdZone(numericValue, threshold) : null
  const rag: 'ok' | 'warn' | 'crit' = zone
    ? zone === 'normal'
      ? 'ok'
      : zone === 'warning'
        ? 'warn'
        : 'crit'
    : tone === 'neutral'
      ? 'ok'
      : tone
  const ragStyle = RAG_STYLE[rag]
  // Color is for exceptions, not a coat of paint on every tile — a normal
  // value (however it got there: no threshold, or a threshold it's safely
  // inside) reads as plain text, so amber/red actually stand out as "look
  // here" instead of competing with green on every other card.
  const valueColor = rag === 'ok' ? 'var(--app-text)' : ragStyle.color

  const [detailsOpen, setDetailsOpen] = useState(false)

  // Tick-over-tick movement, read against the value one render ago — this
  // reads noisier than a longer window would, but it's the one delta every
  // tile can compute for itself without depending on the site-wide 90s
  // history array, which most metrics shown here (BMS, security, safety…)
  // never appear in.
  const prevValueRef = useRef<number | null>(null)
  const [delta, setDelta] = useState<{ pct: number; dir: 'up' | 'down' | 'flat' } | null>(null)
  useEffect(() => {
    if (!hasNumericTrend) return
    const prev = prevValueRef.current
    if (prev !== null && prev !== numericValue) {
      const change = numericValue - prev
      const pct = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0
      const dir = Math.abs(pct) < 0.02 ? 'flat' : change > 0 ? 'up' : 'down'
      setDelta({ pct, dir })
    }
    prevValueRef.current = numericValue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericValue, hasNumericTrend])

  return (
    <div className="kpi-card">
      <div className="flex flex-shrink-0 items-center gap-2" style={{ minHeight: 30 }}>
        <div className="min-w-0 flex-1">
          {/* Flat, muted line icon inline with the label — no colored box —
              a plain visual marker for what the metric is, not a repeat of
              the status color already carried by the value/footer below. */}
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase leading-tight" style={{ color: 'var(--app-text-faint)', letterSpacing: '0.04em' }}>
            {icon && (
              <span className="flex flex-shrink-0 items-center justify-center" style={{ color: 'var(--app-text-muted)' }}>
                {icon}
              </span>
            )}
            {label}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="tnum font-bold leading-none tracking-tight" style={{ color: valueColor, fontSize: 'clamp(1.3rem, 2.1vw, 1.75rem)' }}>
              {value}
            </span>
            {unit && (
              <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-faint)' }}>
                {unit}
              </span>
            )}
            {delta && (
              <TrendBadge delta={delta} color={ragStyle.color} onClick={description || detailList ? () => setDetailsOpen(true) : undefined} />
            )}
          </div>
        </div>
      </div>

      {/* Description and the AI read-out live in DETAILS now, not on the
          card face — the card stays a scannable number, and the "what is
          this / what should I do" context is one click away rather than
          repeated on every tile whether or not you need it right now. */}

      {progress && <ProgressToTarget progress={progress} tone={ragStyle.color} />}

      {/* Always reserved, even when empty — a sibling tile in the same grid
          row with a sub-caption or threshold line (and this one without)
          would otherwise leave the "DETAILS" footer at a different height
          across the row, since items-start (needed so 1-line vs 2-line
          labels don't force uneven stretch) lets each card size to its own
          content. */}
      {!progress && (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--app-text-faint)', minHeight: '1em' }}>
          {sub ?? ' '}
        </div>
      )}

      <div className="mt-1 text-[9.5px]" style={{ color: 'var(--app-text-faint)', minHeight: 22, lineHeight: '12px' }}>
        {threshold ? thresholdCaption(threshold) : ' '}
      </div>

      {subValues && subValues.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-4">
          {subValues.map((sv) => (
            <div key={sv.label} className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                {sv.label}
              </span>
              <span className="tnum text-[12.5px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                {sv.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto">
        <div className="kpi-card-divider" />
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="flex flex-shrink-0 items-center gap-1.5 text-[10px] font-bold" style={{ letterSpacing: '0.07em', color: ragStyle.color }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: ragStyle.dot, display: 'inline-block' }} />
            {ragStyle.label}
          </span>
          {(description || detailList) && (
            <button
              onClick={() => setDetailsOpen(true)}
              className="flex-shrink-0 whitespace-nowrap text-[10px] font-bold"
              style={{ color: 'var(--app-info)', letterSpacing: '0.05em' }}
            >
              DETAILS
            </button>
          )}
        </div>
      </div>

      {detailsOpen && (description || detailList) && (
        <KpiDetailPanel
          label={label}
          value={value}
          unit={unit}
          description={description ?? ''}
          tone={rag}
          liveValue={hasNumericTrend ? numericValue : null}
          threshold={threshold}
          detailList={detailList}
          roadmap={roadmap}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  )
}

/* ----------------------------------------------------------- HoverTip --- */

/**
 * A small info popover for a chart bar/row — opens on hover (desktop) or
 * tap (touch, since there's no hover event there), closes on mouse-leave or
 * a second tap. Generic over its content so the same interaction pattern
 * works for a Cycle Time bar, a Downtime Pareto cause, or a Failure Trend
 * day, wherever a compact visualization needs "what's behind this number"
 * a click or hover away instead of a separate detail screen.
 */
export function HoverTip({ tip, children, className = '', side = 'bottom' }: { tip: ReactNode; children: ReactNode; className?: string; side?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation()
        setOpen((o) => !o)
      }}
    >
      {children}
      {open && (
        <div
          className="pointer-events-none absolute left-1/2 z-30 w-max max-w-[260px] -translate-x-1/2 rounded-md px-2.5 py-2 text-[10.5px] leading-snug shadow-lg"
          style={{
            [side === 'bottom' ? 'top' : 'bottom']: 'calc(100% + 6px)',
            background: 'var(--app-panel)',
            border: '1px solid var(--app-border)',
            color: 'var(--app-text-muted)',
          }}
        >
          {tip}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- Meter ---- */

export function Meter({ value, max, tone = 'var(--app-accent)' }: { value: number; max: number; tone?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%`, background: tone }} />
    </div>
  )
}
