import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ICONS, Icon, KpiTile, LiveBadge, Meter, Panel, StateChip } from '../components/ui'
import { PredictiveTrendChart } from '../components/PredictiveTrendChart'
import { TrendExplainModal, type TrendExplainData } from '../components/TrendExplainModal'
import { ScenarioKpiPreview } from '../components/ScenarioKpiPreview'
import { buildExplainData, type ForecastResult } from '../lib/trendForecast'
import { AttentionBanner } from '../components/AttentionBanner'
import { buildAttentionFeed, type AttentionEntry } from '../lib/attentionFeed'
import { KPI_THRESHOLDS, thresholdZone } from '../lib/kpiThresholds'
import { materialStatus, procurementRequired, stockCoverDays, summarizeInventory } from '../lib/materialsIntelligence'
import { summarizeQuality } from '../lib/qualityIntelligence'
import { safetySeverity } from '../lib/safetyDetails'
import { useSiteMetricSeries, useSiteMetricLabels } from '../lib/siteMetricHistory'
import { bindingOeeConstraint } from '../lib/productionIntelligence'
import { twinLink } from '../twin/focusLink'
import { useSimulation } from '../simulation/useSimulation'
import type { Equipment, Material, ProductionLine } from '../simulation/types'

/**
 * Executive Overview — Manufacturing Operations Command Center.
 *
 * Visual hierarchy is deliberate and matches the plant floor's own
 * priorities: production and equipment are what the facility exists to
 * run, so they get the largest panels and the first position on the page.
 * Materials and Quality are what production depends on directly, so they
 * come next. Energy, safety and building services are real and important,
 * but they support production rather than define it — they sit lower and
 * read as compact secondary panels rather than full-size KPI cards.
 *
 * Nothing on this page is independently computed. Every number is read
 * from the same `useSimulation()` snapshot every other module reads, and
 * every derived figure (materials health, quality rate, safety severity)
 * calls the exact shared function the owning module itself calls — so a
 * value here can never disagree with what that module shows when you
 * click through to it.
 */
