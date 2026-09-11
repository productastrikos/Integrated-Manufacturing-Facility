import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ICONS, Icon, KpiTile, LiveBadge, Panel } from '../components/ui'
import { TrendChart } from '../components/TrendChart'
import { PredictiveTrendChart } from '../components/PredictiveTrendChart'
import { TrendExplainModal, type TrendExplainData } from '../components/TrendExplainModal'
import { buildExplainData } from '../lib/trendForecast'
import { ViewInTwin } from '../components/ViewInTwin'
import { useSimulation } from '../simulation/useSimulation'
import { KPI_THRESHOLDS, thresholdCaption, thresholdZone } from '../lib/kpiThresholds'
import { UTILITY_INFO, type UtilityKey } from '../lib/utilityInfo'
import { useScenarioAlert } from '../simulation/scenarioAlertState'
import { ScenarioKpiPreview } from '../components/ScenarioKpiPreview'
import { useSiteMetricSeries, useSiteMetricLabels } from '../lib/siteMetricHistory'
import { useUtilityPressureHistory } from '../lib/utilityPressureHistory'

export default function BMS() {
  const state = useSimulation()
  const { bms, energy, utilities, bmsZones, bmsAssets, buildings } = state
  const scenarioAlert = useScenarioAlert()

  const buildingIds = useMemo(() => Array.from(new Set(bmsZones.map((z) => z.buildingId))), [bmsZones])
  const [selectedBuilding, setSelectedBuilding] = useState(buildingIds[0])
  const [explainData, setExplainData] = useState<TrendExplainData | null>(null)
  const zonesForBuilding = bmsZones.filter((z) => z.buildingId === selectedBuilding)
  const buildingName = buildings.find((b) => b.id === selectedBuilding)?.name ?? selectedBuilding

  const floors = Array.from(new Set(zonesForBuilding.map((z) => z.floor)))

  const [searchParams] = useSearchParams()
  const attnAssetId = searchParams.get('attn')

  const [expandedUtility, setExpandedUtility] = useState<UtilityKey | null>(null)
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null)

  // Site-wide, 1-minute-bucketed metric series — real minutes over up to 4
  // hours, not 90 raw ticks. Per-utility pressure has its own bucketed
  // cache since it's keyed by which utility, not one flat series.
  const buildingEnergySeries = useSiteMetricSeries('buildingEnergyKw')
  const energyEfficiencySeries = useSiteMetricSeries('energyEfficiencyPct')
  const energyDemandSeries = useSiteMetricSeries('energyDemandMw')
  const metricLabels = useSiteMetricLabels()

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Utilities &amp; BMS</h1>
          <p className="page-subtitle">HVAC, energy, utilities and environment: building → floor → zone → system.</p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      <section>
        <p className="label mb-3">HVAC</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <KpiTile icon={<Icon d={ICONS.thermometer} />} label="Avg Temperature" value={bms.avgTemperatureC.toFixed(1)} unit="°C" description="Average temperature across monitored zones." threshold={KPI_THRESHOLDS.avgTemperature} />
          <KpiTile icon={<Icon d={ICONS.droplet} />} label="Humidity" value={bms.humidityPct} unit="% RH" description="Average relative humidity across monitored zones." threshold={KPI_THRESHOLDS.humidity} />
          <KpiTile icon={<Icon d={ICONS.building} />} label="HVAC Status" value={bms.hvacStatus} tone={bms.hvacStatus === 'Normal' ? 'ok' : 'warn'} description="Overall status of chillers, air handlers and the zones they serve." />
          <KpiTile
            icon={<Icon d={ICONS.snowflake} />}
            label="Cooling Load"
            value={(zonesForBuilding.reduce((a, z) => a + z.coolingLoadPct, 0) / Math.max(1, zonesForBuilding.length)).toFixed(0)}
            unit="%"
            description="Average cooling load across the selected building's zones."
            threshold={KPI_THRESHOLDS.bmsLoad}
          />
          <KpiTile icon={<Icon d={ICONS.wind} />} label="Air Quality" value={bms.airQualityIndex} unit="AQI" description="Site-wide air quality index." threshold={KPI_THRESHOLDS.airQuality} />
        </div>
      </section>

      <section>
        <p className="label mb-3">Energy</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiTile icon={<Icon d={ICONS.bolt} />} label="Electricity Consumption" value={energy.consumptionMwh.toFixed(2)} unit="MWh" description="Total energy consumed across the facility this session." />
          <KpiTile icon={<Icon d={ICONS.plug} />} label="Current Demand" value={energy.currentDemandMw.toFixed(2)} unit="MW" description="Instantaneous site power draw." threshold={KPI_THRESHOLDS.energyDemand} />
          <KpiTile icon={<Icon d={ICONS.battery} />} label="Building Energy" value={bms.buildingEnergyKw.toFixed(0)} unit="kW" description="Non-production energy draw: HVAC, lighting and building services." threshold={KPI_THRESHOLDS.buildingEnergy} />
          <KpiTile icon={<Icon d={ICONS.leaf} />} label="Energy Efficiency" value={energy.efficiencyPct.toFixed(1)} unit="%" description="Ratio of useful output to total energy input." threshold={KPI_THRESHOLDS.energyEfficiency} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel label="Site Demand — Forecast" action={<span className="label">+6min projection</span>}>
            <PredictiveTrendChart
              label="Site Demand"
              unit="MW"
              data={energyDemandSeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              sampleWindow={30}
              color="var(--app-warning)"
              formatter={(v) => v.toFixed(2)}
              height={90}
              threshold={KPI_THRESHOLDS.energyDemand}
              onExplain={(f) => setExplainData(buildExplainData('Site Demand', 'MW', energyDemandSeries, f))}
            />
          </Panel>
          <Panel label="Building Energy — Forecast" action={<span className="label">+6min projection</span>}>
            <PredictiveTrendChart
              label="Building Energy"
              unit="kW"
              data={buildingEnergySeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              sampleWindow={30}
              color="var(--app-info)"
              formatter={(v) => v.toFixed(0)}
              height={90}
              threshold={KPI_THRESHOLDS.buildingEnergy}
              onExplain={(f) => setExplainData(buildExplainData('Building Energy', 'kW', buildingEnergySeries, f))}
            />
          </Panel>
          <Panel label="Energy Efficiency — Forecast" action={<span className="label">+6min projection</span>}>
            <PredictiveTrendChart
              label="Energy Efficiency"
              unit="%"
              data={energyEfficiencySeries}
              pointLabels={metricLabels}
              unitLabel="m"
              forecastSteps={6}
              sampleWindow={30}
              color="var(--app-success)"
              formatter={(v) => v.toFixed(1)}
              height={90}
              threshold={KPI_THRESHOLDS.energyEfficiency}
              onExplain={(f) => setExplainData(buildExplainData('Energy Efficiency', '%', energyEfficiencySeries, f))}
            />
          </Panel>
        </div>
      </section>

      <section>
        <p className="label mb-3">Plant Assets: HVAC, Electrical & Utilities</p>
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Asset', 'System', 'Status', 'Load', 'Temperature', 'Power', 'Speed', 'Zone Served', 'Building', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bmsAssets.map((a) => {
                  const zone = a.zoneId ? bmsZones.find((z) => z.id === a.zoneId) : null
                  const building = buildings.find((b) => b.id === a.buildingId)
                  const loadZone = thresholdZone(a.loadPct, KPI_THRESHOLDS.bmsLoad)
                  const tempZone = thresholdZone(a.temperatureC, KPI_THRESHOLDS.temperature)
                  const isAttnTarget = attnAssetId === a.id
                  return (
                    <AssetRow key={a.id} scrollTo={isAttnTarget} highlighted={isAttnTarget}>
                      <td className="px-3 py-2">
                        <div className="font-medium" style={{ color: 'var(--app-text)' }}>
                          {a.name}
                        </div>
                        <div className="tnum text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                          {a.id}
                        </div>
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {a.system}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="status-chip"
                          style={
                            a.status === 'warning'
                              ? { background: 'var(--app-warning-bg)', color: 'var(--app-warning)', borderColor: 'var(--app-warning-border)' }
                              : a.status === 'idle'
                                ? { background: 'var(--app-surface-soft)', color: 'var(--app-text-faint)', borderColor: 'var(--app-border)' }
                                : { background: 'var(--app-success-bg)', color: 'var(--app-success)', borderColor: 'var(--app-success-border)' }
                          }
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: loadZone === 'normal' ? 'var(--app-text-muted)' : loadZone === 'warning' ? 'var(--app-warning)' : 'var(--app-danger)' }}>
                        {a.loadPct.toFixed(0)}%
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: tempZone === 'normal' ? 'var(--app-text-muted)' : tempZone === 'warning' ? 'var(--app-warning)' : 'var(--app-danger)' }}>
                        {a.temperatureC.toFixed(1)}°C
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {a.powerKw > 0 ? `${a.powerKw.toFixed(0)} kW` : '—'}
                      </td>
                      <td className="tnum px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {a.speedPct > 0 ? `${a.speedPct.toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {zone?.name ?? '—'}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--app-text-muted)' }}>
                        {building?.name ?? a.buildingId}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ViewInTwin kind="bms" id={a.id} label="Twin" />
                      </td>
                    </AssetRow>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <p className="label mb-3">Utilities</p>
        <p className="mb-3 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
          Click any utility for what it feeds and its live pressure trend.
        </p>
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
          {(['water', 'gas', 'compressedAir', 'steam'] as const).map((key) => (
            <UtilityCard
              key={key}
              utilityKey={key}
              reading={utilities[key]}
              expanded={expandedUtility === key}
              onToggle={() => setExpandedUtility(expandedUtility === key ? null : key)}
              scenarioMatch={scenarioAlert?.utilityKey === key}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="label">Environment: Building → Floor → Zone</p>
          <ViewInTwin kind="building" id={selectedBuilding} label={`View ${buildingName} in Digital Twin`} />
        </div>
        <p className="mb-3 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
          Click any zone for its thresholds and the BMS assets serving it.
        </p>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {buildingIds.map((id) => {
            const name = buildings.find((b) => b.id === id)?.name ?? id
            const active = id === selectedBuilding
            return (
              <button
                key={id}
                onClick={() => setSelectedBuilding(id)}
                className="rounded-sm px-2.5 py-1 text-[11.5px] font-medium"
                style={{
                  background: active ? 'var(--app-accent-bg)' : 'var(--app-surface-soft)',
                  color: active ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  border: `1px solid ${active ? 'var(--app-accent-border)' : 'var(--app-border)'}`,
                }}
              >
                {name}
              </button>
            )
          })}
        </div>

        {floors.map((floor) => (
          <div key={floor} className="mb-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
              {floor}
            </p>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {zonesForBuilding
                .filter((z) => z.floor === floor)
                .map((z) => {
                  const zoneExpanded = expandedZoneId === z.id
                  const servingAssets = bmsAssets.filter((a) => a.zoneId === z.id)
                  const tempZone = thresholdZone(z.temperatureC, KPI_THRESHOLDS.avgTemperature)
                  const humidityZone = thresholdZone(z.humidityPct, KPI_THRESHOLDS.humidity)
                  const co2Zone = thresholdZone(z.co2Ppm, KPI_THRESHOLDS.co2)
                  const aqiZone = thresholdZone(z.airQualityIndex, KPI_THRESHOLDS.airQuality)
                  const zoneColor = (zn: ReturnType<typeof thresholdZone>) => (zn === 'normal' ? undefined : zn === 'warning' ? 'var(--app-warning)' : 'var(--app-danger)')
                  return (
                    <div
                      key={z.id}
                      className="glass-panel flex flex-col gap-2 p-3.5 text-left"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedZoneId(zoneExpanded ? null : z.id)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setExpandedZoneId(zoneExpanded ? null : z.id))}
                      style={{ cursor: 'pointer', outline: zoneExpanded ? '1px solid var(--app-accent-border)' : undefined }}
                      aria-expanded={zoneExpanded}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
                          <Icon d={ICONS.pin} />
                          {z.name}
                        </span>
                        <span
                          className="status-chip"
                          style={z.status === 'Normal' ? { background: 'var(--app-success-bg)', color: 'var(--app-success)', borderColor: 'var(--app-success-border)' } : { background: 'var(--app-warning-bg)', color: 'var(--app-warning)', borderColor: 'var(--app-warning-border)' }}
                        >
                          {z.status}
                        </span>
                      </div>
                      <div className="tnum grid grid-cols-2 gap-2 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
                        <span className="flex items-center gap-1" style={{ color: zoneColor(tempZone) }}>
                          <Icon d={ICONS.thermometer} /> {z.temperatureC.toFixed(1)} °C
                        </span>
                        <span className="flex items-center gap-1" style={{ color: zoneColor(humidityZone) }}>
                          <Icon d={ICONS.droplet} /> {z.humidityPct}% RH
                        </span>
                        <span className="flex items-center gap-1" style={{ color: zoneColor(co2Zone) }}>
                          <Icon d={ICONS.wind} /> {z.co2Ppm} ppm CO₂
                        </span>
                        <span className="flex items-center gap-1" style={{ color: zoneColor(aqiZone) }}>
                          <Icon d={ICONS.leaf} /> AQI {z.airQualityIndex}
                        </span>
                      </div>

                      {zoneExpanded && (
                        <div className="mt-1 flex flex-col gap-2 border-t pt-2.5 text-[11px]" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }} onClick={(e) => e.stopPropagation()}>
                          <p style={{ color: 'var(--app-text-faint)' }}>{thresholdCaption(KPI_THRESHOLDS.avgTemperature)} · {thresholdCaption(KPI_THRESHOLDS.humidity)}</p>
                          <p style={{ color: 'var(--app-text-faint)' }}>{thresholdCaption(KPI_THRESHOLDS.co2)} · {thresholdCaption(KPI_THRESHOLDS.airQuality)}</p>
                          <div>
                            <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                              <Icon d={ICONS.wrench} /> Served by
                            </p>
                            {servingAssets.length === 0 ? (
                              <p style={{ color: 'var(--app-text-faint)' }}>No BMS asset directly linked to this zone.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {servingAssets.map((a) => (
                                  <span key={a.id} className="status-chip status-chip-info">
                                    {a.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p>Cooling load: {z.coolingLoadPct.toFixed(0)}%</p>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </section>

      {explainData && <TrendExplainModal data={explainData} onClose={() => setExplainData(null)} />}
    </div>
  )
}


function UtilityCard({
  utilityKey,
  reading,
  expanded,
  onToggle,
  scenarioMatch,
}: {
  utilityKey: UtilityKey
  reading: { flow: number; flowUnit: string; pressureBar: number; status: string }
  expanded: boolean
  onToggle: () => void
  /** True when the active Simulation-page scenario is a UTILITY_FAILURE run against this exact utility — badges only this card, never the other three. */
  scenarioMatch: boolean
}) {
  const info = UTILITY_INFO[utilityKey]
  const pressureHistory = useUtilityPressureHistory(utilityKey)
  const pressureZone = thresholdZone(reading.pressureBar, info.threshold)
  const zoneColor = pressureZone === 'normal' ? 'var(--app-success)' : pressureZone === 'warning' ? 'var(--app-warning)' : 'var(--app-danger)'

  return (
    <div className="relative">
    {scenarioMatch && <ScenarioKpiPreview module="utilities" kpiLabel="Pressure" />}
    <div
      className="kpi-card text-left"
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}
      style={{ cursor: 'pointer', outline: expanded ? '1px solid var(--app-accent-border)' : undefined }}
      aria-expanded={expanded}
    >
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
        <Icon d={info.icon} />
        {info.label}
      </p>
      <div className="tnum mt-3 text-[22px] font-bold leading-none" style={{ color: 'var(--app-text)' }}>
        {reading.flow.toLocaleString()}
        <span className="ml-1 text-[11px] font-medium" style={{ color: 'var(--app-text-faint)' }}>
          {reading.flowUnit}
        </span>
      </div>
      <div className="tnum mt-1.5 text-[11px]" style={{ color: zoneColor }}>
        {reading.pressureBar.toFixed(2)} bar
      </div>
      <div className="mt-auto">
        <div className="kpi-card-divider" />
        <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ letterSpacing: '0.07em', color: 'var(--app-success)' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--app-success)', display: 'inline-block' }} />
          {reading.status}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--app-border)' }} onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
            {info.description}
          </p>
          <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {thresholdCaption(info.threshold)}
          </p>
          <div className="-mx-1 rounded-sm" style={{ background: 'var(--app-surface-soft)' }}>
            <TrendChart
              label="Pressure Trend"
              unit="bar"
              data={pressureHistory.map((p) => p.value)}
              pointLabels={pressureHistory.map((p) => p.label)}
              color="var(--app-accent)"
              formatter={(v) => v.toFixed(2)}
              height={64}
              threshold={info.threshold}
              xAxisCaption="time (last 4h)"
              xAxisStart={pressureHistory[0]?.label ?? '−4h'}
            />
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

/** A Plant Assets table row that scrolls itself into view and highlights when it's the target of a "Requires Attention" redirect. */
function AssetRow({ scrollTo, highlighted, children }: { scrollTo: boolean; highlighted: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLTableRowElement>(null)
  useEffect(() => {
    if (scrollTo && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo])
  return (
    <tr ref={ref} style={{ borderBottom: '1px solid var(--app-border)', background: highlighted ? 'var(--app-accent-bg)' : undefined }}>
      {children}
    </tr>
  )
}
