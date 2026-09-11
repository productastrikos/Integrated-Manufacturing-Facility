import { useId } from 'react'
import { ChartTooltip, useChartHover } from './chartHover'
import { HoverTip } from './ui'
import { smoothPath } from '../lib/smoothPath'
import { stableSpan } from '../lib/smoothing'
import { ZONE_COLOR, thresholdZone, type KpiThreshold } from '../lib/kpiThresholds'
import type { TrendPoint, WorkloadWeek, AssetHealthPoint, MtbfMttrPoint, FailurePoint } from '../lib/maintenanceAnalytics'

/** A small "SIMULATED" tag for chart series/points this session has no real history to back. */
function SimulatedTag() {
  return (
    <span className="rounded px-1 py-px text-[7.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)', border: '1px solid var(--app-border)' }}>
      Simulated
    </span>
  )
}

/* ============================================================ line chart == */

/**
 * Compact line chart for a small, real (or partly-real) point series, e.g.
 * 24h equipment health or a 7-day failure count. Points flagged
 * `simulated` draw with reduced opacity and a lighter stroke, so the
 * boundary between real and illustrative data is visible on the chart
 * itself, not just in a caption.
 */
export function TrendLineChart({
  label,
  unit,
  points,
  simulated,
  color = 'var(--app-accent)',
  height = 130,
  threshold,
  emptyText = 'gathering data…',
  onExplain,
}: {
  label: string
  unit?: string
  points: TrendPoint[]
  simulated?: boolean[]
  color?: string
  height?: number
  threshold?: KpiThreshold
  emptyText?: string
  /** When given, the card becomes clickable — opens a compact summary (current/min/max/average, thresholds, and a real reason where one exists). */
  onExplain?: () => void
}) {
  const current = points.length ? points[points.length - 1].value : 0
  const w = 300
  const padTop = 10
  const padBottom = 4
  const gradientId = `mc-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const hover = useChartHover(points.length)
  const hasSimulated = simulated?.some(Boolean)

  if (points.length < 2) {
    return (
      <div className="flex flex-col gap-2">
        <ChartHeader label={label} unit={unit} value={current} color={color} />
        <div className="flex h-[108px] items-center justify-center text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
          {emptyText}
        </div>
      </div>
    )
  }

  const values = points.map((p) => p.value)
  const rawSpan = stableSpan(Math.min(...values), Math.max(...values))
  const { min, max } = threshold ? { min: Math.min(rawSpan.min, threshold.critical, threshold.warning), max: Math.max(rawSpan.max, threshold.critical, threshold.warning) } : rawSpan
  const span = max - min || 1
  const usableH = height - padTop - padBottom
  const toY = (v: number) => padTop + usableH - ((v - min) / span) * usableH

  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, toY(v)] as const)
  const path = smoothPath(pts)
  const [ex, ey] = pts[pts.length - 1]
  const hoveredPoint = hover.index !== null ? points[hover.index] : null
  const hoveredSimulated = hover.index !== null ? simulated?.[hover.index] : false

  return (
    <div
      className="flex flex-col gap-1.5"
      style={onExplain ? { cursor: 'pointer' } : undefined}
      onClick={onExplain}
      role={onExplain ? 'button' : undefined}
      tabIndex={onExplain ? 0 : undefined}
    >
      <ChartHeader label={label} unit={unit} value={current} color={color} />
      <div className="flex gap-1.5">
        <div className="flex flex-shrink-0 items-stretch gap-1">
          <span className="label self-center whitespace-nowrap text-[8px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.06em' }}>
            {unit ?? label}
          </span>
          <div className="flex flex-col justify-between py-0.5 text-right" style={{ height }}>
            <span className="tnum text-[8.5px] leading-none" style={{ color: 'var(--app-text-faint)' }}>
              {max.toFixed(0)}
            </span>
            <span className="tnum text-[8.5px] leading-none" style={{ color: 'var(--app-text-faint)' }}>
              {min.toFixed(0)}
            </span>
          </div>
        </div>
        <div className="relative min-w-0 flex-1" {...hover.bind}>
          <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true" className="block">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={0} x2={w} y1={padTop + usableH * f} y2={padTop + usableH * f} stroke="var(--app-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {threshold && (
              <>
                <line x1={0} x2={w} y1={toY(threshold.warning)} y2={toY(threshold.warning)} stroke={ZONE_COLOR.warning} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.85} />
                <line x1={0} x2={w} y1={toY(threshold.critical)} y2={toY(threshold.critical)} stroke={ZONE_COLOR.critical} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.85} />
              </>
            )}
            <path d={`${path} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`} fill={`url(#${gradientId})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={simulated?.[i] ? 1.6 : 2.2} fill={simulated?.[i] ? 'var(--app-text-faint)' : color} opacity={simulated?.[i] ? 0.6 : 1} />
            ))}
            <circle cx={ex} cy={ey} r="2.8" fill={color} />
            {hover.index !== null && (
              <line x1={pts[hover.index][0]} x2={pts[hover.index][0]} y1={padTop} y2={height} stroke="var(--app-text-faint)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {hover.fraction !== null && hoveredPoint && (
            <ChartTooltip fraction={hover.fraction}>
              <span className="tnum font-semibold">
                {hoveredPoint.value.toFixed(1)}
                {unit ? ` ${unit}` : ''}
              </span>
              <span className="ml-1.5" style={{ color: 'var(--app-text-faint)' }}>
                {hoveredPoint.label}
                {hoveredSimulated ? ' · simulated' : ''}
              </span>
            </ChartTooltip>
          )}
        </div>
      </div>
      <div className="flex justify-between pl-[27px] text-[8px]" style={{ color: 'var(--app-text-faint)' }}>
        <span>{points[0].label}</span>
        <span style={{ color: 'var(--app-text-faint)' }}>Time</span>
        <span>{points[points.length - 1].label}</span>
      </div>
      {threshold && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[27px] text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5" style={{ background: ZONE_COLOR.warning }} />
            Warning {threshold.warning}
            {threshold.unit ?? unit ?? ''}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5" style={{ background: ZONE_COLOR.critical }} />
            Critical {threshold.critical}
            {threshold.unit ?? unit ?? ''}
          </span>
        </div>
      )}
      {hasSimulated && (
        <div className="pl-[27px]">
          <SimulatedTag />
          <span className="ml-1.5 text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
            history before today is illustrative — no multi-day log exists yet this session
          </span>
        </div>
      )}
    </div>
  )
}

