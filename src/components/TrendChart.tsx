import { useId } from 'react'
import { movingAverage, stableSpan } from '../lib/smoothing'
import { ChartTooltip, useChartHover } from './chartHover'
import { smoothPath } from '../lib/smoothPath'
import { ZONE_COLOR, thresholdBands, thresholdZone, type KpiThreshold } from '../lib/kpiThresholds'

/**
 * A single restrained line chart: faint gridlines, one muted stroke, a soft
 * area fill, an emphasized endpoint. No legend clutter, no bright palette —
 * this is read at a glance, not admired.
 *
 * The plotted line is lightly smoothed and the Y-axis has a sane minimum
 * span — without both, a metric that only moves by hundredths of a unit
 * gets auto-scaled so tightly that ordinary sensor noise fills the whole
 * chart height and reads as a jagged square wave instead of a real trace.
 *
 * Axis labels are plain HTML, not SVG <text> — the plot SVG uses
 * `preserveAspectRatio="none"` so the line always fills the card's exact
 * width, and text rendered inside that same viewBox would get stretched
 * non-uniformly along with it.
 *
 * When a `threshold` is supplied, the plot area is banded green/amber/red
 * for the normal/warning/critical zones and the two threshold values are
 * drawn as labeled dashed lines — so the chart shows not just the trend
 * but exactly where it crosses into a state that needs attention.
 */
