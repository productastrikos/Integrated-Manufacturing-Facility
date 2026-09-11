import { StateChip } from '../components/ui'

/**
 * A fixed reference card for the status colors used throughout the 3D
 * scene — moved out of the Facility Overview sidebar (where it only
 * existed when nothing was selected) into a permanent corner of the
 * viewport itself, since it's a reading aid for the 3D scene and should
 * stay visible no matter what's selected.
 */
export function StatusLegend() {
  return (
    <div
      className="absolute bottom-3 right-3 rounded-lg px-3 py-2.5 backdrop-blur-sm"
      style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 90%, transparent)' }}
    >
      <p className="label mb-1.5">Status Legend</p>
      <div className="flex flex-col gap-1.5">
        {(['running', 'warning', 'critical', 'maintenance', 'idle'] as const).map((s) => (
          <StateChip key={s} status={s} />
        ))}
      </div>
    </div>
  )
}
