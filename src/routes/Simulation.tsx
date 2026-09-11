import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ICONS, Icon, KpiTile, LiveBadge, Panel } from '../components/ui'
import { useSimulation } from '../simulation/useSimulation'
import { useScenarioUiState, setScenarioUiState, type ScenarioKind } from '../simulation/scenarioUiState'
import { setScenarioAlert, clearScenarioAlert } from '../simulation/scenarioAlertState'
import { MODULE_LABEL, deriveCascade, type FactoryEvent, type Impact, type ImpactSeverity } from '../lib/factoryEvents'
import { UTILITY_INFO, type UtilityKey } from '../lib/utilityInfo'

/**
 * Scenario runner. Every scenario is evaluated against the live factory
 * state as its baseline and resolved through the same cross-module cascade
 * engine the dashboards use — so a what-if answer can never contradict what
 * the rest of the app would say about the same event.
 *
 * Nothing here mutates the live state. `deriveCascade` is a pure read, so
 * running a scenario is always non-destructive: the simulation is a lens
 * over the current factory, never a second copy of it.
 */

const SCENARIOS: { kind: ScenarioKind; label: string; blurb: string }[] = [
  { kind: 'EQUIPMENT_FAILURE', label: 'Equipment Failure', blurb: 'Take an asset offline and follow the loss through production, maintenance and spares.' },
  { kind: 'MATERIAL_SHORTAGE', label: 'Material Shortage', blurb: 'Run a material to zero and see which lines starve and when.' },
  { kind: 'SUPPLIER_DELAY', label: 'Supplier Delay', blurb: 'Slip a supplier and find which materials run out before the delivery lands.' },
  { kind: 'UTILITY_FAILURE', label: 'Utility Failure', blurb: 'Lose a utility supply and trace the dependent processes.' },
  { kind: 'PRODUCTION_TARGET_CHANGE', label: 'Production Target Change', blurb: 'Move the shift target and re-read achievement, cover and shift capacity.' },
]

const SEVERITY_STYLE: Record<ImpactSeverity, { color: string; glyph: string; label: string }> = {
  info: { color: 'var(--app-info)', glyph: '●', label: 'INFO' },
  warning: { color: 'var(--app-warning)', glyph: '△', label: 'WARNING' },
  critical: { color: 'var(--app-danger)', glyph: '◆', label: 'CRITICAL' },
}

