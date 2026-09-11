import { useEffect, useMemo, useRef, useState } from 'react'
import { FLOOR_LAYOUTS } from './facilityLayout'
import { searchTwin, type TwinSearchResult } from './searchIndex'
import { useSelection } from './selection'
import { TOUR_LABEL, type TourId } from './tourStops'
import type { FacilityTour } from './useFacilityTour'

/**
 * The Digital Twin's control surface: view mode, cutaway, top view, floor
 * isolation, asset search, the guided tour, and reset. Everything is a
 * small toggle in the existing button language — the 3D scene is the
 * subject, so the chrome stays quiet.
 */
export function TwinControls({ onReset, tour }: { onReset: () => void; tour: FacilityTour }) {
  const { cutaway, setCutaway, topView, setTopView, viewMode, setViewMode, selection, timeOfDay, setTimeOfDay } = useSelection()
  const [searchOpen, setSearchOpen] = useState(false)
  const [tourMenuOpen, setTourMenuOpen] = useState(false)

  return (
    <>
      <div
        className="absolute right-3 top-3 flex max-w-[calc(100%-24px)] flex-wrap items-center justify-end gap-1.5 rounded-lg px-2 py-1.5 backdrop-blur-sm"
        style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 92%, transparent)' }}
      >
        <ToggleButton
          active={tour.active || tourMenuOpen}
          onClick={() => (tour.active ? tour.stop() : setTourMenuOpen((v) => !v))}
          title="Guided walkthroughs of the facility"
        >
          {tour.active ? 'Stop Tour' : 'Tour ▾'}
        </ToggleButton>

        <Divider />

        <ToggleButton active={viewMode === 'orbit'} onClick={() => setViewMode('orbit')} title="Orbit, pan and zoom around the facility">
          Orbit
        </ToggleButton>
        <ToggleButton active={viewMode === 'walk'} onClick={() => setViewMode('walk')} title="Walk through the facility in first person (WASD to move, Esc to exit)">
          Walk
        </ToggleButton>

        <Divider />

        <ToggleButton active={cutaway} onClick={() => setCutaway(!cutaway)} title="Remove roofs and outer walls to see inside the buildings">
          Cutaway
        </ToggleButton>
        <ToggleButton
          active={topView}
          onClick={() => setTopView(!topView)}
          disabled={!!selection || viewMode === 'walk'}
          title={selection ? 'Clear the selection to use Top View' : 'Straight-down floor-plan view'}
        >
          Top View
        </ToggleButton>

        <Divider />

        <ToggleButton
          active={timeOfDay === 'night'}
          onClick={() => setTimeOfDay(timeOfDay === 'day' ? 'night' : 'day')}
          title="Switch between daylight and night lighting"
        >
          {timeOfDay === 'day' ? '☀ Day' : '☾ Night'}
        </ToggleButton>

        <Divider />

        <ToggleButton active={searchOpen} onClick={() => setSearchOpen((v) => !v)} title="Search buildings, floors, lines, equipment, BMS assets, cameras and safety assets">
          Search
        </ToggleButton>
        <ToggleButton
          active={false}
          onClick={() => {
            if (tour.active) tour.stop()
            onReset()
          }}
          title="Return to the full facility overview"
        >
          Reset
        </ToggleButton>
      </div>

      {tourMenuOpen && !tour.active && (
        <TourMenu
          onPick={(id) => {
            tour.start(id)
            setTourMenuOpen(false)
          }}
          onClose={() => setTourMenuOpen(false)}
        />
      )}
      {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
      {viewMode === 'walk' && !tour.active && <WalkHelp />}
    </>
  )
}

/** Picker for which guided tour to run. */
function TourMenu({ onPick, onClose }: { onPick: (id: TourId) => void; onClose: () => void }) {
  const options: TourId[] = ['facility', 'material-flow']
  return (
    <div
      className="absolute right-3 top-[52px] w-[280px] rounded-lg p-1.5 backdrop-blur-sm"
      style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 96%, transparent)' }}
    >
      {options.map((id) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          className="block w-full rounded px-2.5 py-2 text-left text-[12px] hover:bg-[var(--app-border-soft)]"
          style={{ color: 'var(--app-text)' }}
        >
          {TOUR_LABEL[id]}
        </button>
      ))}
      <button onClick={onClose} className="mt-0.5 block w-full rounded px-2.5 py-1.5 text-left text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
        Cancel
      </button>
    </div>
  )
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px" style={{ background: 'var(--app-border)' }} />
}

