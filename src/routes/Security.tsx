import { CameraFeedPlayer } from '../components/CameraFeedPlayer'
import { ICONS, Icon, KpiTile, Panel } from '../components/ui'
import { ViewInTwin } from '../components/ViewInTwin'
import { useSimulation } from '../simulation/useSimulation'
import { buildSecurityDetailLists } from '../lib/securityDetails'

const DECISION_STYLE = {
  granted: { chip: 'status-chip-success', glyph: '●' },
  denied: { chip: 'status-chip-warning', glyph: '◆' },
  tailgate: { chip: 'status-chip-danger', glyph: '▲' },
} as const

export function SecurityBody() {
  const state = useSimulation()
  const { security, safetySecurity } = state
  const detail = buildSecurityDetailLists(security)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="label mb-3">Access Control</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiTile
            icon={<Icon d={ICONS.users} />}
            label="Employees Inside"
            value={security.employeesInside}
            description="Badged-in personnel currently on site."
            detailList={detail.employeesInside}
            roadmap={[]}
          />
          <KpiTile icon={<Icon d={ICONS.user} />} label="Visitors" value={security.visitors} description="Registered visitors currently on site." detailList={detail.visitors} roadmap={[]} />
          <KpiTile
            icon={<Icon d={ICONS.target} />}
            label="Access Attempts"
            value={security.accessEvents.length}
            sub="rolling log"
            description="Access events recorded in the current rolling window."
            detailList={detail.accessAttempts}
            roadmap={[]}
          />
          <KpiTile
            icon={<Icon d={ICONS.ban} />}
            label="Restricted Access Events"
            value={security.accessEvents.filter((e) => e.decision !== 'granted').length}
            tone={security.accessEvents.some((e) => e.decision === 'tailgate') ? 'crit' : security.accessEvents.some((e) => e.decision === 'denied') ? 'warn' : 'ok'}
            description="Denied or tailgate events in the current rolling window."
            detailList={detail.restrictedAccessEvents}
            roadmap={
              security.accessEvents.some((e) => e.decision === 'tailgate')
                ? ['Review the tailgate event(s) below and confirm the second badge holder with the zone owner.', 'Remind the team on-shift that each entry needs its own scan.']
                : security.accessEvents.some((e) => e.decision === 'denied')
                  ? ['Confirm each denied badge holder has current, correct access rights if this recurs.']
                  : []
            }
          />
          <KpiTile
            icon={<Icon d={ICONS.door} />}
            label="Door Status"
            value={`${security.doorsOpen} / ${security.doorsTotal}`}
            sub="open"
            description="Doors currently open versus total monitored doors."
            detailList={detail.doorStatus}
            roadmap={[]}
          />
          <KpiTile
            icon={<Icon d={ICONS.clipboard} />}
            label="Badge Events"
            value={security.accessEvents.length}
            sub="session log"
            description="Badge scans recorded across all doors."
            detailList={detail.badgeEvents}
            roadmap={[]}
          />
          <KpiTile
            icon={<Icon d={ICONS.trend} />}
            label="Gate Activity"
            value={security.gateActivityCount}
            sub="session log"
            description="Badge events specifically at the main gate."
            detailList={detail.gateActivity}
            roadmap={[]}
          />
          <KpiTile
            icon={<Icon d={ICONS.lock} />}
            label="Access Violations"
            value={safetySecurity.accessViolations}
            tone={safetySecurity.accessViolations > 0 ? 'crit' : 'ok'}
            description="Confirmed unauthorized access attempts."
            detailList={detail.accessViolations}
            roadmap={safetySecurity.accessViolations > 0 ? ['Identify the confirmed tailgate event(s) below and follow up with both badge holders.', 'Log the outcome with Security for the shift handover.'] : []}
          />
        </div>
      </section>

      <Panel label="Recent Access Events" action={<span className="label">{security.accessEvents.length} in window</span>}>
        {security.accessEvents.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-[12.5px]" style={{ color: 'var(--app-text-faint)' }}>
            No access events recorded yet this session.
          </div>
        ) : (
          <ul>
            {security.accessEvents.map((e) => {
              const style = DECISION_STYLE[e.decision]
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <span aria-hidden="true" className="text-[11px]" style={{ color: style.chip.includes('danger') ? 'var(--app-danger)' : style.chip.includes('warning') ? 'var(--app-warning)' : 'var(--app-success)' }}>
                    {style.glyph}
                  </span>
                  <span className="tnum shrink-0 font-[family-name:var(--font-mono)] text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
                    {e.at}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-[12.5px]" style={{ color: 'var(--app-text)' }}>
                      {e.person}
                    </span>
                    <span className="ml-2 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
                      {e.door}
                    </span>
                  </div>
                  <span className={`status-chip shrink-0 ${style.chip}`}>{e.decision}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <section>
        <p className="label mb-3">CCTV</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {security.cameras.map((c) => (
            <div key={c.id} className="glass-panel overflow-hidden">
              <div className="p-3 pb-0">
                <CameraFeedPlayer cameraId={c.id} online={c.status === 'online'} location={c.name} />
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--app-text)' }}>
                    {c.name}
                  </div>
                  <div className="label mt-0.5">
                    {c.id} · {c.lastEventAt ? `last event ${c.lastEventAt}` : 'no events yet'}
                  </div>
                </div>
                <span className={`status-chip ${c.status === 'online' ? 'status-chip-success' : 'status-chip-neutral'}`}>{c.status}</span>
              </div>
              <div className="flex justify-end px-3 pb-3">
                <ViewInTwin kind="camera" id={c.id} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
