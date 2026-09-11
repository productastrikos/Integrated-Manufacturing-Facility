/**
 * The same "this is a hypothetical, not real data" flag the Digital Twin
 * shows as a floating label on its pulsing ring — reused wherever a real
 * table row happens to be the subject of the currently-run scenario (the
 * Materials table, the Equipment/Work Orders list), so the preview is
 * visible everywhere that row appears, not only on the Simulation page and
 * the Twin. It never changes the row's real numbers — see
 * `scenarioAlertState.ts` for why the simulator is not allowed to.
 */
export function ScenarioRowBadge({ note }: { note: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{ color: 'var(--app-danger)', border: '1px solid var(--app-danger-border)', background: 'var(--app-danger-bg)' }}
      title={note}
    >
      <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--app-danger)' }} aria-hidden="true" />
      Scenario Preview
    </span>
  )
}
