import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { appendLive, generateWeeklySeries, type WeeklyPoint } from '../lib/weeklySeries'
import { movingAverage, stableSpan } from '../lib/smoothing'
import { smoothPath } from '../lib/smoothPath'
import { ChartTooltip, useChartHover } from './chartHover'
import { ZONE_COLOR, thresholdBands, thresholdCaption, type KpiThreshold } from '../lib/kpiThresholds'

export type DetailTone = 'ok' | 'warn' | 'crit'

/**
 * For log/event-style metrics — visitors, access events, badge scans —
 * where a trend line makes no sense (there's nothing to chart, only
 * discrete records). Details shows this table instead of the 7-day chart.
 */
export type KpiDetailList = {
  title: string
  columns: string[]
  rows: (string | number)[][]
  emptyText?: string
  /** A short caveat about what this list does/doesn't cover — shown under the table. */
  note?: string
}

const TONE_COLOR: Record<DetailTone, string> = {
  ok: 'var(--app-success)',
  warn: 'var(--app-warning)',
  crit: 'var(--app-danger)',
}
const TONE_LABEL: Record<DetailTone, string> = { ok: 'Normal', warn: 'Warning', crit: 'Critical' }
/** A short, status-driven read-out shown once the panel is actually open — moved off the card face so every tile isn't narrating its own status by default. */
const AI_SUGGESTION: Record<DetailTone, string> = {
  ok: 'Operating normally — no action needed.',
  warn: 'Trending toward the warning threshold — increase monitoring.',
  crit: 'Requires immediate attention — escalate now.',
}
/** The one purple used anywhere in the app, reserved for predictive/forecast data only, so it stays a distinct visual meaning. */
const FORECAST_COLOR = '#a78bfa'

/* ---------------------------------------------------------- 7-day chart -- */