export default function ExecutiveOverview() {
  const state = useSimulation()
  const navigate = useNavigate()
  const { kpis, energy, bms, safetySecurity, safetyExtra, security, history } = state
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())

  const prev = history.length > 5 ? history[history.length - 6] : null
  const healthTrend = prev ? kpis.equipmentHealthScore - prev.equipmentHealthScore : 0

  // Read once here and pass down, rather than each KPI tile and each
  // secondary widget independently calling the same summary function —
  // one input, one pure function, one place a shortage or a quality dip
  // actually gets computed.
  const materialsSummary = summarizeInventory(state.materials.materials)
  const qualitySummary = summarizeQuality(state.lines, kpis)

  // 1-minute-bucketed series for the Trends panel — real minutes over up to
  // 4 hours, not 90 raw ticks (see src/lib/siteMetricHistory.ts).
  const productionSeries = useSiteMetricSeries('productionRatePerMin')
  const oeeSeries = useSiteMetricSeries('oeePct')
  const energySeries = useSiteMetricSeries('energyDemandMw')
  const healthSeries = useSiteMetricSeries('equipmentHealthScore')
  const downtimeSeries = useSiteMetricSeries('downtimeMinutes')
  const alertSeries = useSiteMetricSeries('criticalAlerts')
  const metricLabels = useSiteMetricLabels()
  const safetyStatus = safetySeverity(safetySecurity, safetyExtra)
  const worstMaterial = procurementRequired(state.materials.materials)[0] ?? null
  const delayedShipments = state.materials.inboundShipments.filter((s) => s.status === 'delayed')
  const camerasOnline = security.cameras.filter((c) => c.status === 'online').length

  const attentionFeed = buildAttentionFeed(state).filter((a) => !acknowledged.has(a.id))
  const [lineDrilldownOpen, setLineDrilldownOpen] = useState(false)
  const [explainData, setExplainData] = useState<TrendExplainData | null>(null)

  // Real, state-derived reasons a Trends chart might be moving the way it
  // is — shown alongside the statistical basis in the click-through
  // explainer, not instead of it. Left undefined where nothing in live
  // state explains the direction better than "this is what the recent
  // readings did" — inventing a cause here would be exactly the kind of
  // disconnected data this app avoids everywhere else.
  const degradedLines = state.lines.filter((l) => l.status === 'warning' || l.status === 'critical')
  const stoppedLines = state.lines.filter((l) => l.status === 'critical' || l.status === 'offline')
  const worstEquipment = Object.values(state.equipment)
    .filter((e) => e.status === 'warning' || e.status === 'critical')
    .sort((a, b) => a.health - b.health)
    .slice(0, 3)
  const oeeConstraint = bindingOeeConstraint(kpis)

  function explain(label: string, unit: string | undefined, series: number[], forecast: ForecastResult, unitLabel: string, causeText?: string) {
    setExplainData(buildExplainData(label, unit, series, forecast, 6, unitLabel, causeText))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Executive Overview</h1>
          <p className="page-subtitle">
            Factory Health <span className="tnum font-semibold" style={{ color: 'var(--app-text)' }}>{kpis.systemHealthPct.toFixed(0)}%</span> — production,
            equipment, materials and quality across the facility.
          </p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      {/* --------------------------------------------------------- attention feed -- */}
      <AttentionBanner
        entries={attentionFeed}
        onOpen={(a) => navigate(a.attnId ? `/app/${a.modulePath}?attn=${encodeURIComponent(a.attnId)}` : `/app/${a.modulePath}`)}
        onOpenTwin={(a) => navigate(twinLink(a.twinKind, a.twinId))}
        onAcknowledge={(id) => setAcknowledged((s) => new Set(s).add(id))}
      />

      {/* ===================================================== PRIMARY: factory core KPIs === */}
      <section>
        <p className="label mb-3">Factory Core KPIs</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative">
            <KpiTile
              icon={<Icon d={ICONS.gauge} />}
              label="OEE"
              value={kpis.oeePct.toFixed(1)}
              unit="%"
              subValues={[
                { label: 'A', value: kpis.oeeAvailabilityPct.toFixed(0) },
                { label: 'P', value: kpis.oeePerformancePct.toFixed(0) },
                { label: 'Q', value: kpis.oeeQualityPct.toFixed(0) },
              ]}
              description="Overall Equipment Effectiveness: Availability × Performance × Quality, the standard composite measure of how well production is running."
              threshold={KPI_THRESHOLDS.oee}
            />
            <ScenarioKpiPreview module="production" kpiLabel="Achievement" />
          </div>
          <div className="relative">
            <KpiTile
              icon={<Icon d={ICONS.output} />}
              label="Production Output"
              value={kpis.outputUnits.toLocaleString()}
              unit="units"
              progress={{ value: kpis.outputUnits, target: kpis.targetUnits, unit: 'units' }}
              description="Total units produced across all production lines this session, measured against the site's shift target."
            />
            <ScenarioKpiPreview module="production" />
          </div>
          <div className="relative">
            <KpiTile
              icon={<Icon d={ICONS.shield} />}
              label="Equipment Health"
              value={kpis.equipmentHealthScore.toFixed(0)}
              unit="%"
              sub={`${kpis.equipmentRunning} running`}
              description="Average condition score across all equipment, weighted by how much attention each asset currently needs."
              threshold={KPI_THRESHOLDS.equipmentHealth}
            />
            <ScenarioKpiPreview module="equipment" />
          </div>
          <div className="relative">
            <KpiTile
              icon={<Icon d={ICONS.box} />}
              label="Material Availability"
              value={materialsSummary.healthPct.toFixed(0)}
              unit="%"
              sub={`${materialsSummary.procurementRequiredCount} need procurement`}
              tone={materialsSummary.critical + materialsSummary.outOfStock > 0 ? 'crit' : materialsSummary.low > 0 ? 'warn' : 'ok'}
              description="Share of tracked materials that are healthy or overstocked — not low, critical or out of stock."
            />
            <ScenarioKpiPreview module="materials" />
          </div>
          <div className="relative">
            <KpiTile
              icon={<Icon d={ICONS.shield} />}
              label="Quality Rate"
              value={qualitySummary.qualityRatePct.toFixed(1)}
              unit="%"
              description="Average share of output meeting specification across currently running lines."
              threshold={KPI_THRESHOLDS.quality}
            />
            <ScenarioKpiPreview module="quality" />
          </div>
          <div className="relative">
            <KpiTile
              icon={<Icon d={ICONS.target} />}
              label="Target Achievement"
              value={kpis.achievementPct.toFixed(1)}
              unit="%"
              description="Production output as a percentage of the shift target. Below 70% is flagged for review."
              threshold={KPI_THRESHOLDS.achievement}
            />
            <ScenarioKpiPreview module="production" kpiLabel="Achievement" />
          </div>
        </div>
      </section>

      {/* ===================================================== PRIMARY: production + equipment === */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
        {/* --------------------------------------------------- production status -- */}
        <section className="flex flex-col">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="label">Production Status</p>
            <button onClick={() => setLineDrilldownOpen(true)} className="text-[10.5px] font-bold" style={{ color: 'var(--app-info)', letterSpacing: '0.05em' }}>
              VIEW ALL LINES →
            </button>
          </div>
          <div className="glass-panel flex flex-1 flex-col gap-4 p-4">
            <div className="tnum grid grid-cols-3 gap-3 sm:grid-cols-6">
              <Stat label="Target" value={kpis.targetUnits.toLocaleString()} unit="units" />
              <Stat label="Actual" value={Math.round(kpis.outputUnits).toLocaleString()} unit="units" />
              <Stat label="Achievement" value={kpis.achievementPct.toFixed(1)} unit="%" tone={thresholdZone(kpis.achievementPct, KPI_THRESHOLDS.achievement)} />
              <Stat label="Efficiency" value={kpis.efficiencyPct.toFixed(1)} unit="%" tone={thresholdZone(kpis.efficiencyPct, KPI_THRESHOLDS.efficiency)} />
              <Stat label="Downtime" value={kpis.downtimeMinutes.toFixed(0)} unit="min" />
              <Stat label="Active Lines" value={`${kpis.linesRunning}/${kpis.linesTotal}`} />
            </div>

            <div className="flex flex-col" style={{ borderTop: '1px solid var(--app-border)' }}>
              {state.lines.map((l) => (
                <ProductionLineRow key={l.id} state={state} line={l} onOpen={() => navigate('/app/operations')} />
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- equipment status -- */}
        <section className="flex flex-col">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="label">Equipment Status</p>
            <button onClick={() => navigate('/app/maintenance')} className="text-[10.5px] font-bold" style={{ color: 'var(--app-info)', letterSpacing: '0.05em' }}>
              VIEW MAINTENANCE →
            </button>
          </div>
          <div className="glass-panel flex flex-1 flex-col gap-4 p-4">
            <div className="tnum grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Running" value={kpis.equipmentRunning} tone="normal" />
              <Stat label="Idle" value={kpis.equipmentIdle} />
              <Stat label="Maintenance" value={kpis.equipmentMaintenance} tone={kpis.equipmentMaintenance > 0 ? 'warning' : 'normal'} />
              <Stat label="Critical" value={kpis.equipmentWarning + kpis.equipmentFaultOffline} tone={kpis.equipmentWarning + kpis.equipmentFaultOffline > 0 ? 'critical' : 'normal'} />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="label">Requires Attention</span>
                <span className="tnum text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                  {kpis.equipmentHealthScore.toFixed(1)} / 100 avg health
                </span>
              </div>
              <EquipmentIssuesList state={state} onOpen={(id) => navigate(`/app/maintenance?attn=${id}`)} />
            </div>

            <div className="mt-auto">
              <div className="flex items-baseline justify-between">
                <span className="label">Equipment Health Score</span>
                <span className="tnum text-[12px] font-medium" style={{ color: healthTrend >= 0 ? 'var(--app-success)' : 'var(--app-warning)' }}>
                  {kpis.equipmentHealthScore.toFixed(1)} / 100
                </span>
              </div>
              <div className="mt-2">
                <Meter value={kpis.equipmentHealthScore} max={100} tone={kpis.equipmentHealthScore < 75 ? 'var(--app-warning)' : 'var(--app-success)'} />
              </div>
            </div>
          </div>
        </section>
      </div>

      {lineDrilldownOpen && <ActiveLinesDrilldown state={state} onClose={() => setLineDrilldownOpen(false)} onOpenTwin={(id) => navigate(twinLink('line', id))} />}

      {/* --------------------------------------------------- live operational feed -- */}
      <LiveOperationalFeed state={state} attentionFeed={attentionFeed} navigate={navigate} />

      {/* ===================================================== SECONDARY: materials + quality === */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MaterialsHealthWidget
          summary={materialsSummary}
          worstMaterial={worstMaterial}
          incoming={state.materials.openDeliveries}
          delayed={delayedShipments.length}
          onOpen={() => navigate('/app/materials')}
        />
        <QualityHealthWidget summary={qualitySummary} onOpen={() => navigate('/app/quality')} />
      </div>

      {/* ===================================================== TERTIARY: energy + safety/security === */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel label="Energy & Utilities" action={<button onClick={() => navigate('/app/bms')} className="text-[10px] font-bold" style={{ color: 'var(--app-info)' }}>VIEW BMS →</button>}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-4 sm:grid-cols-3">
            <StatRow label="Consumption" value={`${energy.consumptionMwh.toFixed(2)} MWh`} />
            <StatRow label="Current Demand" value={`${energy.currentDemandMw.toFixed(2)} MW`} tone={thresholdZone(energy.currentDemandMw, KPI_THRESHOLDS.energyDemand)} />
            <StatRow label="Energy Intensity" value={`${energy.intensityMwhPerKUnit.toFixed(2)} MWh/1,000u`} />
            <StatRow label="Energy Efficiency" value={`${energy.efficiencyPct.toFixed(1)}%`} tone={thresholdZone(energy.efficiencyPct, KPI_THRESHOLDS.energyEfficiency)} />
            <StatRow label="HVAC Status" value={bms.hvacStatus} tone={bms.hvacStatus === 'Normal' ? 'normal' : 'warning'} />
            <StatRow label="Building Energy" value={`${bms.buildingEnergyKw.toFixed(0)} kW`} tone={thresholdZone(bms.buildingEnergyKw, KPI_THRESHOLDS.buildingEnergy)} />
          </div>
        </Panel>

        <Panel
          label="Safety & Security"
          action={
            <button onClick={() => navigate('/app/safety-security')} className="text-[10px] font-bold" style={{ color: 'var(--app-info)' }}>
              VIEW ALL →
            </button>
          }
        >
          <div className="flex flex-col gap-3 p-4">
            {safetyStatus !== 'ok' && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{
                  background: safetyStatus === 'crit' ? 'var(--app-danger-bg)' : 'var(--app-warning-bg)',
                  border: `1px solid ${safetyStatus === 'crit' ? 'var(--app-danger-border)' : 'var(--app-warning-border)'}`,
                }}
              >
                <span aria-hidden="true" style={{ color: safetyStatus === 'crit' ? 'var(--app-danger)' : 'var(--app-warning)' }}>
                  {safetyStatus === 'crit' ? '◆' : '△'}
                </span>
                <span className="text-[11.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
                  {safetyStatus === 'crit'
                    ? `${safetySecurity.activeSafetyIncidents} active safety incident${safetySecurity.activeSafetyIncidents === 1 ? '' : 's'} on site`
                    : `${safetySecurity.nearMisses} near miss${safetySecurity.nearMisses === 1 ? '' : 'es'} logged this session`}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <StatRow label="Safety Incidents" value={safetySecurity.activeSafetyIncidents} tone={safetySecurity.activeSafetyIncidents > 0 ? 'critical' : 'normal'} />
              <StatRow label="Near Misses" value={safetySecurity.nearMisses} tone={safetySecurity.nearMisses > 0 ? 'warning' : 'normal'} />
              <StatRow label="Access Violations" value={safetySecurity.accessViolations} tone={safetySecurity.accessViolations > 0 ? 'critical' : 'normal'} />
              <StatRow label="Security Events" value={safetySecurity.securityEvents.toLocaleString()} />
              <StatRow label="CCTV Online" value={`${camerasOnline}/${security.cameras.length}`} tone={camerasOnline < security.cameras.length ? 'warning' : 'normal'} />
              <StatRow label="Gate Activity" value={security.gateActivityCount} />
            </div>
          </div>
        </Panel>
      </div>

      {/* ------------------------------------------------------------ charts -- */}
      <Panel label="Trends — Live Telemetry" action={<span className="label">+6min projection</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <PredictiveTrendChart
              label="Production Trend"
              unit="units/min"
              data={productionSeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              color="var(--app-accent)"
              onExplain={(f) =>
                explain(
                  'Production Trend',
                  'units/min',
                  productionSeries,
                  f,
                  'm',
                  f.trendWord === 'trending downward' && degradedLines.length > 0
                    ? `${degradedLines.map((l) => l.name).join(', ')} ${degradedLines.length === 1 ? 'is' : 'are'} running degraded, pulling the site-wide rate down.`
                    : undefined,
                )
              }
            />
            <ScenarioKpiPreview module="production" />
          </div>
          <div className="relative">
            <PredictiveTrendChart
              label="OEE Trend"
              unit="%"
              data={oeeSeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              color="var(--app-success)"
              threshold={KPI_THRESHOLDS.oee}
              onExplain={(f) => explain('OEE Trend', '%', oeeSeries, f, 'm', f.trendWord !== 'holding steady' ? `${oeeConstraint.label}.` : undefined)}
            />
            <ScenarioKpiPreview module="production" kpiLabel="Achievement" />
          </div>
          <div className="relative">
            <PredictiveTrendChart
              label="Energy Consumption"
              unit="MW"
              data={energySeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              color="var(--app-warning)"
              formatter={(v) => v.toFixed(2)}
              threshold={KPI_THRESHOLDS.energyDemand}
              onExplain={(f) => explain('Energy Consumption', 'MW', energySeries, f, 'm')}
            />
            <ScenarioKpiPreview module="utilities" />
          </div>
          <div className="relative">
            <PredictiveTrendChart
              label="Equipment Health"
              unit="/ 100"
              data={healthSeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              color="var(--app-accent)"
              threshold={KPI_THRESHOLDS.equipmentHealth}
              onExplain={(f) =>
                explain(
                  'Equipment Health',
                  '/ 100',
                  healthSeries,
                  f,
                  'm',
                  f.trendWord === 'trending downward' && worstEquipment.length > 0
                    ? `${worstEquipment.map((e) => `${e.id} (${e.health.toFixed(0)}/100)`).join(', ')} ${worstEquipment.length === 1 ? 'is' : 'are'} dragging the site average down.`
                    : undefined,
                )
              }
            />
            <ScenarioKpiPreview module="equipment" />
          </div>
          <div className="relative">
            <PredictiveTrendChart
              label="Downtime"
              unit="min"
              data={downtimeSeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              color="var(--app-danger)"
              formatter={(v) => v.toFixed(1)}
              threshold={KPI_THRESHOLDS.downtime}
              onExplain={(f) =>
                explain(
                  'Downtime',
                  'min',
                  downtimeSeries,
                  f,
                  'm',
                  stoppedLines.length > 0 ? `${stoppedLines.map((l) => l.name).join(', ')} ${stoppedLines.length === 1 ? 'is' : 'are'} currently stopped.` : undefined,
                )
              }
            />
            <ScenarioKpiPreview module="production" />
          </div>
          <div className="relative">
            <PredictiveTrendChart
              label="Alert Trend"
              unit="critical"
              data={alertSeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              color="var(--app-danger)"
              formatter={(v) => v.toFixed(0)}
              onExplain={(f) =>
                explain(
                  'Alert Trend',
                  'critical',
                  alertSeries,
                  f,
                  'm',
                  worstEquipment.some((e) => e.status === 'critical')
                    ? `${worstEquipment.filter((e) => e.status === 'critical').map((e) => e.id).join(', ')} currently in a critical fault state.`
                    : undefined,
                )
              }
              threshold={KPI_THRESHOLDS.criticalAlerts}
            />
            <ScenarioKpiPreview module="equipment" />
          </div>
        </div>
      </Panel>

      {explainData && <TrendExplainModal data={explainData} onClose={() => setExplainData(null)} />}
    </div>
  )
}

/* ---------------------------------------------------------------- small stat -- */

/** A single number-with-label used inside the Production Status and Equipment Status header rows. */
function Stat({ label, value, unit, tone }: { label: string; value: string | number; unit?: string; tone?: 'normal' | 'warning' | 'critical' }) {
  const color = tone === 'critical' ? 'var(--app-danger)' : tone === 'warning' ? 'var(--app-warning)' : 'var(--app-text)'
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label">{label}</span>
      <span className="text-[15px] font-semibold leading-tight" style={{ color }}>
        {value}
        {unit && (
          <span className="ml-1 text-[10.5px] font-normal" style={{ color: 'var(--app-text-faint)' }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

/** A compact label/value row for the tertiary Energy & Utilities / Safety & Security panels — deliberately plainer than a KpiTile so these panels read as secondary. */
function StatRow({ label, value, tone }: { label: string; value: string | number; tone?: 'normal' | 'warning' | 'critical' }) {
  const color = tone === 'critical' ? 'var(--app-danger)' : tone === 'warning' ? 'var(--app-warning)' : 'var(--app-text)'
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
        {label}
      </span>
      <span className="tnum text-[13px] font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

/* --------------------------------------------------------- production line row -- */

const LINE_STATUS_GLYPH: Record<ProductionLine['status'], string> = {
  running: '●',
  idle: '○',
  warning: '△',
  critical: '◆',
  maintenance: '◇',
  offline: '◆',
}

/**
 * One compact row per production line — status, OEE, output vs target, and
 * a flag for whichever real issue (equipment or material) is actually
 * affecting it, derived live rather than stored. Clicking opens the
 * existing Production & Operations module, which already carries the full
 * per-line detail this row only summarizes.
 */
function ProductionLineRow({ state, line, onOpen }: { state: ReturnType<typeof useSimulation>; line: ProductionLine; onOpen: () => void }) {
  const oee = (line.availabilityPct / 100) * (line.performancePct / 100) * (line.qualityPct / 100) * 100
  const lineEquipment = line.equipmentIds.map((id) => state.equipment[id]).filter((e): e is Equipment => !!e)
  const equipmentIssue = [...lineEquipment].sort((a, b) => a.health - b.health).find((e) => e.status !== 'running' && e.status !== 'idle')
  const materialIssue = state.materials.materials
    .filter((m) => m.productionLines.includes(line.id) && materialStatus(m) !== 'healthy' && materialStatus(m) !== 'overstock')
    .sort((a, b) => stockCoverDays(a) - stockCoverDays(b))[0]

  const statusColor =
    line.status === 'running'
      ? 'var(--app-success)'
      : line.status === 'warning'
        ? 'var(--app-warning)'
        : line.status === 'critical' || line.status === 'offline'
          ? 'var(--app-danger)'
          : 'var(--app-text-faint)'

  return (
    <button onClick={onOpen} className="flex w-full items-center gap-2.5 px-1 py-2 text-left" style={{ borderBottom: '1px solid var(--app-border)' }}>
      <span className="w-14 shrink-0 text-[11px] font-semibold" style={{ color: 'var(--app-text)' }}>
        {line.id.replace('LINE-', 'L').replace('PACK-', 'P').replace('PROC-', 'PR')}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[10.5px] font-bold uppercase" style={{ color: statusColor, letterSpacing: '0.04em' }}>
        <span aria-hidden="true">{LINE_STATUS_GLYPH[line.status]}</span>
        {line.status}
      </span>
      <span className="tnum shrink-0 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
        OEE {oee.toFixed(0)}%
      </span>
      <span className="tnum hidden shrink-0 text-[11px] sm:inline" style={{ color: 'var(--app-text-faint)' }}>
        {Math.round(line.outputUnits).toLocaleString()}/{line.targetUnits.toLocaleString()}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
        {equipmentIssue && (
          <span style={{ color: equipmentIssue.status === 'critical' || equipmentIssue.status === 'offline' ? 'var(--app-danger)' : 'var(--app-warning)' }}>
            ⚙ {equipmentIssue.id} {equipmentIssue.status}
          </span>
        )}
        {equipmentIssue && materialIssue && ' · '}
        {materialIssue && (
          <span style={{ color: materialStatus(materialIssue) === 'out_of_stock' || materialStatus(materialIssue) === 'critical' ? 'var(--app-danger)' : 'var(--app-warning)' }}>
            ▥ {materialIssue.name} low
          </span>
        )}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------- equipment issues -- */

/**
 * The most important assets on the floor right now — warning or critical,
 * worst health first — with the line each one affects, so "which equipment
 * is unhealthy and does it matter" is answered in one glance rather than
 * requiring a detour to Maintenance.
 */
function EquipmentIssuesList({ state, onOpen }: { state: ReturnType<typeof useSimulation>; onOpen: (equipmentId: string) => void }) {
  const issues = Object.values(state.equipment)
    .filter((e) => e.status === 'critical' || e.status === 'warning' || e.status === 'offline')
    .sort((a, b) => a.health - b.health)
    .slice(0, 4)

  if (issues.length === 0) {
    return (
      <div className="flex h-[72px] items-center justify-center text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
        No equipment currently needs attention.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {issues.map((eq) => {
        const line = state.lines.find((l) => l.id === eq.lineId)
        const color = eq.status === 'critical' || eq.status === 'offline' ? 'var(--app-danger)' : 'var(--app-warning)'
        const reason =
          eq.status === 'critical' || eq.status === 'warning'
            ? eq.scripted === 'drift-vibration'
              ? `High vibration — ${eq.vibrationMmS.toFixed(2)} mm/s`
              : eq.scripted === 'drift-temperature'
                ? `Elevated temperature — ${eq.temperatureC.toFixed(1)} °C`
                : `Health at ${eq.health.toFixed(0)}/100`
            : 'Offline'
        return (
          <button key={eq.id} onClick={() => onOpen(eq.id)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left" style={{ background: 'var(--app-surface-soft)' }}>
            <span aria-hidden="true" className="shrink-0 text-[12px]" style={{ color }}>
              {eq.status === 'warning' ? '△' : '◆'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="tnum text-[11.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
                  {eq.id}
                </span>
                <span className="text-[10px] font-bold uppercase" style={{ color, letterSpacing: '0.04em' }}>
                  {eq.status}
                </span>
              </div>
              <div className="truncate text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                {reason}
                {line && ` · ${line.name} affected`}
              </div>
            </div>
            <span className="shrink-0 text-[10px] font-bold" style={{ color: 'var(--app-info)' }}>
              VIEW →
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------- materials widget -- */

/**
 * A compact read of Materials & Logistics health, so a shortage surfaces
 * on the landing page rather than requiring a detour to notice it — the
 * same summary math the Materials module itself uses, so the number here
 * can never disagree with the module it links to. The worst material's
 * affected production lines are named explicitly, per the rule that
 * inventory is never shown isolated from the production it feeds.
 */
function MaterialsHealthWidget({
  summary,
  worstMaterial,
  incoming,
  delayed,
  onOpen,
}: {
  summary: ReturnType<typeof summarizeInventory>
  worstMaterial: Material | null
  incoming: number
  delayed: number
  onOpen: () => void
}) {
  const tone = summary.critical + summary.outOfStock > 0 ? 'var(--app-danger)' : summary.low > 0 ? 'var(--app-warning)' : 'var(--app-success)'

  return (
    <Panel label="Materials & Logistics" action={<button onClick={onOpen} className="text-[10px] font-bold" style={{ color: 'var(--app-info)' }}>VIEW MATERIALS →</button>}>
      <button onClick={onOpen} className="flex w-full flex-col gap-3 p-4 text-left">
        <div className="flex items-baseline justify-between">
          <span className="tnum text-[26px] font-bold leading-none" style={{ color: tone }}>
            {summary.healthPct.toFixed(0)}%
          </span>
          <div className="tnum flex gap-3 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            <span>{incoming} incoming</span>
            {delayed > 0 && <span style={{ color: 'var(--app-warning)' }}>{delayed} delayed</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tnum sm:grid-cols-4" style={{ color: 'var(--app-text-muted)' }}>
          <span style={{ color: 'var(--app-success)' }}>{summary.healthy} Healthy</span>
          <span style={{ color: 'var(--app-warning)' }}>{summary.low} Low</span>
          <span style={{ color: 'var(--app-danger)' }}>{summary.critical} Critical</span>
          <span style={{ color: '#c0473b' }}>{summary.outOfStock} Out of Stock</span>
        </div>
        {worstMaterial && (
          <div className="rounded-lg px-3 py-2" style={{ background: 'var(--app-surface-soft)' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[11.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
                {worstMaterial.name}
              </span>
              <span className="tnum text-[10.5px]" style={{ color: 'var(--app-warning)' }}>
                {Number.isFinite(stockCoverDays(worstMaterial)) ? `${stockCoverDays(worstMaterial).toFixed(1)}d cover` : 'no draw'}
              </span>
            </div>
            <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              {Math.round(worstMaterial.stockLevel).toLocaleString()} {worstMaterial.unit} on hand, reorder at {worstMaterial.reorderLevel.toLocaleString()}
              {worstMaterial.productionLines.length > 0 && ` — affects ${worstMaterial.productionLines.join(', ')}`}
            </div>
          </div>
        )}
      </button>
    </Panel>
  )
}

/* --------------------------------------------------------------- quality widget -- */

/**
 * Quality's secondary read — good output, defects, reject rate and first
 * pass yield — mirrors the Materials widget above. Same
 * `summarizeQuality()` the Quality module itself calls, passed down rather
 * than recomputed, so the two can't disagree.
 */
function QualityHealthWidget({ summary, onOpen }: { summary: ReturnType<typeof summarizeQuality>; onOpen: () => void }) {
  const tone = summary.qualityRatePct < 90 ? 'var(--app-danger)' : summary.qualityRatePct < 95 ? 'var(--app-warning)' : 'var(--app-success)'
  const worstLine = [...summary.nonConformingLines].sort((a, b) => a.qualityPct - b.qualityPct)[0]

  return (
    <Panel label="Quality" action={<button onClick={onOpen} className="text-[10px] font-bold" style={{ color: 'var(--app-info)' }}>VIEW QUALITY →</button>}>
      <button onClick={onOpen} className="flex w-full flex-col gap-3 p-4 text-left">
        <div className="flex items-baseline justify-between">
          <span className="tnum text-[26px] font-bold leading-none" style={{ color: tone }}>
            {summary.qualityRatePct.toFixed(1)}%
          </span>
          <Icon d={ICONS.shield} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tnum sm:grid-cols-4" style={{ color: 'var(--app-text-muted)' }}>
          <span>FPY {summary.firstPassYieldPct.toFixed(1)}%</span>
          <span>Defect {summary.defectRatePct.toFixed(1)}%</span>
          <span>Reject {summary.rejectionRatePct.toFixed(1)}%</span>
          <span style={{ color: summary.nonConformingLines.length > 0 ? 'var(--app-warning)' : undefined }}>{summary.nonConformingLines.length} Non-Conforming</span>
        </div>
        {worstLine && (
          <div className="rounded-lg px-3 py-2" style={{ background: 'var(--app-surface-soft)' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[11.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
                {worstLine.name}
              </span>
              <span className="tnum text-[10.5px]" style={{ color: 'var(--app-warning)' }}>
                {worstLine.qualityPct.toFixed(1)}% quality
              </span>
            </div>
            <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              Below the 95% quality threshold — lowest-scoring running line right now.
            </div>
          </div>
        )}
      </button>
    </Panel>
  )
}

/* --------------------------------------------------------- live operational feed -- */

type FeedItem = { id: string; at: string; severity: 'critical' | 'warning' | 'normal'; text: string; sub?: string; onOpen: () => void }

/**
 * A chronological read of what's actually happening, distinct from
 * "Requires Attention" above it: that panel is open issues to work through
 * and acknowledge, this is a live activity stream. Built from the same two
 * real, timestamped sources the rest of the page already has — current
 * attention conditions (stamped "now", since they describe live state
 * rather than a discrete past event) and the security access-event log
 * (which carries real per-event timestamps) — rather than inventing a
 * synthetic event history the simulation doesn't actually track.
 */
function LiveOperationalFeed({
  state,
  attentionFeed,
  navigate,
}: {
  state: ReturnType<typeof useSimulation>
  attentionFeed: AttentionEntry[]
  navigate: (to: string) => void
}) {
  const fromAttention: FeedItem[] = attentionFeed.slice(0, 6).map((a) => ({
    id: `attn-${a.id}`,
    at: state.lastUpdated,
    severity: a.severity === 'critical' ? 'critical' : 'warning',
    text: `${a.category} — ${a.title}`,
    sub: a.description,
    onOpen: () => navigate(a.attnId ? `/app/${a.modulePath}?attn=${encodeURIComponent(a.attnId)}` : `/app/${a.modulePath}`),
  }))

  // Routine badge-ins are noise here — only restricted events (denied,
  // tailgate) are actually operationally meaningful enough to sit
  // alongside equipment/material/safety conditions in one feed.
  const fromAccess: FeedItem[] = state.security.accessEvents
    .filter((e) => e.decision !== 'granted')
    .slice(0, 4)
    .map((e) => ({
      id: `evt-${e.id}`,
      at: e.at,
      severity: e.decision === 'tailgate' ? 'critical' : 'warning',
      text: `${e.decision === 'tailgate' ? 'Tailgate' : 'Access denied'} — ${e.person} at ${e.door}`,
      onOpen: () => navigate('/app/safety-security?tab=security'),
    }))

  const items = [...fromAttention, ...fromAccess].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)

  return (
    <Panel label="Live Operational Feed" action={<span className="label">real-time facility activity</span>}>
      {items.length === 0 ? (
        <div className="flex h-[80px] items-center justify-center text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
          No recent activity to show.
        </div>
      ) : (
        <ul>
          {items.map((item) => {
            const color = item.severity === 'critical' ? 'var(--app-danger)' : item.severity === 'warning' ? 'var(--app-warning)' : 'var(--app-success)'
            const glyph = item.severity === 'critical' ? '◆' : item.severity === 'warning' ? '△' : '●'
            return (
              <li key={item.id} style={{ borderBottom: '1px solid var(--app-border)' }}>
                <button onClick={item.onOpen} className="flex w-full items-start gap-3 px-4 py-2.5 text-left">
                  <span className="tnum shrink-0 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    {item.at}
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-[11px]" style={{ color }}>
                    {glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium" style={{ color: 'var(--app-text)' }}>
                      {item.text}
                    </div>
                    {item.sub && (
                      <div className="truncate text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                        {item.sub}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------- equipment table -- */

const EQ_STATUS_COLOR: Record<string, string> = {
  running: 'var(--app-success)',
  idle: 'var(--app-text-faint)',
  warning: 'var(--app-warning)',
  critical: 'var(--app-danger)',
  offline: 'var(--app-danger)',
  maintenance: 'var(--app-info)',
}

/* --------------------------------------------------------- active lines drilldown -- */

/**
 * The full per-line detail the compact Production Status list only
 * summarizes — output vs target, every OEE factor, downtime and the
 * equipment on the line — reached via "View All Lines" rather than
 * replacing the compact list's own click-through to Production &
 * Operations.
 */
function ActiveLinesDrilldown({ state, onClose, onOpenTwin }: { state: ReturnType<typeof useSimulation>; onClose: () => void; onOpenTwin: (id: string) => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-6" style={{ background: 'color-mix(in srgb, black 45%, transparent)' }} onClick={onClose}>
      <div
        className="kpi-modal-card mt-10 w-full max-w-3xl"
        style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', borderRadius: 12, boxShadow: 'var(--app-shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Active production lines"
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <div>
            <p className="text-[15px] font-semibold" style={{ color: 'var(--app-text)' }}>
              Production Lines
            </p>
            <p className="text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
              {state.kpis.linesRunning} of {state.kpis.linesTotal} running
            </p>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ul className="max-h-[70vh] overflow-y-auto">
          {state.lines.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StateChip status={l.status} />
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
                    {l.name}
                  </span>
                  <span className="label">{l.id}</span>
                </div>
                <button onClick={() => onOpenTwin(l.id)} className="text-[10.5px] font-medium hover:underline" style={{ color: 'var(--app-info)' }}>
                  View in Digital Twin →
                </button>
              </div>
              <div className="tnum grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] sm:grid-cols-5" style={{ color: 'var(--app-text-muted)' }}>
                <span>
                  Output {l.outputUnits.toLocaleString()} / {l.targetUnits.toLocaleString()}
                </span>
                <span>Availability {l.availabilityPct.toFixed(0)}%</span>
                <span>Performance {l.performancePct.toFixed(0)}%</span>
                <span>Quality {l.qualityPct.toFixed(1)}%</span>
                <span>Downtime {l.downtimeMinutes.toFixed(0)} min</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {l.equipmentIds.map((eqId) => {
                  const eq = state.equipment[eqId]
                  if (!eq) return null
                  return (
                    <span
                      key={eqId}
                      className="tnum font-[family-name:var(--font-mono)] text-[9.5px]"
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        color: EQ_STATUS_COLOR[eq.status],
                        border: `1px solid ${EQ_STATUS_COLOR[eq.status]}`,
                      }}
                      title={`${eq.name} — ${eq.status}`}
                    >
                      {eqId}
                    </span>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
