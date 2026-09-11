import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { HoverTip, Icon, ICONS, KpiTile, LiveBadge, Panel } from '../components/ui'
import { TrendChart } from '../components/TrendChart'
import { ViewInTwin } from '../components/ViewInTwin'
import { ValueChainFlow } from '../components/ValueChainFlow'
import { AttentionBanner } from '../components/AttentionBanner'
import { ShiftProductionChart } from '../components/ShiftProductionChart'
import { ShiftTrendChart } from '../components/ShiftTrendChart'
import { buildShiftProductionSeries } from '../lib/shiftProduction'
import { shiftHourlyTrends } from '../lib/shiftTrends'
import { useSiteMetricSeries, useSiteMetricLabels } from '../lib/siteMetricHistory'
import { KPI_THRESHOLDS, thresholdZone } from '../lib/kpiThresholds'
import { deriveCascade } from '../lib/factoryEvents'
import { deriveWorkOrders } from '../data/deriveMaintenance'
import { buildAttentionFeed } from '../lib/attentionFeed'
import { sparePartForEquipment, sparePartStatus } from '../lib/spareParts'
import {
  bindingOeeConstraint,
  cycleTimeStats,
  downtimePareto,
  lineCycleTimeSec,
  lineOee,
  lineQualityBreakdown,
  productionLoss,
  type DowntimeCause,
} from '../lib/productionIntelligence'
import { lineRatePerMin } from '../lib/factoryEvents'
import { useSimulation } from '../simulation/useSimulation'
import type { Equipment, ProductionLine } from '../simulation/types'
import { twinLink } from '../twin/focusLink'
import { useNavigate } from 'react-router-dom'

/**
 * Production & Operations — the manufacturing command center.
 *
 * Production and equipment dominate this page by construction: they are
 * the first two sections, they get the largest panels, and everything else
 * (downtime cause, cycle time, quality-by-line, exceptions) reads directly
 * off the same `lines`/`equipment` state rather than a separate summary.
 *
 * Two categories of the original spec are deliberately not built here, and
 * are called out rather than faked: a Workforce/Shift section (no
 * operator or shift entity exists in the simulation — inventing headcounts
 * would be exactly the "disconnected random data" this app has avoided
 * everywhere else) and a Production Schedule Gantt with per-work-order
 * planned/actual timestamps (only equipment-driven maintenance work orders
 * exist; there is no production work-order entity with a real time axis to
 * chart). Every other section below is a genuine derivation of live state.
 */

const OEE_FACTOR_COLOR: Record<'availability' | 'performance' | 'quality', string> = {
  availability: 'var(--app-accent)',
  performance: 'var(--app-info)',
  quality: 'var(--app-success)',
}

const LINE_GLYPH: Record<ProductionLine['status'], string> = {
  running: '●',
  idle: '○',
  warning: '▲',
  critical: '!',
  offline: '■',
  maintenance: '◇',
}
const LINE_COLOR: Record<ProductionLine['status'], string> = {
  running: 'var(--app-success)',
  idle: 'var(--app-text-faint)',
  warning: 'var(--app-warning)',
  critical: 'var(--app-danger)',
  offline: 'var(--app-danger)',
  maintenance: 'var(--app-info)',
}