export default function Simulation() {
  const state = useSimulation()
  const navigate = useNavigate()

  const { kind, equipmentId, downtimeHours, materialId, supplierId, utility, targetDelta, ran } = useScenarioUiState()

  const event: FactoryEvent = useMemo(() => {
    switch (kind) {
      case 'EQUIPMENT_FAILURE':
        return { type: 'EQUIPMENT_FAILURE', equipmentId, downtimeHours }
      case 'MATERIAL_SHORTAGE':
        return { type: 'MATERIAL_SHORTAGE', materialId }
      case 'SUPPLIER_DELAY':
        return { type: 'SUPPLIER_DELAY', supplierId, delayDays: 3 }
      case 'UTILITY_FAILURE':
        return { type: 'UTILITY_FAILURE', utility }
      case 'PRODUCTION_TARGET_CHANGE':
        return { type: 'PRODUCTION_TARGET_CHANGE', deltaPct: targetDelta }
    }
  }, [kind, equipmentId, downtimeHours, materialId, supplierId, utility, targetDelta])

  const cascade = useMemo(() => deriveCascade(state, event), [state, event])

  const equipmentList = useMemo(() => Object.values(state.equipment).sort((a, b) => a.health - b.health), [state.equipment])
  const grouped = useMemo(() => {
    const map = new Map<string, Impact[]>()
    for (const i of cascade.impacts) {
      const key = MODULE_LABEL[i.module]
      map.set(key, [...(map.get(key) ?? []), i])
    }
    return [...map.entries()]
  }, [cascade])

  const criticalCount = cascade.impacts.filter((i) => i.severity === 'critical').length
  const warningCount = cascade.impacts.filter((i) => i.severity === 'warning').length

  // Only EQUIPMENT_FAILURE maps to one physical, twin-selectable object —
  // material/supplier/utility/target-change scenarios ripple across many
  // things at once with no single point to ring, so those clear any
  // existing preview rather than pointing at something arbitrary.
  // Each scenario kind maps to the one real, twin-selectable object its
  // impact is physically located at — a material or a utility doesn't have
  // its own 3D presence, but the warehouse and utility-area buildings that
  // house them do (the same building "View Warehouse in Twin" already
  // deep-links to elsewhere in the app). Supplier delay and a target change
  // ripple across many lines/materials at once with no single point to
  // ring, so those clear any existing preview rather than pointing at
  // something arbitrary.
  function scenarioTarget(): { targetKind: 'equipment' | 'building' | null; targetId: string | null } {
    switch (kind) {
      case 'EQUIPMENT_FAILURE':
        return { targetKind: 'equipment', targetId: equipmentId }
      case 'MATERIAL_SHORTAGE':
        return { targetKind: 'building', targetId: 'BLD-WARE' }
      case 'UTILITY_FAILURE':
        return { targetKind: 'building', targetId: 'BLD-UTIL' }
      default:
        return { targetKind: null, targetId: null }
    }
  }

  function runScenario() {
    setScenarioUiState({ ran: true })
    const hasCritical = cascade.impacts.some((i) => i.severity === 'critical')
    if (!hasCritical) {
      clearScenarioAlert()
      return
    }
    setScenarioAlert({
      id: `scenario-${Date.now()}`,
      ...scenarioTarget(),
      materialId: kind === 'MATERIAL_SHORTAGE' ? materialId : undefined,
      utilityKey: kind === 'UTILITY_FAILURE' ? utility : undefined,
      scenarioLabel: SCENARIOS.find((s) => s.kind === kind)?.label ?? kind,
      title: cascade.title,
      whatIsHappening: cascade.whatIsHappening,
      resolution: cascade.whatShouldWeDo,
      severity: 'critical',
      impacts: cascade.impacts,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Simulation</h1>
          <p className="page-subtitle">
            What-if scenarios evaluated against the live factory as baseline. Read-only — running a scenario never changes live state.
          </p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      {/* ------------------------------------------------------- baseline -- */}
      <section>
        <p className="label mb-3">Baseline — Live Factory</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile icon={<Icon d={ICONS.gauge} />} label="OEE" value={state.kpis.oeePct.toFixed(1)} unit="%" description="Overall Equipment Effectiveness at the moment the scenario is evaluated." />
          <KpiTile icon={<Icon d={ICONS.output} />} label="Production Output" value={Math.round(state.kpis.outputUnits).toLocaleString()} unit="units" description="Units produced this session, the baseline any scenario loss is measured against." />
          <KpiTile icon={<Icon d={ICONS.trend} />} label="Lines Running" value={`${state.kpis.linesRunning} / ${state.kpis.linesTotal}`} description="Production lines currently running across the facility." />
          <KpiTile icon={<Icon d={ICONS.wrench} />} label="Equipment Running" value={`${state.kpis.equipmentRunning} / ${state.kpis.equipmentTotal}`} description="Assets currently running versus the total installed base." />
          <KpiTile icon={<Icon d={ICONS.bolt} />} label="Site Demand" value={state.energy.currentDemandMw.toFixed(2)} unit="MW" description="Instantaneous site power draw at baseline." />
          <KpiTile icon={<Icon d={ICONS.box} />} label="Materials At Risk" value={state.materials.materials.filter((m) => m.stockLevel <= m.reorderLevel).length} description="Materials at or below their reorder point before the scenario is applied." />
        </div>
      </section>

      {/* ------------------------------------------------------- scenario -- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <Panel label="Scenario">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.kind}
                  onClick={() => setScenarioUiState({ kind: s.kind, ran: false })}
                  className="rounded-lg px-3 py-2 text-left"
                  style={{
                    background: kind === s.kind ? 'var(--app-accent-bg)' : 'var(--app-surface-soft)',
                    border: `1px solid ${kind === s.kind ? 'var(--app-accent-border)' : 'var(--app-border)'}`,
                  }}
                >
                  <div className="text-[12px] font-semibold" style={{ color: kind === s.kind ? 'var(--app-accent)' : 'var(--app-text)' }}>
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[10.5px] leading-snug" style={{ color: 'var(--app-text-faint)' }}>
                    {s.blurb}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--app-border)' }}>
              <p className="label">Parameters</p>

              {kind === 'EQUIPMENT_FAILURE' && (
                <>
                  <label className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    Asset
                  </label>
                  <select className="field h-8 text-[12px]" value={equipmentId} onChange={(e) => setScenarioUiState({ equipmentId: e.target.value })}>
                    {equipmentList.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.id} — {eq.name} ({eq.health.toFixed(0)}/100)
                      </option>
                    ))}
                  </select>
                  <label className="mt-1 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    Downtime: {downtimeHours}h
                  </label>
                  <input type="range" min={1} max={24} step={1} value={downtimeHours} onChange={(e) => setScenarioUiState({ downtimeHours: Number(e.target.value) })} />
                </>
              )}

              {kind === 'MATERIAL_SHORTAGE' && (
                <>
                  <label className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    Material
                  </label>
                  <select className="field h-8 text-[12px]" value={materialId} onChange={(e) => setScenarioUiState({ materialId: e.target.value })}>
                    {state.materials.materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({Math.round(m.stockLevel).toLocaleString()} {m.unit})
                      </option>
                    ))}
                  </select>
                </>
              )}

              {kind === 'SUPPLIER_DELAY' && (
                <>
                  <label className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    Supplier
                  </label>
                  <select className="field h-8 text-[12px]" value={supplierId} onChange={(e) => setScenarioUiState({ supplierId: e.target.value })}>
                    {state.materials.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.onTimePct.toFixed(0)}% on-time)
                      </option>
                    ))}
                  </select>
                </>
              )}

              {kind === 'UTILITY_FAILURE' && (
                <>
                  <label className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    Utility
                  </label>
                  <select className="field h-8 text-[12px]" value={utility} onChange={(e) => setScenarioUiState({ utility: e.target.value as UtilityKey })}>
                    {(Object.keys(UTILITY_INFO) as UtilityKey[]).map((k) => (
                      <option key={k} value={k}>
                        {UTILITY_INFO[k].label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {kind === 'PRODUCTION_TARGET_CHANGE' && (
                <>
                  <label className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    Target change: {targetDelta > 0 ? '+' : ''}
                    {targetDelta}%
                  </label>
                  <input type="range" min={-30} max={40} step={5} value={targetDelta} onChange={(e) => setScenarioUiState({ targetDelta: Number(e.target.value) })} />
                </>
              )}
            </div>

            <button className="app-btn h-9 text-[12px] font-semibold" onClick={runScenario} style={{ borderColor: 'var(--app-accent-border)', color: 'var(--app-accent)' }}>
              RUN SCENARIO →
            </button>
            <p className="text-[10px] leading-snug" style={{ color: 'var(--app-text-faint)' }}>
              Simulation is read-only. The live factory keeps running underneath and is never modified by a scenario.
            </p>
          </div>
        </Panel>

        {/* -------------------------------------------------------- result -- */}
        <div className="flex flex-col gap-4">
          {!ran ? (
            <Panel label="Impact">
              <div className="flex h-[260px] flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
                  Pick a scenario and run it
                </p>
                <p className="max-w-[420px] text-[11.5px] leading-relaxed" style={{ color: 'var(--app-text-faint)' }}>
                  The scenario is resolved against the factory exactly as it stands right now, then propagated through production, equipment,
                  maintenance, materials, quality, utilities and workforce.
                </p>
              </div>
            </Panel>
          ) : (
            <>
              <Panel
                label={`Scenario Result — ${cascade.title}`}
                action={
                  <span className="flex items-center gap-2 text-[10px] font-bold">
                    {criticalCount > 0 && <span style={{ color: 'var(--app-danger)' }}>◆ {criticalCount} CRITICAL</span>}
                    {warningCount > 0 && <span style={{ color: 'var(--app-warning)' }}>△ {warningCount} WARNING</span>}
                  </span>
                }
              >
                <div className="flex flex-col gap-3 p-4">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
                    {cascade.summary}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Reasoning label="What is happening" text={cascade.whatIsHappening} />
                    <Reasoning label="Why is it happening" text={cascade.whyIsItHappening} />
                    <Reasoning label="What will happen next" text={cascade.whatWillHappenNext} />
                    <Reasoning label="What should we do" text={cascade.whatShouldWeDo} accent />
                  </div>
                </div>
              </Panel>

              <Panel label="Cross-Module Impact" action={<span className="label">{cascade.impacts.length} effects</span>}>
                <div className="flex flex-col">
                  {grouped.map(([moduleLabel, impacts]) => (
                    <div key={moduleLabel} style={{ borderBottom: '1px solid var(--app-border)' }}>
                      <div className="px-4 pb-1 pt-3">
                        <span className="label">{moduleLabel}</span>
                      </div>
                      {impacts.map((impact, i) => {
                        const sev = SEVERITY_STYLE[impact.severity]
                        return (
                          <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                            <span className="mt-0.5 flex-shrink-0 text-[11px]" style={{ color: sev.color }} aria-hidden="true">
                              {sev.glyph}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
                                {impact.headline}
                              </div>
                              <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                                {impact.detail}
                              </div>
                              {impact.kpi && (
                                <div className="tnum mt-1.5 flex items-center gap-2 text-[11px]">
                                  <span style={{ color: 'var(--app-text-faint)' }}>{impact.kpi.label}</span>
                                  <span style={{ color: 'var(--app-text-muted)' }}>{impact.kpi.before}</span>
                                  <span style={{ color: 'var(--app-text-faint)' }}>→</span>
                                  <span style={{ color: sev.color }}>{impact.kpi.after}</span>
                                </div>
                              )}
                            </div>
                            {impact.link && (
                              <button
                                onClick={() => navigate(impact.link!.to)}
                                className="flex-shrink-0 whitespace-nowrap text-[10px] font-bold"
                                style={{ color: 'var(--app-info)', letterSpacing: '0.05em' }}
                              >
                                {impact.link.label}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Reasoning({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: 'var(--app-surface-soft)',
        border: `1px solid ${accent ? 'var(--app-accent-border)' : 'var(--app-border)'}`,
      }}
    >
      <p className="label mb-1" style={accent ? { color: 'var(--app-accent)' } : undefined}>
        {label}
      </p>
      <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
        {text}
      </p>
    </div>
  )
}
