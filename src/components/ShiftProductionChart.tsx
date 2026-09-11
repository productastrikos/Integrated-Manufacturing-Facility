import { useId } from 'react'
import { ChartTooltip, useChartHover } from './chartHover'
import { smoothPath } from '../lib/smoothPath'
import type { ShiftProductionSeries } from '../lib/shiftProduction'

/**
 * Cumulative Target-vs-Actual production for the current shift. Unlike
 * `TrendChart`'s 90-second rolling sensor window, the X-axis here is the
 * shift clock (shift start → shift end) and the Y-axis is a cumulative
 * unit count that only goes up — so "are we ahead of or behind plan" reads
 * directly off which line sits on top at any point along the axis.
 */
export function ShiftProductionChart({ series, height = 236 }: { series: ShiftProductionSeries; height?: number }) {
  const { shift, points } = series
  const w = 300
  const padTop = 8
  const padBottom = 4
  const usableH = height - padTop - padBottom
  const gradientId = `spc-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  const maxUnits = Math.max(points[points.length - 1]?.targetUnits ?? 0, ...points.map((p) => p.actualUnits ?? 0), 1)
  const yMax = niceCeil(maxUnits)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((yMax * f) / 10) * 10)

  const shiftStartMs = shift.start.getTime()
  const shiftSpanMs = shift.end.getTime() - shiftStartMs
  const toX = (t: Date) => ((t.getTime() - shiftStartMs) / shiftSpanMs) * w
  const toY = (v: number) => padTop + usableH - (v / yMax) * usableH

  const targetPts = points.map((p) => [toX(p.time), toY(p.targetUnits)] as const)
  const actualPts = points.filter((p) => p.actualUnits !== null).map((p) => [toX(p.time), toY(p.actualUnits as number)] as const)

  const targetPath = smoothPath(targetPts)
  const actualPath = smoothPath(actualPts)
  const lastActual = actualPts[actualPts.length - 1]
  const lastActualPoint = points.filter((p) => p.actualUnits !== null).at(-1)
  const ahead = lastActualPoint ? lastActualPoint.actualUnits! >= lastActualPoint.targetUnits : false
  const actualColor = ahead ? 'var(--app-success)' : 'var(--app-danger)'

  // Only whole-hour marks get an X-axis label — the injected "now" point
  // sits between them and is called out with its own glowing endpoint
  // marker on the Actual line instead.
  const hourMarks = points.filter((p) => p.time.getMinutes() === 0 && p.time.getSeconds() === 0)

  const hover = useChartHover(points.length)
  const hovered = hover.index !== null ? points[hover.index] : null
  const variance = hovered && hovered.actualUnits !== null ? hovered.actualUnits - hovered.targetUnits : null
  const achievementPct = hovered && hovered.actualUnits !== null && hovered.targetUnits > 0 ? (hovered.actualUnits / hovered.targetUnits) * 100 : null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <div className="flex flex-shrink-0 items-stretch gap-1">
          <span
            className="label self-center whitespace-nowrap text-[8px]"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.06em' }}
          >
            units
          </span>
          <div className="flex flex-col-reverse justify-between py-0.5 text-right" style={{ height }}>
            {yTicks.map((v) => (
              <span key={v} className="tnum text-[8.5px] leading-none" style={{ color: 'var(--app-text-faint)' }}>
                {v.toLocaleString()}
              </span>
            ))}
          </div>
        </div>

        <div className="relative min-w-0 flex-1" {...hover.bind}>
          <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true" className="block">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={actualColor} stopOpacity={0.28} />
                <stop offset="100%" stopColor={actualColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={0} x2={w} y1={padTop + usableH * f} y2={padTop + usableH * f} stroke="var(--app-border)" strokeWidth="1" opacity={0.6} vectorEffect="non-scaling-stroke" />
            ))}
            {/* Small bottom tick marks at each hour mark, not full-height gridlines — keeps the plot area uncluttered */}
            {hourMarks.map((p) => (
              <line key={p.time.toISOString()} x1={toX(p.time)} x2={toX(p.time)} y1={height - 5} y2={height} stroke="var(--app-text-faint)" strokeWidth="1" opacity={0.5} vectorEffect="non-scaling-stroke" />
            ))}

            {/* Target — the known plan, drawn as a neutral dashed reference line */}
            <path d={targetPath} fill="none" stroke="var(--app-text-faint)" strokeWidth="1.6" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />

            {/* Actual — solid, colored green (ahead) or red (behind) vs. plan */}
            {actualPts.length > 1 && (
              <path d={`${actualPath} L${lastActual[0]},${height} L${actualPts[0][0]},${height} Z`} fill={`url(#${gradientId})`} stroke="none" />
            )}
            <path d={actualPath} fill="none" stroke={actualColor} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            {lastActual && (
              <>
                <circle cx={lastActual[0]} cy={lastActual[1]} r="3" fill={actualColor} stroke="var(--app-panel)" strokeWidth="1.2" />
                <circle cx={lastActual[0]} cy={lastActual[1]} r="3" fill={actualColor} opacity={0.35}>
                  <animate attributeName="r" values="3;7;3" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {hover.index !== null && (
              <line
                x1={toX(points[hover.index].time)}
                x2={toX(points[hover.index].time)}
                y1={padTop}
                y2={height}
                stroke="var(--app-text-faint)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {hover.fraction !== null && hovered && (
            <ChartTooltip fraction={hover.fraction}>
              <div className="flex flex-col gap-0.5">
                <span className="tnum font-semibold">{hovered.label}</span>
                <span style={{ color: 'var(--app-text-faint)' }}>
                  Target: <span className="tnum">{hovered.targetUnits.toLocaleString()}</span> units
                </span>
                {hovered.actualUnits !== null ? (
                  <>
                    <span style={{ color: 'var(--app-text-faint)' }}>
                      Actual: <span className="tnum">{hovered.actualUnits.toLocaleString()}</span> units
                    </span>
                    <span style={{ color: variance !== null && variance >= 0 ? 'var(--app-success)' : 'var(--app-danger)' }}>
                      Variance: <span className="tnum">{variance !== null && variance >= 0 ? '+' : ''}{variance?.toLocaleString()}</span> units
                    </span>
                    <span style={{ color: 'var(--app-text-faint)' }}>
                      Achievement: <span className="tnum">{achievementPct?.toFixed(1)}</span>%
                    </span>
                  </>
                ) : (
                  <span style={{ color: 'var(--app-text-faint)' }}>Not yet reached</span>
                )}
              </div>
            </ChartTooltip>
          )}
        </div>
      </div>

      <div className="flex justify-between pl-[34px] text-[8.5px]" style={{ color: 'var(--app-text-faint)' }}>
        {hourMarks.map((p) => (
          <span key={p.time.toISOString()}>{p.label}</span>
        ))}
      </div>
      <div className="pl-[34px] text-center text-[8px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
        Shift Time
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 pl-[34px] text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5" style={{ background: 'var(--app-text-faint)', opacity: 0.8 }} />
            Target
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5" style={{ background: actualColor }} />
            Actual {ahead ? '(ahead of plan)' : '(behind plan)'}
          </span>
        </span>
        <span>{shift.label} · Current Shift</span>
      </div>
    </div>
  )
}

function niceCeil(v: number): number {
  if (v <= 0) return 10
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)))
  const steps = [1, 2, 2.5, 5, 10]
  for (const s of steps) {
    const candidate = s * magnitude
    if (candidate >= v) return candidate
  }
  return 10 * magnitude
}
