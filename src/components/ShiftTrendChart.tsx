import { useId } from 'react'
import { ChartTooltip, useChartHover } from './chartHover'
import { smoothPath } from '../lib/smoothPath'
import { stableSpan } from '../lib/smoothing'
import { ZONE_COLOR, thresholdBands, type KpiThreshold } from '../lib/kpiThresholds'
import type { ShiftTrendPoint } from '../lib/shiftTrends'

/**
 * The Trends panel's per-metric chart, shift-hour edition: one real point
 * per completed-or-open shift-hour (see `shiftHourlyTrends`), X-axis
 * labeled with the shift clock instead of TrendChart's "seconds ago"
 * rolling window. A session that has only just started has only one
 * real bucket so far — shown as "gathering shift data…" rather than an
 * empty chart, since it's real data, just not yet enough of it to draw
 * a line through.
 */
export function ShiftTrendChart({
  label,
  unit,
  points,
  color = 'var(--app-accent)',
  formatter,
  height = 108,
  threshold,
}: {
  label: string
  unit?: string
  points: ShiftTrendPoint[]
  color?: string
  formatter?: (v: number) => string
  height?: number
  threshold?: KpiThreshold
}) {
  const current = points.length ? points[points.length - 1].value : 0
  const w = 300
  const padTop = 10
  const padBottom = 4
  const gradientId = `stc-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const hover = useChartHover(points.length)
  const fmt = (v: number) => (formatter ? formatter(v) : v.toFixed(1))

  if (points.length < 2) {
    return (
      <div className="flex flex-col gap-2 px-3.5 py-3">
        <ChartHeader label={label} unit={unit} value={current} formatter={formatter} color={color} />
        <div className="flex h-[108px] items-center justify-center text-center text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
          gathering shift data…
        </div>
      </div>
    )
  }

  const values = points.map((p) => p.value)
  const rawSpan = stableSpan(Math.min(...values), Math.max(...values))
  const { min, max } = threshold ? thresholdBands(threshold, rawSpan.min, rawSpan.max) : rawSpan
  const span = max - min || 1
  const usableH = height - padTop - padBottom
  const toY = (v: number) => padTop + usableH - ((v - min) / span) * usableH

  const pts = values.map((v, i) => [points.length > 1 ? (i / (points.length - 1)) * w : 0, toY(v)] as const)
  const path = smoothPath(pts)
  const fadeDistance = Math.min(usableH * 0.45, 40)
  const offsetPts = pts.map(([x, y]) => [x, Math.min(height, y + fadeDistance)] as const)
  const ribbonReturn = smoothPath([...offsetPts].reverse()).replace(/^M[\d.,-]+/, '')
  const area = `${path} L${offsetPts[offsetPts.length - 1][0]},${offsetPts[offsetPts.length - 1][1]}${ribbonReturn} Z`
  const [ex, ey] = pts[pts.length - 1]

  const bands = threshold ? thresholdBands(threshold, rawSpan.min, rawSpan.max).bands : null
  const hoveredPoint = hover.index !== null ? points[hover.index] : null

  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-3">
      <ChartHeader label={label} unit={unit} value={current} formatter={formatter} color={color} />

      <div className="flex gap-1.5">
        <div className="flex flex-shrink-0 items-stretch gap-1">
          <span
            className="label self-center whitespace-nowrap text-[8px]"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.06em' }}
          >
            {unit ?? label}
          </span>
          <div className="flex flex-col justify-between py-0.5 text-right" style={{ height }}>
            <span className="tnum text-[8.5px] leading-none" style={{ color: 'var(--app-text-faint)' }}>
              {fmt(max)}
            </span>
            <span className="tnum text-[8.5px] leading-none" style={{ color: 'var(--app-text-faint)' }}>
              {fmt(min)}
            </span>
          </div>
        </div>

        <div className="relative min-w-0 flex-1" {...hover.bind}>
          <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true" className="block">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {bands &&
              bands.map((b) => (
                <rect key={b.zone} x={0} width={w} y={Math.min(toY(b.from), toY(b.to))} height={Math.abs(toY(b.to) - toY(b.from))} fill={ZONE_COLOR[b.zone]} opacity={0.07} />
              ))}

            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={0} x2={w} y1={padTop + usableH * f} y2={padTop + usableH * f} stroke="var(--app-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}

            {threshold && (
              <>
                <line x1={0} x2={w} y1={toY(threshold.warning)} y2={toY(threshold.warning)} stroke={ZONE_COLOR.warning} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.85} />
                <line x1={0} x2={w} y1={toY(threshold.critical)} y2={toY(threshold.critical)} stroke={ZONE_COLOR.critical} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.85} />
              </>
            )}

            <path d={area} fill={`url(#${gradientId})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2" fill={color} opacity={hover.index === null || hover.index === i ? 1 : 0.5} />
            ))}
            <circle cx={ex} cy={ey} r="2.6" fill={color} />
            <circle cx={ex} cy={ey} r="2.6" fill={color} opacity={0.35}>
              <animate attributeName="r" values="2.6;6;2.6" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite" />
            </circle>

            {hover.index !== null && (
              <>
                <line x1={pts[hover.index][0]} x2={pts[hover.index][0]} y1={padTop} y2={height} stroke="var(--app-text-faint)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                <circle cx={pts[hover.index][0]} cy={pts[hover.index][1]} r="3" fill={color} stroke="var(--app-panel)" strokeWidth="1.2" />
              </>
            )}
          </svg>

          {hover.fraction !== null && hoveredPoint && (
            <ChartTooltip fraction={hover.fraction}>
              <span className="tnum font-semibold">
                {fmt(hoveredPoint.value)}
                {unit ? ` ${unit}` : ''}
              </span>
              <span className="ml-1.5" style={{ color: 'var(--app-text-faint)' }}>
                {hoveredPoint.label}
              </span>
            </ChartTooltip>
          )}
        </div>
      </div>

      <div className="flex justify-between pl-[34px] text-[8.5px]" style={{ color: 'var(--app-text-faint)' }}>
        {points.map((p, i) => (
          <span key={i}>{p.label}</span>
        ))}
      </div>
      <div className="pl-[34px] text-center text-[8px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
        Shift Time
      </div>

      {threshold && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[34px] text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
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
    </div>
  )
}

function ChartHeader({
  label,
  unit,
  value,
  formatter,
  color,
}: {
  label: string
  unit?: string
  value: number
  formatter?: (v: number) => string
  color: string
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="label">{label}</span>
      <span className="tnum text-[13px] font-medium" style={{ color }}>
        {formatter ? formatter(value) : value.toFixed(1)}
        {unit && (
          <span className="ml-1 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}