export default function Operations() {
  const state = useSimulation()
  const navigate = useNavigate()
  const { kpis, lines, history } = state

  const cycle = cycleTimeStats(lines)
  const constraint = bindingOeeConstraint(kpis)
  const pareto = downtimePareto(state)
  const scheduleAdherencePct = kpis.linesTotal > 0 ? (kpis.linesRunning / kpis.linesTotal) * 100 : 0
  const shiftSeries = buildShiftProductionSeries(state)
  const shiftTrends = shiftHourlyTrends(state)
  const oeeSeries = useSiteMetricSeries('oeePct')
  const metricLabels = useSiteMetricLabels()
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const selectedLine = selectedLineId ? lines.find((l) => l.id === selectedLineId) ?? null : null

  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const productionAttention = buildAttentionFeed(state)
    .filter((a) => a.category === 'Equipment' || a.category === 'Quality' || a.category === 'Materials')
    .filter((a) => !acknowledged.has(a.id))

  const [advisoryOpen, setAdvisoryOpen] = useState(false)
  const advisoryAtRisk = lines.some((l) => l.status === 'critical' || l.status === 'offline' || l.status === 'warning')

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------- header -- */}
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Production &amp; Operations</h1>
          <p className="page-subtitle">Real-time production execution and equipment performance across the facility.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="tnum flex items-center gap-3 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
            <span className="font-semibold" style={{ color: 'var(--app-text-muted)' }}>
              {state.site.name}
            </span>
            <span>{new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <button
            onClick={() => setAdvisoryOpen((v) => !v)}
            className="app-btn flex h-8 items-center gap-1.5 px-2.5 text-[11px]"
            style={
              advisoryAtRisk
                ? { color: 'var(--app-danger)', border: '1px solid var(--app-danger-border)', background: 'var(--app-danger-bg)' }
                : undefined
            }
            aria-label="Toggle AI Operational Advisory"
          >
            {advisoryAtRisk ? '▲' : '●'} AI Advisory
          </button>
          <LiveBadge lastUpdated={state.lastUpdated} />
        </div>
      </div>

      {advisoryOpen && <AiAdvisoryPopup state={state} onClose={() => setAdvisoryOpen(false)} />}

      {/* ==================================================== live operational exceptions == */}
      <AttentionBanner
        entries={productionAttention}
        label="Operational Exception"
        emptyTitle="No production-affecting exceptions right now"
        emptyDetail="Equipment, quality and materials conditions feeding this floor are all within range."
        onOpen={(a) => navigate(a.attnId ? `/app/${a.modulePath}?attn=${encodeURIComponent(a.attnId)}` : `/app/${a.modulePath}`)}
        onOpenTwin={(a) => navigate(twinLink(a.twinKind, a.twinId))}
        onAcknowledge={(id) => setAcknowledged((s) => new Set(s).add(id))}
      />

      {/* ==================================================== top metric strip == */}
      <section>
        <p className="label mb-3">Production &amp; Equipment KPIs</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiTile
            icon={<Icon d={ICONS.gauge} />}
            label="OEE"
            value={kpis.oeePct.toFixed(1)}
            unit="%"
            description="Overall Equipment Effectiveness: Availability × Performance × Quality, the standard composite measure of how well production is running. See the Availability, Performance and Quality tiles alongside it for the per-factor breakdown."
            threshold={KPI_THRESHOLDS.oee}
          />
          <KpiTile
            icon={<Icon d={ICONS.wrench} />}
            label="Availability"
            value={kpis.oeeAvailabilityPct.toFixed(1)}
            unit="%"
            description="Share of scheduled time the facility's lines were actually available to run, the first factor of OEE."
          />
          <KpiTile
            icon={<Icon d={ICONS.trend} />}
            label="Performance"
            value={kpis.oeePerformancePct.toFixed(1)}
            unit="%"
            description="Actual production speed against each running line's rated capacity, the second factor of OEE."
          />
          <KpiTile
            icon={<Icon d={ICONS.shield} />}
            label="Quality"
            value={kpis.oeeQualityPct.toFixed(1)}
            unit="%"
            description="Share of produced output meeting specification across currently running lines, the third factor of OEE."
            threshold={KPI_THRESHOLDS.quality}
          />
          <KpiTile
            icon={<Icon d={ICONS.trend} />}
            label="Throughput"
            value={(history.at(-1)?.productionRatePerMin ?? 0).toFixed(1)}
            unit="u/min"
            description="Live, site-wide production rate this tick — every line's output summed together."
          />
          <KpiTile
            icon={<Icon d={ICONS.output} />}
            label="Production Output"
            value={kpis.outputUnits.toLocaleString()}
            unit="units"
            progress={{ value: kpis.outputUnits, target: kpis.targetUnits, unit: 'units' }}
            description="Total units produced across all production lines this shift, measured against the shift target."
          />
          <KpiTile
            icon={<Icon d={ICONS.target} />}
            label="Target Achievement"
            value={kpis.achievementPct.toFixed(1)}
            unit="%"
            description="Production output as a percentage of the shift target. Below 70% is flagged for review."
            threshold={KPI_THRESHOLDS.achievement}
          />
          <KpiTile
            icon={<Icon d={ICONS.calendar} />}
            label="Schedule Adherence"
            value={scheduleAdherencePct.toFixed(1)}
            unit="%"
            sub={`${kpis.linesRunning} / ${kpis.linesTotal} lines running`}
            description="Share of the facility's production lines currently running, against the full line count."
            threshold={KPI_THRESHOLDS.scheduleAdherence}
          />
        </div>
      </section>

      {/* ==================================================== operational flow == */}
      <ValueChainFlow />

      {/* ==================================================== PRIMARY: OEE + factory command == */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
        {/* -------------------------------------------------- OEE decomposition -- */}
        <section className="flex flex-col">
          <p className="label mb-3">OEE Decomposition</p>
          <div className="glass-panel flex flex-1 flex-col gap-4 p-4">
            <div>
              <span className="tnum text-[36px] font-bold leading-none" style={{ color: 'var(--app-text)' }}>
                {kpis.oeePct.toFixed(1)}
              </span>
              <span className="ml-1 text-[13px]" style={{ color: 'var(--app-text-faint)' }}>
                %
              </span>
            </div>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              OEE = Availability × Performance × Quality
            </p>

            <div className="flex flex-col gap-3">
              <OeeFactorBar label="Availability" value={kpis.oeeAvailabilityPct} highlighted={constraint.factor === 'availability'} />
              <OeeFactorBar label="Performance" value={kpis.oeePerformancePct} highlighted={constraint.factor === 'performance'} />
              <OeeFactorBar label="Quality" value={kpis.oeeQualityPct} highlighted={constraint.factor === 'quality'} />
            </div>

            <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--app-warning-bg)', border: '1px solid var(--app-warning-border)' }}>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--app-warning)' }}>
                ▲ Binding constraint
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                {constraint.label}.
              </p>
            </div>

            <div>
              <p className="label mb-1.5">OEE — Trend (Last 4h)</p>
              <TrendChart
                label="OEE"
                unit="%"
                data={oeeSeries}
                pointLabels={metricLabels}
                xAxisCaption="time (last 4h)"
                xAxisStart={metricLabels[0] ?? '−4h'}
                color="var(--app-success)"
                threshold={KPI_THRESHOLDS.oee}
                height={72}
              />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------- factory production command -- */}
        <section className="flex flex-col">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="label">Factory Production Command</p>
            <span className="tnum text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              {kpis.linesRunning} / {kpis.linesTotal} running
            </span>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lines.map((l) => (
              <LineCommandCard key={l.id} line={l} onSelect={() => setSelectedLineId(l.id)} />
            ))}
          </div>
        </section>
      </div>

      {selectedLine && <LineDrilldown state={state} line={selectedLine} onClose={() => setSelectedLineId(null)} onOpenTwin={() => navigate(twinLink('line', selectedLine.id))} />}

      {/* ==================================================== production target vs actual == */}
      <Panel label="Production Target vs Actual">
        <div className="flex flex-col gap-3 p-4">
          <div className="tnum flex flex-wrap gap-x-8 gap-y-3">
            <Metric label="Target" value={kpis.targetUnits} unit="units" decimals={0} />
            <Metric label="Actual" value={kpis.outputUnits} unit="units" decimals={0} />
            <Metric label="Achievement" value={kpis.achievementPct} unit="%" tone={thresholdZone(kpis.achievementPct, KPI_THRESHOLDS.achievement)} />
            <Metric label="Current Rate" value={shiftSeries.currentRatePerMin} unit="u/min" decimals={1} />
            <Metric
              label="Projected — At Current Rate"
              value={Number.isFinite(shiftSeries.projectedMinutesToTarget) ? shiftSeries.projectedMinutesToTarget : 0}
              unit={Number.isFinite(shiftSeries.projectedMinutesToTarget) ? 'min to target' : ''}
              decimals={0}
            />
          </div>
          <ShiftProductionChart series={shiftSeries} height={236} />
        </div>
      </Panel>

      {/* ==================================================== SECONDARY: downtime + cycle time + quality == */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DowntimeParetoPanel pareto={pareto} state={state} />
        <CycleTimePanel cycle={cycle} lines={lines} />
        <QualityByLinePanel lines={lines} />
      </div>

      {/* ==================================================== live event timeline == */}
      <EventTimeline state={state} navigate={navigate} />

      {/* ==================================================== supporting trends == */}
      <Panel label="Trends" action={<span className="label">{shiftTrends.shift.label} · current shift</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <ShiftTrendChart label="Production Trend" unit="units/hr" points={shiftTrends.productionPerHour} color="var(--app-accent)" formatter={(v) => Math.round(v).toLocaleString()} />
          <ShiftTrendChart label="OEE Trend" unit="%" points={shiftTrends.oeePerHour} color="var(--app-success)" threshold={KPI_THRESHOLDS.oee} />
          <ShiftTrendChart
            label="Downtime Trend"
            unit="min/hr"
            points={shiftTrends.downtimePerHour}
            color="var(--app-danger)"
            formatter={(v) => v.toFixed(1)}
            threshold={KPI_THRESHOLDS.downtime}
          />
          <ShiftTrendChart label="Throughput Trend" unit="units/hr" points={shiftTrends.throughputPerHour} color="var(--app-info)" formatter={(v) => Math.round(v).toLocaleString()} />
        </div>
      </Panel>
    </div>
  )
}