function WeeklyChart({
  points,
  unit,
  color,
  threshold,
  forecast,
}: {
  points: WeeklyPoint[]
  unit?: string
  color: string
  threshold?: KpiThreshold
  forecast?: { h6: number; h24: number } | null
}) {
  const w = 640
  const h = 262
  const padL = 50
  const padR = 12
  const padT = 14
  const padB = 52
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const gradientId = `wc-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  // The last stretch of the plot is reserved for the forecast continuation,
  // so the 7 days of real history and the projected values never overlap.
  const historyW = forecast ? plotW * 0.8 : plotW
  const forecastW = plotW - historyW

  const values = points.map((p) => p.v)
  const smoothed = movingAverage(values, 5)
  const rawSpan = stableSpan(Math.min(...smoothed), Math.max(...smoothed))
  const forecastVals = forecast ? [forecast.h6, forecast.h24] : []
  const domainMin = Math.min(rawSpan.min, ...forecastVals)
  const domainMax = Math.max(rawSpan.max, ...forecastVals)
  const { min, max } = threshold ? thresholdBands(threshold, domainMin, domainMax) : { min: domainMin, max: domainMax }
  const span = max - min || 1
  const yTicks = [max, min + span * 0.5, min]
  const hover = useChartHover(points.length)
  const toY = (v: number) => padT + plotH - ((v - min) / span) * plotH

  const pts = smoothed.map((v, i) => {
    const x = padL + (i / (smoothed.length - 1)) * historyW
    return [x, toY(v)] as const
  })
  const path = smoothPath(pts)
  // A constant-thickness ribbon under the line rather than a fill down to
  // the axis floor — otherwise a value near the top of a threshold-expanded
  // domain paints almost the whole chart solid.
  const fadeDistance = Math.min(plotH * 0.4, 48)
  const offsetPts = pts.map(([x, y]) => [x, Math.min(padT + plotH, y + fadeDistance)] as const)
  const ribbonReturn = smoothPath([...offsetPts].reverse()).replace(/^M[\d.,-]+/, '')
  const area = `${path} L${offsetPts[offsetPts.length - 1][0]},${offsetPts[offsetPts.length - 1][1]}${ribbonReturn} Z`
  const [ex, ey] = pts[pts.length - 1]

  const forecastPts = forecast
    ? ([
        [ex, ey],
        [padL + historyW + forecastW * 0.4, toY(forecast.h6)],
        [padL + historyW + forecastW, toY(forecast.h24)],
      ] as const)
    : null

  // One label per day boundary, using the real calendar date each point represents.
  const dayLabels: { x: number; text: string }[] = []
  for (let d = 0; d <= 7; d++) {
    const idx = Math.min(points.length - 1, d * 24)
    const date = new Date(points[idx].t)
    dayLabels.push({
      x: padL + (idx / (points.length - 1)) * historyW,
      text: d === 7 ? 'now' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    })
  }

  // The hovered readout uses the raw sample so the number matches what the
  // simulation recorded, not the smoothed line drawn over it.
  const hoveredPoint = hover.index !== null ? points[hover.index] : null
  const hoveredPt = hover.index !== null ? pts[hover.index] : null

  const bands = threshold ? thresholdBands(threshold, domainMin, domainMax).bands : null

  // How settled the last 24h of readings have been — used to give the
  // forecast tooltip an honest confidence read rather than a bare number.
  const recentWindow = smoothed.slice(-24)
  const recentMean = recentWindow.reduce((a, b) => a + b, 0) / recentWindow.length
  const recentStdDev = Math.sqrt(recentWindow.reduce((a, b) => a + (b - recentMean) ** 2, 0) / recentWindow.length)
  const volatilityPct = recentMean !== 0 ? (recentStdDev / Math.abs(recentMean)) * 100 : 0
  const confidence = volatilityPct < 5 ? 'High' : volatilityPct < 15 ? 'Moderate' : 'Low'

  // Hovering the purple segment interpolates along the two forecast legs
  // (now→6h, 6h→24h) to report exactly what's projected at that point in
  // time, plus how it was derived — not just a static end value.
  const forecastStartX = padL + historyW
  const forecastHover =
    forecast && hover.fraction !== null && hover.fraction * w > forecastStartX
      ? (() => {
          const hoverX = hover.fraction! * w
          const r = Math.min(1, Math.max(0, (hoverX - forecastStartX) / forecastW))
          const lastReal = smoothed[smoothed.length - 1]
          const atSixSplit = 0.4
          const hoursAhead = r <= atSixSplit ? (r / atSixSplit) * 6 : 6 + ((r - atSixSplit) / (1 - atSixSplit)) * 18
          const value = r <= atSixSplit ? lastReal + (r / atSixSplit) * (forecast.h6 - lastReal) : forecast.h6 + ((r - atSixSplit) / (1 - atSixSplit)) * (forecast.h24 - forecast.h6)
          return { x: forecastStartX + r * forecastW, y: toY(value), hoursAhead, value }
        })()
      : null

  return (
    <div className="relative" {...hover.bind}>
      {forecastHover ? (
        <ChartTooltip fraction={forecastHover.x / w}>
          <div className="flex flex-col gap-1 py-0.5" style={{ minWidth: 190 }}>
            <div className="flex items-baseline gap-1.5">
              <span style={{ color: FORECAST_COLOR }} className="font-semibold">
                +{forecastHover.hoursAhead.toFixed(1)}h
              </span>
              <span className="tnum font-semibold">
                ≈ {forecastHover.value.toFixed(1)}
                {unit ? ` ${unit}` : ''}
              </span>
            </div>
            <span style={{ color: 'var(--app-text-faint)' }}>Linear trend fit to the last 24h of readings</span>
            <span style={{ color: 'var(--app-text-faint)' }}>
              Confidence: <span style={{ color: confidence === 'High' ? 'var(--app-success)' : confidence === 'Moderate' ? 'var(--app-warning)' : 'var(--app-danger)' }}>{confidence}</span>{' '}
              (recent variability ±{volatilityPct.toFixed(0)}%)
            </span>
            <span className="italic" style={{ color: 'var(--app-text-faint)' }}>
              Projection only — not a guarantee
            </span>
          </div>
        </ChartTooltip>
      ) : (
        hover.fraction !== null &&
        hoveredPoint && (
          <ChartTooltip fraction={hover.fraction}>
            <span className="tnum font-semibold">
              {hoveredPoint.v.toFixed(1)}
              {unit ? ` ${unit}` : ''}
            </span>
            <span className="ml-1.5" style={{ color: 'var(--app-text-faint)' }}>
              {new Date(hoveredPoint.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })}
            </span>
          </ChartTooltip>
        )
      )}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="7-day historical trend" className="block">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {bands &&
          bands.map((b) => (
            <rect
              key={b.zone}
              x={padL}
              width={plotW}
              y={Math.min(toY(b.from), toY(b.to))}
              height={Math.abs(toY(b.to) - toY(b.from))}
              fill={ZONE_COLOR[b.zone]}
              opacity={0.07}
            />
          ))}

        {yTicks.map((t, i) => {
          const y = padT + (i / (yTicks.length - 1)) * plotH
          return (
            <g key={i}>
              <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="var(--app-border)" strokeWidth={1} />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--app-text-faint)">
                {t.toFixed(1)}
              </text>
            </g>
          )
        })}

        {threshold && (
          <>
            <g>
              <line x1={padL} x2={padL + plotW} y1={toY(threshold.warning)} y2={toY(threshold.warning)} stroke={ZONE_COLOR.warning} strokeWidth={1} strokeDasharray="5 3" opacity={0.85} />
              <text x={padL + plotW - 2} y={toY(threshold.warning) - 3} textAnchor="end" fontSize="9" fill={ZONE_COLOR.warning}>
                Warning {threshold.warning}
                {threshold.unit ?? unit ?? ''}
              </text>
            </g>
            <g>
              <line x1={padL} x2={padL + plotW} y1={toY(threshold.critical)} y2={toY(threshold.critical)} stroke={ZONE_COLOR.critical} strokeWidth={1} strokeDasharray="5 3" opacity={0.85} />
              <text x={padL + plotW - 2} y={toY(threshold.critical) - 3} textAnchor="end" fontSize="9" fill={ZONE_COLOR.critical}>
                Critical {threshold.critical}
                {threshold.unit ?? unit ?? ''}
              </text>
            </g>
          </>
        )}

        <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="var(--app-border)" strokeWidth={1} />
        <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="var(--app-border)" strokeWidth={1} />

        {/* divider between real history and the projected continuation */}
        {forecast && <line x1={padL + historyW} x2={padL + historyW} y1={padT} y2={padT + plotH} stroke="var(--app-border)" strokeWidth={1} strokeDasharray="2 3" />}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <circle cx={ex} cy={ey} r={3.2} fill={color} />
        <circle cx={ex} cy={ey} r={3.2} fill={color} opacity={0.4}>
          <animate attributeName="r" values="3.2;7;3.2" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Predictive continuation — the one purple line in the app, drawn
            dashed so it reads unmistakably as projected, not measured. */}
        {forecastPts && (
          <>
            <path
              d={`M${forecastPts[0][0]},${forecastPts[0][1]} L${forecastPts[1][0]},${forecastPts[1][1]} L${forecastPts[2][0]},${forecastPts[2][1]}`}
              fill="none"
              stroke={FORECAST_COLOR}
              strokeWidth={1.8}
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
            <circle cx={forecastPts[1][0]} cy={forecastPts[1][1]} r={2.6} fill={FORECAST_COLOR} />
            <circle cx={forecastPts[2][0]} cy={forecastPts[2][1]} r={3} fill={FORECAST_COLOR} stroke="var(--app-panel)" strokeWidth={1} />
            <text x={forecastPts[2][0]} y={padT + 10} textAnchor="end" fontSize="9" fill={FORECAST_COLOR} letterSpacing="0.04em">
              FORECAST
            </text>
          </>
        )}

        {dayLabels.map((d, i) => (
          <text key={i} x={d.x} y={h - 30} textAnchor={i === 0 ? 'start' : i === dayLabels.length - 1 ? 'end' : 'middle'} fontSize="9.5" fill="var(--app-text-faint)">
            {d.text}
          </text>
        ))}
        {forecastHover ? (
          <>
            <line x1={forecastHover.x} x2={forecastHover.x} y1={padT} y2={padT + plotH} stroke={FORECAST_COLOR} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
            <circle cx={forecastHover.x} cy={forecastHover.y} r={4} fill={FORECAST_COLOR} stroke="var(--app-panel)" strokeWidth={1.5} />
          </>
        ) : (
          hoveredPt && (
            <>
              <line x1={hoveredPt[0]} x2={hoveredPt[0]} y1={padT} y2={padT + plotH} stroke="var(--app-text-faint)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={hoveredPt[0]} cy={hoveredPt[1]} r={4} fill={color} stroke="var(--app-panel)" strokeWidth={1.5} />
            </>
          )
        )}

        {/* axis titles */}
        <text x={14} y={padT + plotH / 2} textAnchor="middle" fontSize="9.5" fill="var(--app-text-faint)" transform={`rotate(-90 14 ${padT + plotH / 2})`}>
          {unit ?? 'value'}
        </text>
        <text x={padL + plotW / 2} y={h - 10} textAnchor="middle" fontSize="9" fill="var(--app-text-faint)" letterSpacing="0.06em">
          DATE (LAST 7 DAYS{forecast ? ' + 24H FORECAST' : ''})
        </text>
      </svg>
    </div>
  )
}

/* ---------------------------------------------------- computed narrative -- */

function computeStats(values: number[]) {
  const first = values[0]
  const last = values[values.length - 1]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const deltaPct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0
  return { first, last, min, max, mean, deltaPct }
}

function forecastNext(values: number[], hours: number) {
  // Simple linear regression over the most recent day of samples.
  const recent = values.slice(-24)
  const n = recent.length
  const xs = recent.map((_, i) => i)
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = recent.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (recent[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  return yMean + slope * (n - 1 + hours)
}

/**
 * Why the AI Forecast points the way it does — fit to the identical
 * last-24-hour window forecastNext() regresses over, so "why is it going
 * down" always matches the line actually drawn, not a separate guess.
 */
function explainForecast(values: number[]) {
  const recent = values.slice(-24)
  const n = recent.length
  const xMean = (n - 1) / 2
  const yMean = recent.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (recent[i] - yMean)
    den += (i - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const residuals = recent.map((v, i) => v - (yMean + slope * (i - xMean)))
  const rmse = Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / n)
  const volatilityPct = yMean !== 0 ? (rmse / Math.abs(yMean)) * 100 : 0
  const confidence: 'High' | 'Moderate' | 'Low' = volatilityPct < 3 ? 'High' : volatilityPct < 10 ? 'Moderate' : 'Low'
  const trendWord = Math.abs(slope) < Math.max(Math.abs(yMean) * 0.001, 1e-6) ? 'holding steady' : slope > 0 ? 'climbing' : 'declining'
  return { trendWord, confidence, volatilityPct }
}

export function KpiDetailPanel({
  label,
  value,
  unit,
  description,
  tone,
  liveValue,
  threshold,
  detailList,
  roadmap: roadmapProp,
  onClose,
}: {
  label: string
  value: string | number
  unit?: string
  description: string
  tone: DetailTone
  /** Current numeric value, or null if this metric isn't numeric (can't be charted). */
  liveValue: number | null
  /** Warning/critical threshold for this metric, if it has one — drives the chart bands and the caption under the header. */
  threshold?: KpiThreshold
  /** Event/log-style metrics show this itemized table instead of the trend chart. */
  detailList?: KpiDetailList
  /** Overrides the Recommended Roadmap. Pass [] to hide the section entirely when no generic next-step applies. */
  roadmap?: string[]
  onClose: () => void
}) {
  const [series, setSeries] = useState<WeeklyPoint[] | null>(() =>
    liveValue === null ? null : generateWeeklySeries(label, liveValue),
  )

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  // Live tail: each time the real value ticks, roll it onto the end of the
  // bootstrapped week rather than regenerating the whole series.
  useEffect(() => {
    if (liveValue === null) return
    setSeries((prev) => (prev ? appendLive(prev, liveValue) : generateWeeklySeries(label, liveValue)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveValue])

  const color = TONE_COLOR[tone]
  const values = series?.map((p) => p.v) ?? []
  const stats = values.length ? computeStats(values) : null
  const forecast6h = values.length >= 24 ? forecastNext(values, 6) : null
  const forecast24h = values.length >= 24 ? forecastNext(values, 24) : null
  const forecast = forecast6h !== null && forecast24h !== null ? { h6: forecast6h, h24: forecast24h } : null

  const insights: string[] = []

  if (stats) {
    const volatility = (stats.max - stats.min) / (Math.abs(stats.mean) || 1)
    insights.push(
      volatility > 0.15
        ? `More variable than usual this week. The range from low to high is ${(volatility * 100).toFixed(0)}% of the average value.`
        : `Steady week overall. The range from low to high stayed within ${(volatility * 100).toFixed(0)}% of the average value.`,
    )
    insights.push(
      stats.deltaPct > 2
        ? `Trending upward, up ${stats.deltaPct.toFixed(1)}% compared to 7 days ago.`
        : stats.deltaPct < -2
          ? `Trending downward, down ${Math.abs(stats.deltaPct).toFixed(1)}% compared to 7 days ago.`
          : `Little net change over the week, within ${Math.abs(stats.deltaPct).toFixed(1)}% of where it was 7 days ago.`,
    )
    insights.push(`Weekly range: ${stats.min.toFixed(1)} to ${stats.max.toFixed(1)}${unit ? ` ${unit}` : ''}, averaging ${stats.mean.toFixed(1)}.`)
  } else if (!detailList) {
    insights.push(`${label} does not carry a numeric history, so it's shown as a status rather than a trend.`)
  }

  // Why the forecast points the way it does — fit to the same last-24-hour
  // window forecastNext() itself regresses over, so the explanation always
  // matches the line actually drawn, not a separately-computed guess.
  const forecastBasis = forecast ? explainForecast(values) : null

  // A generic escalate/monitor/routine roadmap only makes sense for a
  // metric that's actually numeric and trend-driven — for a status field
  // ("Up to date", "Normal") or a log/event list, it's just noise.
  const defaultRoadmap: string[] =
    liveValue === null || detailList
      ? []
      : tone === 'crit'
        ? ['Escalate to the shift supervisor immediately.', 'Open a corrective work order and assign an owner.', 'Re-check this metric within the hour and log the outcome.']
        : tone === 'warn'
          ? ['Increase monitoring frequency for this metric this shift.', 'Prepare a corrective action in case the trend continues.', 'Note it at the next shift handover.']
          : ['Continue routine monitoring, no action required.', 'Re-check at the next scheduled review.', 'No handover note needed unless status changes.']
  const roadmap = roadmapProp ?? defaultRoadmap

  return createPortal(
    <div className="fixed inset-0 z-[1000]" onClick={onClose} aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <div
        className="kpi-side-panel animate-slide-in-right"
        style={{
          position: 'fixed',
          top: 'var(--app-header-h)',
          right: 0,
          bottom: 0,
          width: 'min(480px, 100vw)',
          background: 'var(--app-panel)',
          borderLeft: '1px solid var(--app-border)',
          boxShadow: 'var(--app-shadow-lg)',
          overflowY: 'auto',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${label} details`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--app-border)', position: 'sticky', top: 0, background: 'var(--app-panel)', zIndex: 1 }}>
          <div className="min-w-0">
            <p className="label">{label}</p>
            <div className="tnum mt-1 flex items-baseline gap-1.5">
              <span className="text-[26px] font-bold leading-none" style={{ color }}>
                {value}
              </span>
              {unit && (
                <span className="text-[12px]" style={{ color: 'var(--app-text-faint)' }}>
                  {unit}
                </span>
              )}
            </div>
            <span className="status-chip mt-2" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)`, borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}>
              {TONE_LABEL[tone]}
            </span>
            {threshold && (
              <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                {thresholdCaption(threshold)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
            {description}{' '}
            {stats &&
              !detailList &&
              `Currently ${stats.last.toFixed(1)}${unit ? ` ${unit}` : ''}, versus a 7-day average of ${stats.mean.toFixed(1)}.`}
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-[12px] font-medium leading-relaxed" style={{ color }}>
            <span className="flex-shrink-0" aria-hidden="true">
              ✦
            </span>
            <span>{AI_SUGGESTION[tone]}</span>
          </p>

          {detailList ? (
            <DetailListSection list={detailList} />
          ) : (
            <>
              <p className="label mb-2 mt-5">7-Day Historical Trend</p>
              {series ? (
                <>
                  <div className="kpi-modal-card" style={{ padding: '10px 10px 4px' }}>
                    <WeeklyChart points={series} unit={unit} color={color} threshold={threshold} forecast={forecast} />
                  </div>
                  {stats && (
                    <p className="mt-2 text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
                      {stats.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(stats.deltaPct).toFixed(1)}% vs 7 days ago · weekly range{' '}
                      {stats.min.toFixed(1)} to {stats.max.toFixed(1)}
                      {unit ? ` ${unit}` : ''}
                    </p>
                  )}
                  {forecast && (
                    <p className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: FORECAST_COLOR }}>
                      <span className="inline-block h-0.5 w-3" style={{ background: FORECAST_COLOR }} />
                      Purple line: projected values, not measured — hover it for how it was predicted
                    </p>
                  )}
                </>
              ) : (
                <div className="kpi-modal-card flex h-[120px] items-center justify-center text-[12px]" style={{ color: 'var(--app-text-faint)' }}>
                  No numeric history available for this metric.
                </div>
              )}

              <p className="label mb-2 mt-5">Operational Insights</p>
              <ul className="flex flex-col gap-1.5">
                {insights.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                    <span aria-hidden="true" style={{ color: 'var(--app-accent)' }}>
                      •
                    </span>
                    {s}
                  </li>
                ))}
              </ul>

              <p className="label mb-2 mt-5">AI Forecast</p>
              <div className="flex items-start gap-2.5 rounded-lg p-3" style={{ background: 'var(--app-advisory-panel)', color: '#fef9ef' }}>
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <p className="text-[12px] leading-relaxed">
                  {forecast && forecastBasis ? (
                    <>
                      Projected to reach <b className="tnum">{forecast.h6.toFixed(1)}</b>
                      {unit ? ` ${unit}` : ''} in 6 hours and <b className="tnum">{forecast.h24.toFixed(1)}</b>
                      {unit ? ` ${unit}` : ''} by this time tomorrow, based on the last 24 hours of readings — shown as the purple
                      dashed line on the chart above.{' '}
                      <b>Why:</b> the last 24 hours have been {forecastBasis.trendWord}, so the line simply extends that same
                      pace forward — it isn't reacting to any single event, just the recent average rate of change. Confidence:{' '}
                      <b style={{ color: forecastBasis.confidence === 'High' ? '#8ef0a8' : forecastBasis.confidence === 'Moderate' ? '#fbd989' : '#f5a3a3' }}>
                        {forecastBasis.confidence}
                      </b>{' '}
                      (±{forecastBasis.volatilityPct.toFixed(1)}% recent variability). This is a simple trend projection, not a
                      guarantee — a shift-change, equipment event or corrective action would move it off this line.
                    </>
                  ) : (
                    'Not enough numeric history to project a forecast for this metric.'
                  )}
                </p>
              </div>
            </>
          )}

          {roadmap.length > 0 && (
            <>
              <p className="label mb-2 mt-5">Recommended Roadmap</p>
              <ol className="flex flex-col gap-1.5">
                {roadmap.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                    <span className="tnum font-semibold" style={{ color }}>
                      {i + 1}.
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function DetailListSection({ list }: { list: KpiDetailList }) {
  return (
    <>
      <p className="label mb-2 mt-5">{list.title}</p>
      {list.rows.length === 0 ? (
        <div className="kpi-modal-card flex h-[100px] items-center justify-center px-4 text-center text-[12px]" style={{ color: 'var(--app-text-faint)' }}>
          {list.emptyText ?? 'No records in the current window.'}
        </div>
      ) : (
        <div className="kpi-modal-card overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                {list.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < list.rows.length - 1 ? '1px solid var(--app-border)' : undefined }}>
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? 'px-3 py-2 font-medium' : 'tnum px-3 py-2'} style={{ color: j === 0 ? 'var(--app-text)' : 'var(--app-text-muted)' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.note && (
        <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: 'var(--app-text-faint)' }}>
          {list.note}
        </p>
      )}
    </>
  )
}
