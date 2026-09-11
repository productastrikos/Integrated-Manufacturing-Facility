import { useMemo } from 'react'
import { ICONS, Icon, KpiTile, Meter, Panel, StateChip } from '../components/ui'
import { TrendChart } from '../components/TrendChart'
import { ViewInTwin } from '../components/ViewInTwin'
import { useSimulation } from '../simulation/useSimulation'
import { KPI_THRESHOLDS } from '../lib/kpiThresholds'
import { buildCriticalAlertsList, buildEmergencyEventsList, buildNearMissesList, buildSafetyIncidentsList, safetySeverity } from '../lib/safetyDetails'
import { useSiteMetricSeries, useSiteMetricLabels } from '../lib/siteMetricHistory'

export function SafetyBody() {
  const state = useSimulation()
  const { safetySecurity, safetyExtra, attention, equipment } = state

  const incidentsList = useMemo(() => buildSafetyIncidentsList(safetySecurity.activeSafetyIncidents), [safetySecurity.activeSafetyIncidents])
  const nearMissesList = useMemo(() => buildNearMissesList(safetySecurity.nearMisses), [safetySecurity.nearMisses])
  const emergencyList = useMemo(() => buildEmergencyEventsList(safetyExtra.emergencyEventsActive), [safetyExtra.emergencyEventsActive])
  const criticalAlertsList = useMemo(() => buildCriticalAlertsList(equipment), [equipment])

  // 1-minute-bucketed series — real minutes over up to 4 hours, not 90 raw ticks.
  const ppeSeries = useSiteMetricSeries('ppeCompliancePct')
  const complianceSeries = useSiteMetricSeries('complianceScorePct')
  const metricLabels = useSiteMetricLabels()

  const severity = safetySeverity(safetySecurity, safetyExtra)

  return (
    <div className="flex flex-col gap-6">
      <section
        className="glass-panel flex items-center gap-3 p-4"
        style={
          severity === 'crit'
            ? { borderColor: 'var(--app-danger-border)', background: 'var(--app-danger-bg)' }
            : severity === 'warn'
              ? { borderColor: 'var(--app-warning-border)', background: 'var(--app-warning-bg)' }
              : { borderColor: 'var(--app-success-border)', background: 'var(--app-success-bg)' }
        }
      >
        <span
          className={severity === 'crit' ? 'pulse-dot' : ''}
          style={{ width: 10, height: 10, borderRadius: 999, background: severity === 'crit' ? 'var(--app-danger)' : severity === 'warn' ? 'var(--app-warning)' : 'var(--app-success)' }}
        />
        <div>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
            {severity === 'crit' ? 'Active safety incident on site' : severity === 'warn' ? 'Elevated safety attention required' : 'All safety systems normal'}
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
            Fire detection {safetyExtra.fireDetectionStatus.toLowerCase()} · {safetyExtra.emergencyEventsActive} emergency event(s) active
          </div>
        </div>
      </section>

      <section>
        <p className="label mb-3">Safety KPIs</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiTile
            icon={<Icon d={ICONS.alert} />}
            label="Active Safety Incidents"
            value={safetySecurity.activeSafetyIncidents}
            tone={safetySecurity.activeSafetyIncidents > 0 ? 'crit' : 'ok'}
            description="Safety incidents currently open on site requiring resolution."
            detailList={incidentsList}
            roadmap={safetySecurity.activeSafetyIncidents > 0 ? ['Confirm the zone below is cordoned off and hazard-tagged.', 'Assign an owner to close out the incident and log the resolution.'] : []}
          />
          <KpiTile
            icon={<Icon d={ICONS.eye} />}
            label="Near Misses"
            value={safetySecurity.nearMisses}
            tone={safetySecurity.nearMisses > 0 ? 'warn' : 'ok'}
            description="Logged near-miss events this session."
            detailList={nearMissesList}
            roadmap={safetySecurity.nearMisses > 0 ? ['Share the near miss below at the next toolbox talk.'] : []}
          />
          <KpiTile
            icon={<Icon d={ICONS.flag} />}
            label="Emergency Events"
            value={safetyExtra.emergencyEventsActive}
            tone={safetyExtra.emergencyEventsActive > 0 ? 'crit' : 'ok'}
            description="Active declared emergencies (fire, evacuation, etc)."
            detailList={emergencyList}
            roadmap={[]}
          />
          <KpiTile
            icon={<Icon d={ICONS.shield} />}
            label="Fire Detection"
            value={safetyExtra.fireDetectionStatus}
            tone={safetyExtra.fireDetectionStatus === 'Normal' ? 'ok' : 'crit'}
            description="Status of the site's fire detection and suppression systems."
          />
          <KpiTile
            icon={<Icon d={ICONS.gauge} />}
            label="PPE Compliance"
            value={safetyExtra.ppeCompliancePct.toFixed(1)}
            unit="%"
            tone={safetyExtra.ppeCompliancePct < 90 ? 'warn' : 'ok'}
            description="Share of monitored zones with full PPE compliance."
            threshold={KPI_THRESHOLDS.ppeCompliance}
          />
          <KpiTile
            icon={<Icon d={ICONS.clipboard} />}
            label="Safety Inspection Status"
            value={safetyExtra.inspectionStatus}
            tone={safetyExtra.inspectionStatus === 'Up to date' ? 'ok' : safetyExtra.inspectionStatus === 'Due' ? 'warn' : 'crit'}
            description="Status of scheduled safety inspections across the facility."
          />
          <KpiTile
            icon={<Icon d={ICONS.target} />}
            label="Compliance Score"
            value={safetyExtra.complianceScorePct.toFixed(0)}
            unit="/ 100"
            tone={safetyExtra.complianceScorePct < 85 ? 'warn' : 'ok'}
            description="Composite score of safety, PPE and inspection compliance."
            threshold={KPI_THRESHOLDS.complianceScore}
          />
          <KpiTile
            icon={<Icon d={ICONS.wrench} />}
            label="Critical Alerts"
            value={safetySecurity.criticalAlerts}
            tone={safetySecurity.criticalAlerts > 0 ? 'crit' : 'ok'}
            description="Equipment currently in a critical fault state. Flows into safety review."
            detailList={criticalAlertsList}
            roadmap={safetySecurity.criticalAlerts > 0 ? ['Dispatch a technician to the equipment below immediately.'] : []}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel label="PPE Compliance">
          <div className="p-4">
            <div className="flex items-baseline justify-between">
              <span className="label">Site-wide</span>
              <span className="tnum text-[13px] font-medium" style={{ color: 'var(--app-success)' }}>
                {safetyExtra.ppeCompliancePct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2">
              <Meter value={safetyExtra.ppeCompliancePct} max={100} tone={safetyExtra.ppeCompliancePct < 90 ? 'var(--app-warning)' : 'var(--app-success)'} />
            </div>
          </div>
          <TrendChart
            label="PPE Compliance"
            unit="%"
            data={ppeSeries}
            pointLabels={metricLabels}
            xAxisCaption="time (last 4h)"
            xAxisStart={metricLabels[0] ?? '−4h'}
            color="var(--app-success)"
            formatter={(v) => v.toFixed(1)}
            height={80}
            threshold={KPI_THRESHOLDS.ppeCompliance}
            variant="wave"
          />
        </Panel>

        <Panel label="Compliance Score" action={<span className="label">last 4h</span>}>
          <TrendChart
            label="Compliance Score"
            unit="/ 100"
            data={complianceSeries}
            pointLabels={metricLabels}
            xAxisCaption="time (last 4h)"
            xAxisStart={metricLabels[0] ?? '−4h'}
            color="var(--app-accent)"
            formatter={(v) => v.toFixed(0)}
            height={140}
            threshold={KPI_THRESHOLDS.complianceScore}
            variant="wave"
          />
        </Panel>

        <Panel label="Equipment-Linked Safety Attention" action={<span className="label">{attention.length} items</span>}>
          {attention.length === 0 ? (
            <div className="flex h-[110px] items-center justify-center text-[12.5px]" style={{ color: 'var(--app-text-faint)' }}>
              No equipment currently outside normal range.
            </div>
          ) : (
            <ul>
              {attention.map((a) => (
                <li key={a.equipmentId} className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <StateChip status={a.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-[family-name:var(--font-mono)] text-[11.5px]" style={{ color: 'var(--app-accent)' }}>
                      {a.equipmentId}
                    </div>
                    <div className="text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
                      {a.reason}
                    </div>
                  </div>
                  <ViewInTwin kind="equipment" id={a.equipmentId} label="Twin" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
