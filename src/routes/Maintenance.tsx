import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ICONS, Icon, KpiTile, LiveBadge, Meter, Panel, StateChip } from '../components/ui'
import { ChartDetailModal, type ChartDetailData } from '../components/ChartDetailModal'
import { ViewInTwin } from '../components/ViewInTwin'
import { HighlightTarget } from '../components/HighlightTarget'
import { deriveWorkOrders, maintenanceLabel, type WorkOrder, type WorkOrderStatus } from '../data/deriveMaintenance'
import { useSimulation } from '../simulation/useSimulation'
import { SPARE_PARTS } from '../lib/spareParts'
import { KPI_THRESHOLDS } from '../lib/kpiThresholds'
import {
  equipmentHealthTrend,
  equipmentHealthByAsset,
  mtbfMttrByLine,
  maintenanceWorkloadByWeek,
  failureAlarmTrend,
} from '../lib/maintenanceAnalytics'
import { TrendLineChart, FailureTrendChart, WorkloadStackedBarChart, EquipmentHealthBarChart, MtbfMttrChart } from '../components/MaintenanceCharts'
import { useScenarioAlert } from '../simulation/scenarioAlertState'
import { ScenarioRowBadge } from '../components/ScenarioRowBadge'

const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  scheduled: 'Scheduled',
  'in-progress': 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  critical: 'Critical',
}

function workOrderList(orders: WorkOrder[], title: string, emptyText: string) {
  return {
    title,
    columns: ['Equipment', 'Line', 'Type', 'Status', 'Detail'],
    rows: orders.slice(0, 12).map((w) => [`${w.equipmentName} (${w.equipmentId})`, w.lineId, w.type, STATUS_LABEL[w.status], w.description]),
    emptyText,
  }
}

const STATUS_CHIP: Record<WorkOrderStatus, string> = {
  critical: 'status-chip-danger',
  overdue: 'status-chip-danger',
  'in-progress': 'status-chip-warning',
  scheduled: 'status-chip-info',
  completed: 'status-chip-success',
}