function ChartHeader({ label, unit, value, color }: { label: string; unit?: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="label">{label}</span>
      <span className="tnum text-[13px] font-medium" style={{ color }}>
        {value.toFixed(1)}
        {unit && (
          <span className="ml-1 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

/* ========================================================= failure bars == */

/** Simple day-by-day failure/alarm bar-line combo — thin bars, real "Today" highlighted. */
export function FailureTrendChart({ points, height = 108 }: { points: FailurePoint[]; height?: number }) {
  const max = Math.max(1, ...points.map((p) => p.count))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="label">Failure &amp; Alarm Trend</span>
        <span className="tnum text-[13px] font-medium" style={{ color: 'var(--app-danger)' }}>
          {points[points.length - 1]?.count ?? 0} today
        </span>
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {points.map((p) => (
          <HoverTip
            key={p.label}
            className="flex flex-1 flex-col items-center gap-1"
            side="top"
            tip={
              <div>
                <p className="font-semibold" style={{ color: 'var(--app-text)' }}>
                  {p.label}: {p.count} alarm{p.count === 1 ? '' : 's'}
                </p>
                <p style={{ color: 'var(--app-text-faint)' }}>
                  {p.simulated ? 'Illustrative — prior-day history isn’t tracked yet.' : 'Live count of equipment currently in warning or critical.'}
                </p>
              </div>
            }
          >
            <span className="tnum text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
              {p.count}
            </span>
            <div
              className="w-full cursor-pointer rounded-t-sm"
              style={{
                height: Math.max(2, (p.count / max) * (height - 30)),
                background: p.simulated ? 'var(--app-warning)' : 'var(--app-danger)',
                opacity: p.simulated ? 0.55 : 1,
              }}
            />
          </HoverTip>
        ))}
      </div>
      <div className="flex justify-between text-[8px]" style={{ color: 'var(--app-text-faint)' }}>
        {points.map((p) => (
          <span key={p.label} className="flex-1 text-center">
            {p.label}
          </span>
        ))}
      </div>
      <div>
        <SimulatedTag />
        <span className="ml-1.5 text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
          only "Today" is a live count — prior days are illustrative
        </span>
      </div>
    </div>
  )
}

/* ========================================================== stacked bar == */

const WORKLOAD_COLOR = { preventive: 'var(--app-info)', corrective: 'var(--app-warning)', emergency: 'var(--app-danger)' }

/** Preventive / Corrective / Emergency work orders stacked per week. */
export function WorkloadStackedBarChart({ weeks, height = 130 }: { weeks: WorkloadWeek[]; height?: number }) {
  const totals = weeks.map((w) => w.preventive + w.corrective + w.emergency)
  const max = Math.max(1, ...totals)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="label">Maintenance Workload</span>
        <span className="flex items-center gap-2.5 text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
          <LegendDot color={WORKLOAD_COLOR.preventive} label="Preventive" />
          <LegendDot color={WORKLOAD_COLOR.corrective} label="Corrective" />
          <LegendDot color={WORKLOAD_COLOR.emergency} label="Emergency" />
        </span>
      </div>
      <div className="flex items-end gap-4" style={{ height }}>
        {weeks.map((w) => {
          const total = w.preventive + w.corrective + w.emergency
          const barH = Math.max(4, (total / max) * (height - 34))
          return (
            <HoverTip
              key={w.label}
              className="flex flex-1 flex-col items-center gap-1"
              side="top"
              tip={
                <div className="flex flex-col gap-1">
                  <p className="font-semibold" style={{ color: 'var(--app-text)' }}>
                    {w.label} — {total} order{total === 1 ? '' : 's'}
                  </p>
                  <p style={{ color: WORKLOAD_COLOR.preventive }}>Preventive: {w.preventive}</p>
                  <p style={{ color: WORKLOAD_COLOR.corrective }}>Corrective: {w.corrective}</p>
                  <p style={{ color: WORKLOAD_COLOR.emergency }}>Emergency: {w.emergency}</p>
                  {w.simulated && <p style={{ color: 'var(--app-text-faint)' }}>Illustrative — only This Week reflects live work orders.</p>}
                </div>
              }
            >
              <span className="tnum text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
                {total}
              </span>
              <div className="flex w-full cursor-pointer flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: barH, opacity: w.simulated ? 0.55 : 1 }}>
                <div style={{ height: `${(w.preventive / total) * 100}%`, background: WORKLOAD_COLOR.preventive }} />
                <div style={{ height: `${(w.corrective / total) * 100}%`, background: WORKLOAD_COLOR.corrective }} />
                <div style={{ height: `${(w.emergency / total) * 100}%`, background: WORKLOAD_COLOR.emergency }} />
              </div>
              <span className="text-center text-[8px] leading-tight" style={{ color: 'var(--app-text-faint)' }}>
                {w.label}
                {w.simulated ? ' *' : ''}
              </span>
            </HoverTip>
          )
        })}
      </div>
      <div>
        <SimulatedTag />
        <span className="ml-1.5 text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
          * prior weeks are illustrative — only "This Week" reflects live work orders
        </span>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

/* ==================================================== horizontal ranking == */

const HEALTH_THRESHOLD: KpiThreshold = { warning: 75, critical: 60, direction: 'below', unit: '' }

/** Equipment ranked worst-health-first, each bar colored by its own RAG zone. */
export function EquipmentHealthBarChart({ assets }: { assets: AssetHealthPoint[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">Equipment Health by Asset</span>
      <div className="flex flex-col gap-1.5">
        {assets.map((a) => {
          const zone = thresholdZone(a.health, HEALTH_THRESHOLD)
          const color = ZONE_COLOR[zone]
          return (
            <HoverTip
              key={a.id}
              className="flex items-center gap-2"
              tip={
                <div>
                  <p className="font-semibold" style={{ color: 'var(--app-text)' }}>
                    {a.name} ({a.id})
                  </p>
                  <p>
                    Line {a.lineId} · Health{' '}
                    <span style={{ color }}>
                      {a.health.toFixed(0)}/100 ({zone})
                    </span>
                  </p>
                </div>
              }
            >
              <span className="w-[92px] shrink-0 truncate font-[family-name:var(--font-mono)] text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                {a.id}
              </span>
              <div className="h-[10px] flex-1 cursor-pointer overflow-hidden rounded-full" style={{ background: 'var(--app-surface-soft)' }}>
                <div className="h-full rounded-full" style={{ width: `${a.health}%`, background: color }} />
              </div>
              <span className="tnum w-8 shrink-0 text-right text-[10.5px] font-semibold" style={{ color }}>
                {a.health.toFixed(0)}
              </span>
            </HoverTip>
          )
        })}
      </div>
    </div>
  )
}

/* ========================================================== MTBF / MTTR == */

/** Paired horizontal bars per line — MTBF (real equipment lifetime runtime) vs MTTR (this session's accumulated downtime), each on its own scale. */
export function MtbfMttrChart({ points }: { points: MtbfMttrPoint[] }) {
  const maxMtbf = Math.max(1, ...points.map((p) => p.mtbfHours))
  const maxMttr = Math.max(1, ...points.map((p) => p.mttrMinutes))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="label">MTBF vs MTTR</span>
        <span className="flex items-center gap-2.5 text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
          <LegendDot color="var(--app-success)" label="MTBF: avg equipment runtime (hrs)" />
          <LegendDot color="var(--app-warning)" label="MTTR: downtime this session (min)" />
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {points.map((p) => (
          <HoverTip
            key={p.lineId}
            className="flex flex-col gap-0.5"
            tip={
              <div>
                <p className="font-semibold" style={{ color: 'var(--app-text)' }}>
                  {p.lineId}
                </p>
                <p style={{ color: 'var(--app-success)' }}>MTBF (avg runtime): {p.mtbfHours.toFixed(1)}h</p>
                <p style={{ color: p.mttrMinutes > 0 ? 'var(--app-warning)' : 'var(--app-text-faint)' }}>
                  MTTR (downtime this session): {p.mttrMinutes.toFixed(1)}m{p.mttrMinutes === 0 ? ' — no stoppage yet' : ''}
                </p>
              </div>
            }
          >
            <div className="flex cursor-pointer items-center gap-2">
              <span className="w-11 shrink-0 truncate font-[family-name:var(--font-mono)] text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                {p.lineId}
              </span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--app-surface-soft)' }}>
                <div className="h-full rounded-full" style={{ width: `${(p.mtbfHours / maxMtbf) * 100}%`, background: 'var(--app-success)' }} />
              </div>
              <span className="tnum w-12 shrink-0 text-right text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                {p.mtbfHours.toFixed(1)}h
              </span>
            </div>
            <div className="flex cursor-pointer items-center gap-2">
              <span className="w-11 shrink-0" />
              <div className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--app-surface-soft)' }}>
                <div className="h-full rounded-full" style={{ width: `${(p.mttrMinutes / maxMttr) * 100}%`, background: 'var(--app-warning)' }} />
              </div>
              <span className="tnum w-12 shrink-0 text-right text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                {p.mttrMinutes.toFixed(1)}m
              </span>
            </div>
          </HoverTip>
        ))}
      </div>
    </div>
  )
}