function ToggleButton({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      className="app-btn h-6 px-2 text-[10.5px] disabled:cursor-not-allowed disabled:opacity-40"
      style={active ? { borderColor: 'var(--twin-amber)', color: 'var(--twin-amber)' } : undefined}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}

/* --------------------------------------------------------- floor selector - */

/** Level picker for the production building, with an isolate/show-all switch. */
export function FloorSelector() {
  const { activeFloorId, setActiveFloorId, floorMode, setFloorMode, setCutaway, select } = useSelection()

  function pick(floorId: string) {
    // Picking a level takes the user INSIDE it: isolate the level, open the
    // building envelope, and move the camera onto the floor. Without the
    // cutaway the camera lands behind a solid facade and the user just sees
    // a wall, which is not "entering" anything.
    setActiveFloorId(floorId)
    setFloorMode('isolate')
    setCutaway(true)
    select('floor', floorId)
  }

  function showAll() {
    // Leaving a level returns the building to its closed exterior.
    setActiveFloorId(null)
    setFloorMode('all')
    setCutaway(false)
  }

  return (
    <div
      className="absolute right-3 top-[52px] flex flex-col gap-1 rounded-lg px-2 py-2 backdrop-blur-sm"
      style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 92%, transparent)' }}
    >
      <div className="label px-0.5 pb-0.5">Floors</div>
      {[...FLOOR_LAYOUTS].reverse().map((f) => {
        const active = floorMode === 'isolate' && activeFloorId === f.floor.id
        return (
          <button
            key={f.floor.id}
            className="app-btn flex h-6 items-center gap-2 px-1.5 text-[10.5px]"
            style={active ? { borderColor: 'var(--twin-amber)', color: 'var(--twin-amber)' } : undefined}
            onClick={() => pick(f.floor.id)}
            title={f.floor.description}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold"
              style={{ background: active ? 'var(--twin-amber)' : 'var(--app-border)', color: active ? '#1a1a1a' : 'var(--app-text-muted)' }}
            >
              {f.floor.shortLabel}
            </span>
            <span className="pr-0.5">{f.floor.name}</span>
          </button>
        )
      })}
      <button
        className="app-btn h-6 px-1.5 text-[10.5px]"
        style={floorMode === 'all' ? { borderColor: 'var(--twin-amber)', color: 'var(--twin-amber)' } : undefined}
        onClick={showAll}
        title="Show every level at once"
      >
        All Floors
      </button>
    </div>
  )
}

/* ---------------------------------------------------------- search panel - */

function SearchPanel({ onClose }: { onClose: () => void }) {
  const { select } = useSelection()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchTwin(query), [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function choose(r: TwinSearchResult) {
    // Selecting drives both the highlight and the camera focus, so a search
    // hit lands the user on the object rather than just naming it.
    select(r.kind, r.id)
    onClose()
  }

  return (
    <div
      className="absolute right-3 top-[52px] w-[300px] rounded-lg backdrop-blur-sm"
      style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 96%, transparent)' }}
    >
      <div className="p-2">
        <input
          ref={inputRef}
          className="field h-8 text-[12px]"
          placeholder="Search the Digital Twin…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && results[0]) choose(results[0])
          }}
        />
      </div>

      {query && (
        <div className="max-h-[320px] overflow-y-auto border-t px-1 pb-1" style={{ borderColor: 'var(--app-border)' }}>
          {results.length === 0 && <p className="px-2 py-3 text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>No matching assets.</p>}
          {results.map((r) => (
            <button
              key={`${r.kind}-${r.id}`}
              className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-[var(--app-border-soft)]"
              onClick={() => choose(r)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-[12px]" style={{ color: 'var(--app-text)' }}>
                  {r.label}
                </span>
                <span className="label shrink-0">{r.category}</span>
              </span>
              <span className="truncate text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                {r.context}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** On-screen key hints while walk mode is active. */
function WalkHelp() {
  return (
    <div
      className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg px-3 py-1.5 backdrop-blur-sm"
      style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 92%, transparent)' }}
    >
      <p className="text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>
        <b>Click</b> to look · <b>W A S D</b> move · <b>Shift</b> faster · <b>Esc</b> exit walk mode
      </p>
    </div>
  )
}