export default function Maintenance() {
  const state = useSimulation()
  const workOrders = deriveWorkOrders(state)
  const eqList = Object.values(state.equipment)
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('attn')
  const scenarioAlert = useScenarioAlert()

  const counts = {
    preventive: workOrders.filter((w) => w.type === 'preventive').length,
    corrective: workOrders.filter((w) => w.type === 'corrective').length,
    overdue: workOrders.filter((w) => w.status === 'overdue').length,
    critical: workOrders.filter((w) => w.status === 'critical').length,
  }

  const openList = useMemo(() => workOrderList(workOrders, 'All Open Work Orders', 'No open work orders. Every asset is on schedule.'), [workOrders])
  const preventiveList = useMemo(
    () => workOrderList(workOrders.filter((w) => w.type === 'preventive'), 'Preventive Work Orders', 'No preventive maintenance is currently scheduled or in progress.'),
    [workOrders],
  )
  const correctiveList = useMemo(
    () => workOrderList(workOrders.filter((w) => w.type === 'corrective'), 'Corrective Work Orders', 'No corrective maintenance is currently open.'),
    [workOrders],
  )
  const overdueList = useMemo(
    () => workOrderList(workOrders.filter((w) => w.status === 'overdue'), 'Overdue Work Orders', 'No preventive maintenance windows have been missed.'),
    [workOrders],
  )
  const criticalList = useMemo(
    () => workOrderList(workOrders.filter((w) => w.status === 'critical'), 'Critical Work Orders', 'No equipment is currently in a critical fault state.'),
    [workOrders],
  )
  const healthTrend = useMemo(() => equipmentHealthTrend(state), [state])
  const healthTrendSimulated = useMemo(() => healthTrend.map(() => false), [healthTrend])
  const assetHealthRanking = useMemo(() => equipmentHealthByAsset(state, 8), [state])
  const mtbfMttr = useMemo(() => mtbfMttrByLine(state), [state])
  const workloadByWeek = useMemo(() => maintenanceWorkloadByWeek(state), [state])
  const failureTrend = useMemo(() => failureAlarmTrend(state), [state])
  const [chartDetail, setChartDetail] = useState<ChartDetailData | null>(null)

  function explainHealthTrend() {
    const values = healthTrend.map((p) => p.value)
    const worst = assetHealthRanking.slice(0, 3)
    setChartDetail({
      label: 'Equipment Health Trend',
      unit: '/ 100',
      currentValue: values.at(-1) ?? 0,
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
      averageValue: values.reduce((a, b) => a + b, 0) / values.length,
      windowLabel: 'Last 24h',
      threshold: { warning: KPI_THRESHOLDS.equipmentHealth.warning, critical: KPI_THRESHOLDS.equipmentHealth.critical, direction: 'below' },
      detailText:
        worst.length > 0
          ? `Lowest-scoring assets right now: ${worst.map((a) => `${a.id} (${a.health.toFixed(0)}/100)`).join(', ')}.`
          : undefined,
    })
  }
  const faultedEquipmentCount = eqList.filter((e) => e.status === 'critical' || e.status === 'warning').length

  const equipmentHealthList = useMemo(() => {
    const rows = eqList
      .slice()
      .sort((a, b) => a.health - b.health)
      .slice(0, 8)
      .map((eq) => [`${eq.name} (${eq.id})`, eq.lineId, eq.health.toFixed(0), maintenanceLabel(eq)])
    return {
      title: 'Equipment Health — Lowest Score First',
      columns: ['Equipment', 'Line', 'Health', 'Maintenance'],
      rows,
      note: 'The eight lowest-scoring assets in the facility, worst first.',
    }
  }, [eqList])

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Equipment &amp; Maintenance</h1>
          <p className="page-subtitle">Live work orders derived from real equipment condition. Every record tied to an asset.</p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          <KpiTile
            icon={<Icon d={ICONS.clipboard} />}
            label="Open Work Orders"
            value={workOrders.length}
            sub={`${counts.preventive} preventive · ${counts.corrective} corrective`}
            description="Total active maintenance work orders, derived live from equipment state."
            detailList={openList}
            roadmap={[]}
          />
          <KpiTile
            icon={<Icon d={ICONS.calendar} />}
            label="Preventive"
            value={counts.preventive}
            sub={workOrders.length > 0 ? `${Math.round((counts.preventive / workOrders.length) * 100)}% of open orders` : 'No open orders'}
            description="Scheduled or in-progress preventive maintenance."
            detailList={preventiveList}
            roadmap={[]}
          />
          <KpiTile
            icon={<Icon d={ICONS.wrench} />}
            label="Corrective"
            value={counts.corrective}
            tone={counts.corrective > 0 ? 'warn' : 'ok'}
            sub={workOrders.length > 0 ? `${Math.round((counts.corrective / workOrders.length) * 100)}% of open orders` : 'No open orders'}
            description="Reactive maintenance triggered by an elevated reading or fault."
            detailList={correctiveList}
            roadmap={[]}
          />
          <KpiTile
            icon={<Icon d={ICONS.clock} />}
            label="Overdue"
            value={counts.overdue}
            tone={counts.overdue > 0 ? 'crit' : 'ok'}
            sub={counts.overdue > 0 ? 'Preventive windows missed' : 'All windows on schedule'}
            description="Preventive maintenance windows that have passed."
            detailList={overdueList}
            roadmap={counts.overdue > 0 ? ['Reschedule the overdue window below before the next shift.', 'Confirm no dependent line is running past its safe maintenance interval.'] : []}
          />
          <KpiTile
            icon={<Icon d={ICONS.alert} />}
            label="Critical"
            value={counts.critical}
            tone={counts.critical > 0 ? 'crit' : 'ok'}
            sub={counts.critical > 0 ? 'Immediate action required' : 'No critical faults'}
            description="Equipment in a critical fault state needing immediate action."
            detailList={criticalList}
            roadmap={counts.critical > 0 ? ['Dispatch a technician to the asset below immediately.', 'Confirm the line is safe to keep running or should be paused.'] : []}
          />
          <KpiTile
            icon={<Icon d={ICONS.gauge} />}
            label="Equipment Health"
            value={state.kpis.equipmentHealthScore.toFixed(1)}
            unit="/ 100"
            sub={`${faultedEquipmentCount} asset${faultedEquipmentCount === 1 ? '' : 's'} below normal`}
            threshold={KPI_THRESHOLDS.equipmentHealth}
            description="Average health score across all equipment in the facility."
            detailList={equipmentHealthList}
            roadmap={[]}
          />
        </div>
      </section>

      <Panel label="Work Orders" action={<span className="label">{workOrders.length} open</span>}>
        {workOrders.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-[12.5px]" style={{ color: 'var(--app-text-faint)' }}>
            No open work orders. Every asset is on schedule.
          </div>
        ) : (
          <ul>
            {workOrders.map((w) => {
              const eq = state.equipment[w.equipmentId]
              const isScenarioTarget = scenarioAlert?.targetKind === 'equipment' && scenarioAlert.targetId === w.equipmentId
              return (
                <HighlightTarget
                  key={w.id}
                  as="li"
                  active={highlightId === w.equipmentId}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: '1px solid var(--app-border)', background: isScenarioTarget ? 'var(--app-danger-bg)' : undefined }}
                >
                  <span className={`status-chip shrink-0 ${STATUS_CHIP[w.status]}`}>{w.status}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-[family-name:var(--font-mono)] text-[11.5px]" style={{ color: 'var(--app-accent)' }}>
                        {w.equipmentId}
                      </span>
                      <span className="truncate text-[12.5px] font-medium" style={{ color: 'var(--app-text)' }}>
                        {w.equipmentName}
                      </span>
                      <span className="label">{w.type}</span>
                      {isScenarioTarget && <ScenarioRowBadge note={scenarioAlert!.whatIsHappening} />}
                    </div>
                    <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
                      {w.description}
                    </div>
                  </div>
                  {eq && (
                    <span className="tnum hidden shrink-0 text-[11.5px] sm:block" style={{ color: 'var(--app-text-faint)' }}>
                      Health {eq.health.toFixed(0)}
                    </span>
                  )}
                  <ViewInTwin kind="equipment" id={w.equipmentId} label="Twin" />
                </HighlightTarget>
              )
            })}
          </ul>
        )}
      </Panel>

      {/* ==================================================================== analytics == */}
      <section>
        <p className="label mb-3">Analytics</p>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className="glass-panel p-4">
            <TrendLineChart
              label="Equipment Health Trend — Last 24h"
              unit="/ 100"
              points={healthTrend}
              simulated={healthTrendSimulated}
              color="var(--app-success)"
              threshold={KPI_THRESHOLDS.equipmentHealth}
              emptyText="gathering health samples this session…"
              onExplain={healthTrend.length >= 2 ? explainHealthTrend : undefined}
            />
          </div>
          <div className="glass-panel p-4">
            <WorkloadStackedBarChart weeks={workloadByWeek} />
          </div>
          <div className="glass-panel p-4">
            <EquipmentHealthBarChart assets={assetHealthRanking} />
          </div>
          <div className="glass-panel p-4">
            <MtbfMttrChart points={mtbfMttr} />
          </div>
          <div className="glass-panel p-4 lg:col-span-2">
            <FailureTrendChart points={failureTrend} />
          </div>
        </div>
      </section>

      {chartDetail && <ChartDetailModal data={chartDetail} onClose={() => setChartDetail(null)} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel label="Equipment Health" action={<span className="label">{eqList.length} units</span>}>
          <ul>
            {eqList
              .slice()
              .sort((a, b) => a.health - b.health)
              .slice(0, 8)
              .map((eq) => {
                const isScenarioTarget = scenarioAlert?.targetKind === 'equipment' && scenarioAlert.targetId === eq.id
                return (
                <HighlightTarget
                  key={eq.id}
                  as="li"
                  active={highlightId === eq.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: '1px solid var(--app-border)', background: isScenarioTarget ? 'var(--app-danger-bg)' : undefined }}
                >
                  <StateChip status={eq.status} />
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-[family-name:var(--font-mono)] text-[11px]" style={{ color: 'var(--app-accent)' }}>
                      {eq.id}
                    </span>
                    <span className="ml-2 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
                      {maintenanceLabel(eq)}
                    </span>
                    {isScenarioTarget && (
                      <span className="ml-2">
                        <ScenarioRowBadge note={scenarioAlert!.whatIsHappening} />
                      </span>
                    )}
                  </div>
                  <div className="w-20 shrink-0">
                    <Meter value={eq.health} max={100} tone={eq.health < 75 ? 'var(--app-warning)' : 'var(--app-success)'} />
                  </div>
                  <span className="tnum w-8 shrink-0 text-right text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    {eq.health.toFixed(0)}
                  </span>
                </HighlightTarget>
                )
              })}
          </ul>
        </Panel>

        <Panel label="Spare Parts">
          <ul>
            {SPARE_PARTS.map((p) => {
              const low = p.onHand <= p.reorderAt
              return (
                <li key={p.name} className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <span className="text-[12.5px]" style={{ color: 'var(--app-text)' }}>
                    {p.name}
                  </span>
                  <span className={`status-chip ${low ? 'status-chip-warning' : 'status-chip-neutral'}`}>{p.onHand} on hand</span>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