/* ============================================================ metric strip == */

function Metric({
  label,
  value,
  target,
  unit,
  decimals = 1,
  tone,
}: {
  label: string
  value: number
  target?: number
  unit?: string
  decimals?: number
  tone?: 'normal' | 'warning' | 'critical'
}) {
  const color = tone === 'critical' ? 'var(--app-danger)' : tone === 'warning' ? 'var(--app-warning)' : 'var(--app-text)'
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
        {label}
      </span>
      <span className="tnum text-[18px] font-bold leading-none" style={{ color }}>
        {value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {unit && (
          <span className="ml-1 text-[10.5px] font-normal" style={{ color: 'var(--app-text-faint)' }}>
            {unit}
          </span>
        )}
      </span>
      {target !== undefined && (
        <span className="tnum text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
          Target {target.toLocaleString()}
        </span>
      )}
    </div>
  )
}

/**
 * Time to close the remaining gap to the shift target at the current rate.
 * The rate is a session-average (`siteRatePerMin`, shared with the shift
 * chart) rather than a single instantaneous tick, so this doesn't jump
 * around with ordinary second-to-second production noise.
 */
/* ============================================================ OEE decomposition == */

function OeeFactorBar({ label, value, highlighted }: { label: 'Availability' | 'Performance' | 'Quality'; value: number; highlighted: boolean }) {
  const key = label.toLowerCase() as 'availability' | 'performance' | 'quality'
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium" style={{ color: highlighted ? 'var(--app-warning)' : 'var(--app-text-muted)' }}>
          {highlighted ? '▲ ' : ''}
          {label}
        </span>
        <span className="tnum text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--app-border)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: highlighted ? 'var(--app-warning)' : OEE_FACTOR_COLOR[key] }} />
      </div>
    </div>
  )
}

