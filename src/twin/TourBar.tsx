import type { FacilityTour } from './useFacilityTour'

/**
 * The guided tour's floating control bar — current stop, progress dots,
 * and play/pause/step/exit. Only rendered while a tour is active.
 */
export function TourBar({ tour }: { tour: FacilityTour }) {
  if (!tour.active || !tour.currentStop) return null
  const stop = tour.currentStop

  return (
    <div
      className="absolute bottom-3 left-1/2 flex w-[min(560px,calc(100%-24px))] -translate-x-1/2 flex-col gap-2 rounded-lg px-4 py-3 backdrop-blur-sm"
      style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 94%, transparent)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="label" style={{ color: 'var(--twin-amber)' }}>
              Guided Tour
            </span>
            <span className="tnum text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              {tour.index + 1} / {tour.total}
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
            {stop.title}
          </p>
          <p className="truncate text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
            {stop.caption}
          </p>
        </div>

        <button className="app-btn h-7 shrink-0 px-2.5 text-[10.5px]" onClick={tour.stop}>
          Exit Tour
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="app-btn h-7 w-7 shrink-0 !px-0 text-[12px]"
          onClick={tour.prev}
          disabled={tour.index === 0}
          title="Previous stop"
        >
          ‹
        </button>
        <button
          className="app-btn h-7 flex-1 px-2 text-[10.5px]"
          style={{ borderColor: 'var(--twin-amber)', color: 'var(--twin-amber)' }}
          onClick={tour.togglePause}
        >
          {tour.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          className="app-btn h-7 w-7 shrink-0 !px-0 text-[12px]"
          onClick={tour.next}
          disabled={tour.isLastStop}
          title="Next stop"
        >
          ›
        </button>
      </div>

      {/* progress dots — one per stop, filled up to the current one */}
      <div className="flex items-center gap-1">
        {Array.from({ length: tour.total }).map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{ background: i <= tour.index ? 'var(--twin-amber)' : 'var(--app-border)' }}
          />
        ))}
      </div>
    </div>
  )
}
