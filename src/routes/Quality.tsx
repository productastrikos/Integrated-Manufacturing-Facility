import { useSearchParams } from 'react-router-dom'
import { ICONS, Icon, KpiTile, LiveBadge, Panel, StateChip } from '../components/ui'
import { TrendChart } from '../components/TrendChart'
import { ViewInTwin } from '../components/ViewInTwin'
import { HighlightTarget } from '../components/HighlightTarget'
import { KPI_THRESHOLDS } from '../lib/kpiThresholds'
import { summarizeQuality } from '../lib/qualityIntelligence'
import { useSimulation } from '../simulation/useSimulation'
import { useSiteMetricSeries, useSiteMetricLabels } from '../lib/siteMetricHistory'

export default function Quality() {
  const state = useSimulation()
  const { lines, kpis } = state
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('attn')

  const qualitySeries = useSiteMetricSeries('qualityPct')
  const defectSeries = qualitySeries.map((v) => 100 - v)
  const healthSeries = useSiteMetricSeries('equipmentHealthScore')
  const metricLabels = useSiteMetricLabels()

  const { qualityRatePct: avgQuality, defectRatePct: defectRate, rejectionRatePct: rejectionRate, firstPassYieldPct: firstPassYield, nonConformingLines, runningLines: running } = summarizeQuality(lines, kpis)

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Quality</h1>
          <p className="page-subtitle">Generic quality metrics derived from live production data. Applies across any manufacturing process.</p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile
            icon={<Icon d={ICONS.shield} />}
            label="Quality Score"
            value={avgQuality.toFixed(1)}
            unit="%"
            description="Average share of output meeting specification across running lines."
            threshold={KPI_THRESHOLDS.quality}
          />
          <KpiTile icon={<Icon d={ICONS.alert} />} label="Defect Rate" value={defectRate.toFixed(2)} unit="%" tone={defectRate > 5 ? 'warn' : 'ok'} description="Share of output not meeting quality specification." />
          <KpiTile icon={<Icon d={ICONS.ban} />} label="Rejection Rate" value={rejectionRate.toFixed(2)} unit="%" tone={rejectionRate > 3 ? 'warn' : 'ok'} description="Share of output rejected before dispatch." />
          <KpiTile icon={<Icon d={ICONS.clipboard} />} label="Inspection Completion" value="100" unit="%" description="Share of scheduled in-line inspections completed this shift." />
          <KpiTile
            icon={<Icon d={ICONS.flag} />}
            label="Non-Conformances"
            value={nonConformingLines.length}
            tone={running.some((l) => l.qualityPct < 90) ? 'crit' : running.some((l) => l.qualityPct < 95) ? 'warn' : 'ok'}
            description="Production lines currently below the 95% quality threshold."
          />
          <KpiTile icon={<Icon d={ICONS.target} />} label="First Pass Yield" value={firstPassYield.toFixed(1)} unit="%" tone={firstPassYield < 95 ? 'warn' : 'ok'} description="Share of units produced right the first time, no rework." />
        </div>
      </section>

      <section>
        <p className="label mb-3">Quality by Production Line</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lines.map((l) => (
            <HighlightTarget key={l.id} active={highlightId === l.id} className="glass-panel flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
                  {l.name}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <StateChip status={l.status} />
                  <span className="tnum text-[11.5px]" style={{ color: l.qualityPct < 95 ? 'var(--app-warning)' : 'var(--app-text-muted)' }}>
                    {l.qualityPct.toFixed(1)}% quality
                  </span>
                </div>
              </div>
              <ViewInTwin kind="line" id={l.id} label="Twin" />
            </HighlightTarget>
          ))}
        </div>
      </section>

      <Panel label="Trends" action={<span className="label">last 4h</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          <TrendChart
            label="Quality Trend"
            unit="%"
            data={qualitySeries}
            pointLabels={metricLabels}
            xAxisCaption="time (last 4h)"
            xAxisStart={metricLabels[0] ?? '−4h'}
            color="var(--app-success)"
            threshold={KPI_THRESHOLDS.quality}
          />
          <TrendChart
            label="Defect Trend"
            unit="%"
            data={defectSeries}
            pointLabels={metricLabels}
            xAxisCaption="time (last 4h)"
            xAxisStart={metricLabels[0] ?? '−4h'}
            color="var(--app-warning)"
            formatter={(v) => v.toFixed(2)}
            threshold={KPI_THRESHOLDS.defectRate}
          />
          <TrendChart
            label="Equipment Health"
            unit="/ 100"
            data={healthSeries}
            pointLabels={metricLabels}
            xAxisCaption="time (last 4h)"
            xAxisStart={metricLabels[0] ?? '−4h'}
            color="var(--app-accent)"
            threshold={KPI_THRESHOLDS.equipmentHealth}
          />
        </div>
      </Panel>
    </div>
  )
}