/* ============================================================ factory production command == */

function LineCommandCard({ line, onSelect }: { line: ProductionLine; onSelect: () => void }) {
  const oee = lineOee(line)
  const glyph = LINE_GLYPH[line.status]
  const color = LINE_COLOR[line.status]

  return (
    <button onClick={onSelect} className="glass-panel flex flex-col gap-2.5 p-3.5 text-left transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
          {line.name}
        </span>
        <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase" style={{ color, letterSpacing: '0.04em' }}>
          <span aria-hidden="true">{glyph}</span>
          {line.status}
        </span>
      </div>
      <div className="tnum flex items-baseline gap-3 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
        <span>
          OEE <span style={{ color: 'var(--app-text)' }}>{oee.toFixed(0)}%</span>
        </span>
        <span>
          {Math.round(line.outputUnits).toLocaleString()} / {line.targetUnits.toLocaleString()}
        </span>
      </div>
      {line.downtimeMinutes > 0 && (
        <span className="text-[10.5px]" style={{ color: 'var(--app-danger)' }}>
          Downtime: {line.downtimeMinutes.toFixed(0)} min
        </span>
      )}
    </button>
  )
}

/* ============================================================ line drilldown == */

function LineDrilldown({
  state,
  line,
  onClose,
  onOpenTwin,
}: {
  state: ReturnType<typeof useSimulation>
  line: ProductionLine
  onClose: () => void
  onOpenTwin: () => void
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  const oee = lineOee(line)
  const loss = productionLoss(state, line)
  const cycleSec = lineCycleTimeSec(line)
  const quality = lineQualityBreakdown(line)
  const lineEquipment = line.equipmentIds.map((id) => state.equipment[id]).filter((e): e is Equipment => !!e)
  const activeAlarms = lineEquipment.filter((e) => e.status === 'critical' || e.status === 'warning' || e.status === 'offline')
  const workOrders = deriveWorkOrders(state).filter((w) => w.lineId === line.id)

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-start justify-end overflow-y-auto" style={{ background: 'color-mix(in srgb, black 45%, transparent)' }} onClick={onClose}>
      <div
        className="min-h-full w-full max-w-[440px]"
        style={{ background: 'var(--app-panel)', borderLeft: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${line.name} detail`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <div>
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase" style={{ color: LINE_COLOR[line.status], letterSpacing: '0.04em' }}>
              <span aria-hidden="true">{LINE_GLYPH[line.status]}</span>
              {line.status}
            </p>
            <p className="mt-0.5 text-[15px] font-semibold" style={{ color: 'var(--app-text)' }}>
              {line.name}
            </p>
            <p className="label mt-0.5">{line.id}</p>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          <div className="tnum grid grid-cols-3 gap-3">
            <Metric label="OEE" value={oee} unit="%" />
            <Metric label="Availability" value={line.availabilityPct} unit="%" />
            <Metric label="Performance" value={line.performancePct} unit="%" />
            <Metric label="Quality" value={line.qualityPct} unit="%" />
            <Metric label="Output" value={line.outputUnits} target={line.targetUnits} unit="units" decimals={0} />
            <Metric label="Downtime" value={line.downtimeMinutes} unit="min" tone={line.downtimeMinutes > 30 ? 'critical' : line.downtimeMinutes > 15 ? 'warning' : 'normal'} />
            <Metric label="Cycle Time" value={cycleSec} unit="s" decimals={1} />
            <Metric label="Lost Units" value={loss.lostUnits} unit="units" decimals={0} tone={loss.lostUnits > 0 ? 'warning' : 'normal'} />
            <Metric label="Target Impact" value={loss.targetImpactPct} unit="%" decimals={1} tone={loss.targetImpactPct > 2 ? 'critical' : loss.targetImpactPct > 0 ? 'warning' : 'normal'} />
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="label">Changeover / Operators</span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
              Not tracked — this simulation has no changeover-event log or operator/shift assignment entity yet.
            </p>
          </div>

          <div>
            <span className="label mb-1.5 block">Active Alarms — {activeAlarms.length}</span>
            {activeAlarms.length === 0 ? (
              <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
                No equipment on this line is currently in warning or critical state.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {activeAlarms.map((eq) => (
                  <li key={eq.id} className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: 'var(--app-surface-soft)' }}>
                    <span className="tnum text-[11.5px]" style={{ color: 'var(--app-text)' }}>
                      {eq.id}
                    </span>
                    <span className="text-[10px] font-bold uppercase" style={{ color: eq.status === 'critical' || eq.status === 'offline' ? 'var(--app-danger)' : 'var(--app-warning)' }}>
                      {eq.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <span className="label mb-1.5 block">Maintenance Work Orders — {workOrders.length}</span>
            {workOrders.length === 0 ? (
              <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
                No open maintenance work orders against this line's equipment.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {workOrders.map((w) => (
                  <li key={w.id} className="rounded-lg px-2.5 py-2" style={{ background: 'var(--app-surface-soft)' }}>
                    <div className="flex items-center justify-between">
                      <span className="tnum text-[11px]" style={{ color: 'var(--app-text)' }}>
                        {w.equipmentId}
                      </span>
                      <span className="label">{w.status}</span>
                    </div>
                    <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                      {w.description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <span className="label mb-1.5 block">Quality on This Line</span>
            <div className="tnum grid grid-cols-3 gap-3">
              <Metric label="Good" value={quality.goodUnits} unit="units" decimals={0} />
              <Metric label="Rejected" value={quality.rejectedUnits} unit="units" decimals={0} tone={quality.rejectedUnits > 0 ? 'warning' : 'normal'} />
              <Metric label="Quality" value={quality.qualityPct} unit="%" decimals={1} />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onOpenTwin} className="app-btn flex-1 h-9 text-[11.5px]">
              View in Digital Twin
            </button>
            <ViewInTwin kind="line" id={line.id} label="Twin" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ============================================================ downtime pareto == */

function DowntimeParetoPanel({ pareto, state }: { pareto: { cause: DowntimeCause; minutes: number; incidentCount: number; lines: string[] }[]; state: ReturnType<typeof useSimulation> }) {
  const totalMinutes = pareto.reduce((a, p) => a + p.minutes, 0)
  return (
    <Panel label="Downtime Pareto & Production Loss">
      <div className="flex flex-col gap-3 p-4">
        {pareto.length === 0 ? (
          <div className="flex h-[100px] flex-col items-center justify-center gap-1 text-center">
            <p className="text-[12px] font-medium" style={{ color: 'var(--app-success)' }}>
              ● No stopped-line downtime recorded this session
            </p>
            <p className="max-w-[360px] text-[11px] leading-relaxed" style={{ color: 'var(--app-text-faint)' }}>
              This tracks minutes a line has been fully stopped (critical status) — degraded-but-running lines show up in Cycle Time and Quality by Line instead. It will populate the moment any line goes critical.
            </p>
          </div>
        ) : (
          pareto.map((p) => {
            const pct = totalMinutes > 0 ? (p.minutes / totalMinutes) * 100 : 0
            const line = state.lines.find((l) => l.id === p.lines[0])
            const loss = line ? productionLoss(state, line) : null
            const lineLosses = p.lines
              .map((id) => state.lines.find((l) => l.id === id))
              .filter((l): l is ProductionLine => !!l)
              .map((l) => ({ line: l, loss: productionLoss(state, l) }))
            return (
              <div key={p.cause}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                    {p.cause}
                  </span>
                  <span className="tnum text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
                    {p.minutes.toFixed(0)} min · {p.incidentCount} line{p.incidentCount === 1 ? '' : 's'} · {pct.toFixed(0)}%
                  </span>
                </div>
                <HoverTip
                  className="block"
                  tip={
                    <div className="flex flex-col gap-1.5">
                      <p className="font-semibold" style={{ color: 'var(--app-text)' }}>
                        {p.cause} — {p.minutes.toFixed(0)} min total
                      </p>
                      {lineLosses.map(({ line: l, loss: lo }) => (
                        <p key={l.id}>
                          <span style={{ color: 'var(--app-text)' }}>{l.id}</span> — {l.downtimeMinutes.toFixed(0)} min · ~{Math.round(lo.lostUnits).toLocaleString()} units lost · {lo.targetImpactPct.toFixed(1)}% target impact
                        </p>
                      ))}
                    </div>
                  }
                >
                  <div className="h-1.5 w-full cursor-pointer overflow-hidden rounded-full" style={{ background: 'var(--app-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--app-danger)' }} />
                  </div>
                </HoverTip>
                {loss && (
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                    {p.lines.join(', ')} — ~{Math.round(loss.lostUnits).toLocaleString()} units lost, {loss.targetImpactPct.toFixed(1)}% target impact
                  </p>
                )}
              </div>
            )
          })
        )}
        <p className="mt-1 text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
          Cause is inferred from each line's actual equipment and material condition — not a logged category, since the simulation doesn't track a discrete downtime-reason field.
        </p>
      </div>
    </Panel>
  )
}

/* ============================================================ cycle time == */

function CycleTimePanel({ cycle, lines }: { cycle: ReturnType<typeof cycleTimeStats>; lines: ProductionLine[] }) {
  const running = lines.filter((l) => l.status === 'running' || l.status === 'warning')
  const maxSec = Math.max(cycle.idealSec, ...running.map((l) => lineCycleTimeSec(l)), 1)
  return (
    <Panel label="Cycle Time">
      <div className="flex flex-col gap-3 p-4">
        <div className="tnum grid grid-cols-2 gap-3">
          <Metric label="Ideal" value={cycle.idealSec} unit="s" decimals={1} />
          <Metric label="Average" value={cycle.averageSec} unit="s" decimals={1} />
          <Metric label="Current (worst)" value={cycle.currentSec} unit="s" decimals={1} tone={cycle.variancePct > 15 ? 'critical' : cycle.variancePct > 5 ? 'warning' : 'normal'} />
          <Metric label="Variance" value={cycle.variancePct} unit="%" decimals={1} tone={cycle.variancePct > 15 ? 'critical' : cycle.variancePct > 5 ? 'warning' : 'normal'} />
        </div>
        <div>
          <p className="label mb-1.5">By Line</p>
          <div className="flex flex-col gap-1.5">
            {running.map((l) => {
              const sec = lineCycleTimeSec(l)
              const varPct = ((sec - cycle.idealSec) / cycle.idealSec) * 100
              const oee = lineOee(l)
              const quality = lineQualityBreakdown(l)
              return (
                <HoverTip
                  key={l.id}
                  className="flex items-center gap-2"
                  tip={
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold" style={{ color: 'var(--app-text)' }}>
                        {l.name} ({l.id})
                      </p>
                      <p>
                        {sec.toFixed(1)}s vs {cycle.idealSec.toFixed(1)}s ideal ·{' '}
                        <span style={{ color: varPct > 15 ? 'var(--app-danger)' : varPct > 5 ? 'var(--app-warning)' : 'var(--app-success)' }}>
                          {varPct >= 0 ? '+' : ''}
                          {varPct.toFixed(1)}%
                        </span>
                      </p>
                      <p>
                        OEE {oee.toFixed(1)}% · Performance {l.performancePct.toFixed(1)}% · Quality {quality.qualityPct.toFixed(1)}%
                      </p>
                      <p style={{ color: 'var(--app-text-faint)' }}>{quality.goodUnits.toLocaleString()} good / {quality.rejectedUnits.toLocaleString()} rejected this session</p>
                    </div>
                  }
                >
                  <span className="w-14 shrink-0 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    {l.id}
                  </span>
                  <div className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full" style={{ background: 'var(--app-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(sec / maxSec) * 100}%`, background: sec > cycle.idealSec * 1.15 ? 'var(--app-warning)' : 'var(--app-accent)' }} />
                  </div>
                  <span className="tnum w-12 shrink-0 text-right text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    {sec.toFixed(1)}s
                  </span>
                </HoverTip>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
  )
}

