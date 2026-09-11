import { useId } from 'react'
import { movingAverage, stableSpan } from '../lib/smoothing'
import { ChartTooltip, useChartHover } from './chartHover'
import { smoothPath } from '../lib/smoothPath'
import { ZONE_COLOR, thresholdBands, type KpiThreshold } from '../lib/kpiThresholds'
import { computeForecast, MIN_FORECAST_SAMPLES } from '../lib/trendForecast'

/** The one purple used anywhere in the app, reserved for predictive/forecast data only. */
const FORECAST_COLOR = '#a78bfa'

/**
 * A short-horizon companion to TrendChart: takes the same 90-second rolling
 * window, fits a simple linear trend to the most recent samples, and draws
 * that projection as a dashed purple continuation past "now" — plus a
 * plain-language line underneath explaining what's projected and why,
 * so the forecast is never just a line with no stated basis.
 */
export function PredictiveTrendChart({
  data,
  label,
  unit,
  color = 'var(--app-accent)',
  formatter,
  height = 108,
  threshold,
  /** How many samples ahead to project — in whatever unit `unitLabel` names (seconds, minutes, ...). */
  forecastSteps = 20,
  /** How many of the most recent samples the trend is fit to. */
  sampleWindow = 30,
  /** Short unit suffix for the sample/forecast axis text — 's' for raw ticks, 'm' for minute buckets, etc. Defaults to seconds for callers that haven't migrated to bucketed data. */
  unitLabel = 's',
  /** Point labels (e.g. wall-clock times), same length/order as `data` — when given, the hover tooltip shows the real label for that point instead of "Nx ago". */
  pointLabels,
  /** 'line' (default) is the smoothed area/line trace; 'bar' draws measured history as columns, forecast stays a dashed line. */
  variant = 'line',
  /** When given, the whole card becomes clickable (plus a "why?" link next to the forecast line) — opens a fuller explanation of the trend and forecast. Receives the same computed forecast the chart itself drew, so the explanation can never disagree with what's on screen. */
  onExplain,
}: {
  data: number[]
  label: string
  unit?: string
  color?: string
  formatter?: (v: number) => string
  height?: number
  threshold?: KpiThreshold
  forecastSteps?: number
  sampleWindow?: number
  unitLabel?: string
  pointLabels?: string[]
  variant?: 'line' | 'bar'
  onExplain?: (forecast: ReturnType<typeof computeForecast>) => void
}) {
  const current = data.length ? data[data.length - 1] : 0
  const w = 300
  const padTop = 10
  const padBottom = 4
  const gradientId = `ptc-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const hover = useChartHover(data.length)

  // Only the plot itself needs at least two points — the regression below
  // already degrades gracefully to however much history is actually
  // available (data.slice(-sampleWindow) just returns what exists), so
  // there's no reason to hide the whole chart behind a 30s warm-up: the
  // live line should be visible immediately, same as TrendChart, and the
  // forecast simply gets more confident as samples accumulate.
  if (data.length < 2) {
    return (
      <div className="flex flex-col gap-2 px-3.5 py-3">
        <ChartHeader label={label} unit={unit} value={current} formatter={formatter} color={color} />
        <div className="flex h-[108px] items-center justify-center text-center text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
          Accumulating samples…
        </div>
      </div>
    )
  }

  const fmt = (v: number) => (formatter ? formatter(v) : v.toFixed(1))

  // See src/lib/trendForecast.ts — shared with any page that wants to
  // explain this same forecast in a click-through summary, so the chart
  // and the explanation never disagree.
  const forecast = computeForecast(data, forecastSteps, sampleWindow)
  const { forecastValue, trendWord, confidence, hasEnoughSamples: hasEnoughForForecast } = forecast

  const smoothed = movingAverage(data, 5)
  const rawSpan = stableSpan(Math.min(...smoothed, forecastValue), Math.max(...smoothed, forecastValue))
  const { min, max } = threshold ? thresholdBands(threshold, rawSpan.min, rawSpan.max) : rawSpan
  const span = max - min || 1
  const usableH = height - padTop - padBottom
  const toY = (v: number) => padTop + usableH - ((v - min) / span) * usableH

  // Reserve the last quarter of the plot width for the forecast segment —
  // but only once there's actually a trustworthy forecast to draw there;
  // otherwise the history gets the full width instead of an empty gap.
  const historyW = hasEnoughForForecast ? w * 0.76 : w
  const forecastW = w - historyW

  const pts = smoothed.map((v, i) => [(i / (smoothed.length - 1)) * historyW, toY(v)] as const)
  const path = smoothPath(pts)
  // A constant-thickness ribbon under the line rather than a fill down to
  // the axis floor — see TrendChart for why.
  const fadeDistance = Math.min(usableH * 0.45, 40)
  const offsetPts = pts.map(([x, y]) => [x, Math.min(height, y + fadeDistance)] as const)
  const ribbonReturn = smoothPath([...offsetPts].reverse()).replace(/^M[\d.,-]+/, '')
  const area = `${path} L${offsetPts[offsetPts.length - 1][0]},${offsetPts[offsetPts.length - 1][1]}${ribbonReturn} Z`
  const [ex, ey] = pts[pts.length - 1]
  const fx = historyW + forecastW
  const fy = toY(forecastValue)

  // Column geometry for the bar variant, confined to the history portion.
  const baselineY = padTop + usableH
  const barSlot = historyW / smoothed.length
  const barGap = Math.min(1.2, barSlot * 0.22)
  const barW = Math.max(0.6, barSlot - barGap)
  const bars = smoothed.map((v, i) => {
    const x = i * barSlot + barGap / 2
    const y = toY(v)
    return { x, y, h: Math.max(0, baselineY - y) }
  })

  const hoveredValue = hover.index !== null ? data[hover.index] : null
  const stepsAgo = hover.index !== null ? data.length - 1 - hover.index : 0
  const hoveredLabel = hover.index !== null ? pointLabels?.[hover.index] : undefined

  return (
    <div
      className="flex flex-col gap-1.5 px-3.5 py-3"
      style={onExplain ? { cursor: 'pointer' } : undefined}
      onClick={onExplain ? () => onExplain(forecast) : undefined}
      role={onExplain ? 'button' : undefined}
      tabIndex={onExplain ? 0 : undefined}
    >
      <ChartHeader label={label} unit={unit} value={current} formatter={formatter} color={color} />

      <div className="flex gap-1.5">
        <div className="flex flex-shrink-0 items-stretch gap-1">
          <span className="label self-center whitespace-nowrap text-[8px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.06em' }}>
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
                <stop offset="0%" stopColor={color} stopOpacity={0.32} />
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

            {hasEnoughForForecast && (
              /* divider between measured history and the projected continuation */
              <line x1={historyW} x2={historyW} y1={padTop} y2={height} stroke="var(--app-border)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            )}

            {variant === 'bar' ? (
              bars.map((b, i) => (
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
              ))
            ) : (
              <>
                <path d={area} fill={`url(#${gradientId})`} />
                <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={ex} cy={ey} r="2.6" fill={color} />
              </>
            )}

            {hasEnoughForForecast && (
              <>
                {/* the one purple line in the app — drawn dashed so it reads unmistakably as projected, not measured */}
                <path d={`M${ex},${ey} L${fx},${fy}`} fill="none" stroke={FORECAST_COLOR} strokeWidth="1.6" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                <circle cx={fx} cy={fy} r="3" fill={FORECAST_COLOR} stroke="var(--app-panel)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <text x={fx} y={padTop + 8} textAnchor="end" fontSize="8" fill={FORECAST_COLOR} letterSpacing="0.04em">
                  +{forecastSteps}{unitLabel}
                </text>
              </>
            )}

            {hover.index !== null && variant === 'line' && pts[hover.index] && (
              <>
                <line x1={pts[hover.index][0]} x2={pts[hover.index][0]} y1={padTop} y2={height} stroke="var(--app-text-faint)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                <circle cx={pts[hover.index][0]} cy={pts[hover.index][1]} r="3" fill={color} stroke="var(--app-panel)" strokeWidth="1.2" />
              </>
            )}
          </svg>

          {hover.fraction !== null && hoveredValue !== undefined && hoveredValue !== null && hover.index !== null && hover.index < smoothed.length && (
            <ChartTooltip fraction={(hover.fraction * historyW) / w}>
              <span className="tnum font-semibold">
                {fmt(hoveredValue)}
                {unit ? ` ${unit}` : ''}
              </span>
              <span className="ml-1.5" style={{ color: 'var(--app-text-faint)' }}>
                {hoveredLabel ?? (stepsAgo === 0 ? 'now' : `${stepsAgo}${unitLabel} ago`)}
              </span>
            </ChartTooltip>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 pl-[34px] text-[8.5px]" style={{ color: 'var(--app-text-faint)' }}>
        <span>{pointLabels?.[0] ?? `−${sampleWindow}${unitLabel}`} → now</span>
        {threshold && (
          <span className="flex items-center gap-2.5">
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-2" style={{ background: ZONE_COLOR.warning }} />
              {threshold.warning}
              {threshold.unit ?? unit ?? ''}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-2" style={{ background: ZONE_COLOR.critical }} />
              {threshold.critical}
              {threshold.unit ?? unit ?? ''}
            </span>
          </span>
        )}
        {hasEnoughForForecast && <span style={{ color: FORECAST_COLOR }}>+{forecastSteps}{unitLabel}</span>}
      </div>

      <p className="mt-1 truncate pl-[34px] text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
        {hasEnoughForForecast ? (
          <>
            <span style={{ color: FORECAST_COLOR }}>●</span> {fmt(forecastValue)}
            {unit ? ` ${unit}` : ''} in {forecastSteps}
            {unitLabel} · {trendWord} ·{' '}
            <span style={{ color: confidence === 'High' ? 'var(--app-success)' : confidence === 'Moderate' ? 'var(--app-warning)' : 'var(--app-danger)' }}>
              {confidence.toLowerCase()} confidence
            </span>
            {onExplain && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onExplain(forecast)
                }}
                className="ml-1.5 font-semibold underline"
                style={{ color: 'var(--app-text-faint)' }}
              >
                why?
              </button>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1.5" style={{ color: 'var(--app-text-faint)' }}>
            <span className="flex items-center gap-0.5" aria-hidden="true">
              {Array.from({ length: MIN_FORECAST_SAMPLES }).map((_, i) => (
                <span
                  key={i}
                  className="inline-block rounded-full"
                  style={{ width: 4, height: 4, background: i < data.length ? color : 'var(--app-border)' }}
                />
              ))}
            </span>
            Building forecast baseline — {data.length}/{MIN_FORECAST_SAMPLES} readings collected.
          </span>
        )}
      </p>
    </div>
  )
}

function ChartHeader({ label, unit, value, formatter, color }: { label: string; unit?: string; value: number; formatter?: (v: number) => string; color: string }) {
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