export function TrendChart({
  data,
  label,
  unit,
  color = 'var(--app-accent)',
  formatter,
  height = 108,
  threshold,
  /** X-axis caption — override for non-90s-rolling data (e.g. a 30-day inventory trend). */
  xAxisCaption = 'time (seconds ago)',
  /** X-axis left-edge label — defaults to "−Ns" for the 90s rolling window. */
  xAxisStart,
  /** Hover-tooltip suffix for "N<suffix>" — defaults to "s ago" for seconds. Ignored when `pointLabels` is given. */
  hoverUnit = 's ago',
  /** Point labels (e.g. wall-clock times), same length/order as `data` — when given, the hover tooltip and X-axis end label show the real label for that point instead of "Nx ago" / "now". */
  pointLabels,
  /** 'line' (default) is the smoothed area/line trace; 'bar' draws each sample as a column; 'wave' is a heavier-smoothed curve marking every threshold-zone crossing. */
  variant = 'line',
}: {
  data: number[]
  label: string
  unit?: string
  color?: string
  formatter?: (v: number) => string
  height?: number
  threshold?: KpiThreshold
  xAxisCaption?: string
  xAxisStart?: string
  hoverUnit?: string
  pointLabels?: string[]
  variant?: 'line' | 'bar' | 'wave'
}) {
  const current = data.length ? data[data.length - 1] : 0
  const w = 300
  const padTop = 10
  const padBottom = 4
  const gradientId = `tc-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  // Called unconditionally (even while still "accumulating samples") so the
  // hook order never changes between the empty-state render and the real
  // chart render — a component can't call a hook only on some renders.
  const hover = useChartHover(data.length)

  if (data.length < 2) {
    return (
      <div className="flex flex-col gap-2 px-3.5 py-3">
        <ChartHeader label={label} unit={unit} value={current} formatter={formatter} color={color} />
        <div className="flex h-[108px] items-center justify-center text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
          accumulating samples…
        </div>
      </div>
    )
  }

  // The wave variant smooths over a wider window so the curve reads as a
  // deliberate wave rather than following every second-to-second wobble.
  const smoothed = movingAverage(data, variant === 'wave' ? 11 : 5)
  const rawSpan = stableSpan(Math.min(...smoothed), Math.max(...smoothed))
  const { min, max } = threshold ? thresholdBands(threshold, rawSpan.min, rawSpan.max) : rawSpan
  const span = max - min || 1
  const usableH = height - padTop - padBottom
  const toY = (v: number) => padTop + usableH - ((v - min) / span) * usableH

  const pts = smoothed.map((v, i) => {
    const x = (i / (smoothed.length - 1)) * w
    return [x, toY(v)] as const
  })
  const path = smoothPath(pts)
  // The fill is a constant-thickness ribbon that follows the line's own
  // contour, not a fill down to the axis floor — a value sitting near the
  // top of a threshold-expanded domain would otherwise paint almost the
  // entire chart solid instead of reading as a line with a subtle glow.
  const fadeDistance = Math.min(usableH * 0.45, 40)
  const offsetPts = pts.map(([x, y]) => [x, Math.min(height, y + fadeDistance)] as const)
  const ribbonReturn = smoothPath([...offsetPts].reverse()).replace(/^M[\d.,-]+/, '')
  const area = `${path} L${offsetPts[offsetPts.length - 1][0]},${offsetPts[offsetPts.length - 1][1]}${ribbonReturn} Z`
  const [ex, ey] = pts[pts.length - 1]
  const fmt = (v: number) => (formatter ? formatter(v) : v.toFixed(1))

  // Column geometry for the bar variant — one column per sample, baseline
  // at the Y-axis floor so height alone reads as the value.
  const baselineY = padTop + usableH
  const barSlot = w / smoothed.length
  const barGap = Math.min(1.2, barSlot * 0.22)
  const barW = Math.max(0.6, barSlot - barGap)
  const bars = smoothed.map((v, i) => {
    const x = i * barSlot + barGap / 2
    const y = toY(v)
    return { x, y, h: Math.max(0, baselineY - y) }
  })

  // Hover reads the RAW sample, not the smoothed one — the smoothing exists
  // to make the line legible, but the number a user inspects should be the
  // value the simulation actually produced at that moment.
  const hoveredValue = hover.index !== null ? data[hover.index] : null
  const secondsAgo = hover.index !== null ? data.length - 1 - hover.index : 0
  const hoveredLabel = hover.index !== null ? pointLabels?.[hover.index] : undefined

  const bands = threshold ? thresholdBands(threshold, rawSpan.min, rawSpan.max).bands : null

  // Wave variant: mark every point the smoothed line actually crosses into
  // a different threshold zone, so "wavy with threshold markings" means
  // the exact moments it went from normal→warning→critical, not just bands.
  const waveMarkers =
    variant === 'wave' && threshold
      ? pts.reduce<{ x: number; y: number; zone: 'normal' | 'warning' | 'critical' }[]>((acc, [x, y], i) => {
          if (i === 0) return acc
          const prevZone = thresholdZone(smoothed[i - 1], threshold)
          const curZone = thresholdZone(smoothed[i], threshold)
          if (prevZone !== curZone) acc.push({ x, y, zone: curZone })
          return acc
        }, [])
      : []

  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-3">
      <ChartHeader label={label} unit={unit} value={current} formatter={formatter} color={color} />

      <div className="flex gap-1.5">
        {/* Y-axis: title plus the min/max of the plotted (smoothed) range */}
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
                <rect
                  key={b.zone}
                  x={0}
                  width={w}
                  y={Math.min(toY(b.from), toY(b.to))}
                  height={Math.abs(toY(b.to) - toY(b.from))}
                  fill={ZONE_COLOR[b.zone]}
                  opacity={0.07}
                />
              ))}

            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={0}
                x2={w}
                y1={padTop + usableH * f}
                y2={padTop + usableH * f}
                stroke="var(--app-border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {threshold && (
              <>
                <line x1={0} x2={w} y1={toY(threshold.warning)} y2={toY(threshold.warning)} stroke={ZONE_COLOR.warning} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.85} />
                <line x1={0} x2={w} y1={toY(threshold.critical)} y2={toY(threshold.critical)} stroke={ZONE_COLOR.critical} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.85} />
              </>
            )}

            {variant === 'bar' ? (
              <>
                {bars.map((b, i) => (
                  <rect
                    key={i}
                    x={b.x}
                    y={b.y}
                    width={barW}
                    height={b.h}
                    fill={`url(#${gradientId})`}
                    opacity={hover.index === null || hover.index === i ? 1 : 0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <rect x={bars[bars.length - 1].x} y={bars[bars.length - 1].y} width={barW} height={bars[bars.length - 1].h} fill="none" stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </>
            ) : (
              <>
                <path d={area} fill={`url(#${gradientId})`} />
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={variant === 'wave' ? '2.1' : '1.6'}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {waveMarkers.map((m, i) => (
                  <g key={i}>
                    <circle cx={m.x} cy={m.y} r="3.2" fill={ZONE_COLOR[m.zone]} stroke="var(--app-panel)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <circle cx={m.x} cy={m.y} r="3.2" fill="none" stroke={ZONE_COLOR[m.zone]} vectorEffect="non-scaling-stroke">
                      <animate attributeName="r" values="3.2;7;3.2" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  </g>
                ))}
                <circle cx={ex} cy={ey} r="2.6" fill={color} />
                <circle cx={ex} cy={ey} r="2.6" fill={color} opacity={0.35}>
                  <animate attributeName="r" values="2.6;6;2.6" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {hover.index !== null && variant !== 'bar' && (
              <>
                <line
                  x1={pts[hover.index][0]}
                  x2={pts[hover.index][0]}
                  y1={padTop}
                  y2={height}
                  stroke="var(--app-text-faint)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={pts[hover.index][0]} cy={pts[hover.index][1]} r="3" fill={color} stroke="var(--app-panel)" strokeWidth="1.2" />
              </>
            )}
          </svg>

          {hover.fraction !== null && hoveredValue !== undefined && hoveredValue !== null && (
            <ChartTooltip fraction={hover.fraction}>
              <span className="tnum font-semibold">
                {fmt(hoveredValue)}
                {unit ? ` ${unit}` : ''}
              </span>
              <span className="ml-1.5" style={{ color: 'var(--app-text-faint)' }}>
                {hoveredLabel ?? (secondsAgo === 0 ? 'now' : `${secondsAgo}${hoverUnit}`)}
              </span>
            </ChartTooltip>
          )}
        </div>
      </div>

      {/* X-axis: the rolling window is one sample per second */}
      <div className="flex justify-between pl-[34px] text-[8.5px]" style={{ color: 'var(--app-text-faint)' }}>
        <span>{xAxisStart ?? `−${data.length}s`}</span>
        <span>{xAxisCaption}</span>
        <span>now</span>
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