/* ============================================================ quality by line == */

function QualityByLinePanel({ lines }: { lines: ProductionLine[] }) {
  return (
    <Panel label="Quality Within Production">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
              {['Line', 'Total', 'Good', 'Rejected', 'Quality'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const q = lineQualityBreakdown(l)
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <td className="tnum px-3 py-2" style={{ color: 'var(--app-text)' }}>
                    {l.id}
                  </td>
                  <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                    {q.totalUnits.toLocaleString()}
                  </td>
                  <td className="tnum px-3 py-2" style={{ color: 'var(--app-success)' }}>
                    {q.goodUnits.toLocaleString()}
                  </td>
                  <td className="tnum px-3 py-2" style={{ color: q.rejectedUnits > 0 ? 'var(--app-warning)' : 'var(--app-text-faint)' }}>
                    {q.rejectedUnits.toLocaleString()}
                  </td>
                  <td className="tnum px-3 py-2 font-semibold" style={{ color: q.qualityPct < 95 ? 'var(--app-warning)' : 'var(--app-text)' }}>
                    {q.qualityPct.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/* ============================================================ AI advisory == */

/**
 * The AI Operational Advisory floats above the page rather than occupying a
 * permanent panel — it is a notification, not a fixture, so it opens near
 * the top-right (right by the AI Advisory trigger button, ahead of the
 * light/dark toggle in the global header) and dismisses on Escape or an
 * outside click like any other popover.
 */
function AiAdvisoryPopup({ state, onClose }: { state: ReturnType<typeof useSimulation>; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[1000]" onClick={onClose}>
      <div
        className="absolute right-4 top-[64px] w-[min(420px,calc(100vw-2rem))]"
        style={{ boxShadow: 'var(--app-shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <AiAdvisoryPanel state={state} onClose={onClose} />
      </div>
    </div>,
    document.body,
  )
}

function AiAdvisoryPanel({ state, onClose }: { state: ReturnType<typeof useSimulation>; onClose?: () => void }) {
  const trouble = state.lines.filter((l) => l.status === 'critical' || l.status === 'offline' || l.status === 'warning').sort((a, b) => a.performancePct - b.performancePct)[0]

  if (!trouble) {
    return (
      <Panel label="AI Operational Advisory" action={onClose && <button onClick={onClose} className="icon-btn" style={{ width: 22, height: 22 }} aria-label="Close">✕</button>}>
        <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-1.5 px-4 py-6 text-center">
          <span className="text-[13px]" style={{ color: 'var(--app-text-muted)' }}>
            ● No production line currently at risk
          </span>
          <span className="text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
            All running lines are within their OEE and quality thresholds.
          </span>
        </div>
      </Panel>
    )
  }

  const worstEquipment = trouble.equipmentIds
    .map((id) => state.equipment[id])
    .filter((e): e is Equipment => !!e)
    .sort((a, b) => a.health - b.health)[0]

  const cascade = worstEquipment
    ? deriveCascade(state, { type: 'EQUIPMENT_FAILURE', equipmentId: worstEquipment.id, downtimeHours: 1 })
    : null
  const loss = productionLoss(state, trouble)
  const part = worstEquipment ? sparePartForEquipment(worstEquipment.id, worstEquipment.scripted === 'drift-vibration' ? 'vibration' : worstEquipment.scripted === 'drift-temperature' ? 'temperature' : null) : null

  return (
    <Panel label="AI Operational Advisory" action={onClose && <button onClick={onClose} className="icon-btn" style={{ width: 22, height: 22 }} aria-label="Close">✕</button>}>
      <div className="flex flex-col gap-3 p-4">
        <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)' }}>
          <p className="text-[11.5px] font-semibold" style={{ color: 'var(--app-danger)' }}>
            ▲ Production target at risk — {trouble.name}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
            {loss.downtimeMin > 0
              ? `${trouble.name} has accumulated ${loss.downtimeMin.toFixed(0)} minutes of downtime, an estimated ${Math.round(loss.lostUnits).toLocaleString()} units (${loss.targetImpactPct.toFixed(1)}% of today's target) already lost.`
              : `${trouble.name} is running degraded at ${trouble.performancePct.toFixed(0)}% performance.`}
          </p>
        </div>

        {cascade && (
          <>
            <p className="label">Recommended Actions</p>
            <ol className="flex flex-col gap-1.5 pl-4 text-[11.5px]" style={{ color: 'var(--app-text-muted)', listStyle: 'decimal' }}>
              <li>{cascade.whatShouldWeDo}</li>
              {part && sparePartStatus(part) !== 'ok' && <li>Expedite {part.name} ({part.id}) — only {part.onHand} on hand.</li>}
            </ol>

            <div className="rounded-lg px-3 py-2" style={{ background: 'var(--app-success-bg)', border: '1px solid var(--app-success-border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-success)' }}>
                Expected Recovery
              </p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
                Restoring {worstEquipment?.id} avoids roughly{' '}
                <span className="tnum font-semibold" style={{ color: 'var(--app-success)' }}>
                  {Math.round(lineRatePerMin(state, trouble.id).rate * 60).toLocaleString()} units/hour
                </span>{' '}
                of further loss on {trouble.name}.
              </p>
            </div>

            <p className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
              Computed from the same cross-module cascade engine the Simulation module uses — not a generic statement.
            </p>
          </>
        )}
      </div>
    </Panel>
  )
}

/* ============================================================ event timeline == */

const CATEGORY_FILTERS = ['All', 'Equipment', 'Quality', 'Materials', 'Safety', 'Security'] as const

function EventTimeline({ state, navigate }: { state: ReturnType<typeof useSimulation>; navigate: (to: string) => void }) {
  const [filter, setFilter] = useState<(typeof CATEGORY_FILTERS)[number]>('All')
  const entries = buildAttentionFeed(state).filter((e) => filter === 'All' || e.category === filter)

  return (
    <Panel
      label="Live Event Timeline"
      action={
        <div className="flex gap-1">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: filter === f ? 'var(--app-accent-bg)' : 'transparent',
                color: filter === f ? 'var(--app-accent)' : 'var(--app-text-faint)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      }
    >
      {entries.length === 0 ? (
        <div className="flex h-[90px] items-center justify-center text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
          No {filter === 'All' ? '' : `${filter.toLowerCase()} `}events right now.
        </div>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
              <button
                onClick={() => navigate(e.attnId ? `/app/${e.modulePath}?attn=${encodeURIComponent(e.attnId)}` : `/app/${e.modulePath}`)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <span className="tnum shrink-0 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                  {state.lastUpdated}
                </span>
                <span aria-hidden="true" className="shrink-0 text-[11px]" style={{ color: e.severity === 'critical' ? 'var(--app-danger)' : 'var(--app-warning)' }}>
                  {e.severity === 'critical' ? '!' : '▲'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--app-text)' }}>
                  {e.title} — {e.description}
                </span>
                <span className="label shrink-0">{e.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
