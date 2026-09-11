import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CameraRig } from '../twin/CameraRig'
import { WalkControls } from '../twin/WalkControls'
import { FACTORY_OVERVIEW, INTRO_START, TOP_VIEW, presetForSelection } from '../twin/cameraPresets'
import { FacilityScene } from '../twin/FacilityScene'
import { FLOOR_LAYOUTS, selectionIsIndoors } from '../twin/facilityLayout'
import { parseFocusParam, parseTourParam } from '../twin/focusLink'
import { InfoPanel } from '../twin/InfoPanel'
import { Minimap } from '../twin/Minimap'
import { StatusLegend } from '../twin/StatusLegend'
import { TourBar } from '../twin/TourBar'
import { FloorSelector, TwinControls } from '../twin/TwinControls'
import { SelectionContext, type FloorMode, type Selection, type SelectionKind, type TimeOfDay, type ViewMode } from '../twin/selection'
import { StatusBar } from '../twin/StatusBar'
import { useFacilityTour } from '../twin/useFacilityTour'
import { useSimulation } from '../simulation/useSimulation'
import { SKY } from '../twin/colors'

export default function DigitalTwin() {
  const [searchParams] = useSearchParams()
  // Arriving from "View in Digital Twin" elsewhere in the app — e.g.
  // Operations → a production line — lands focused on that object.
  const initialSelection = useState<Selection>(() => parseFocusParam(searchParams.toString()))[0]
  const [selection, setSelection] = useState<Selection>(initialSelection)
  // The building is closed by default — the user opens it deliberately. A
  // deep link that lands on something indoors opens it on arrival.
  const [cutaway, setCutaway] = useState(
    () => !!initialSelection && selectionIsIndoors(initialSelection.kind, initialSelection.id),
  )
  const [topView, setTopView] = useState(false)
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null)
  const [floorMode, setFloorMode] = useState<FloorMode>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('orbit')
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day')
  const state = useSimulation()

  const select = useCallback((kind: SelectionKind, id: string) => {
    setSelection({ kind, id })
    setTopView(false) // focusing an object always drops out of the top-down overview
    // Focusing something indoors opens the building. Without this the camera
    // flies to the right spot but lands behind a closed facade, which reads
    // as a broken link rather than as a deliberate exterior view.
    if (selectionIsIndoors(kind, id)) setCutaway(true)
  }, [])

  const clear = useCallback(() => setSelection(null), [])

  const reset = useCallback(() => {
    setSelection(null)
    setTopView(false)
    setActiveFloorId(null)
    setFloorMode('all')
    setViewMode('orbit')
  }, [])

  const tour = useFacilityTour({ select, clear, setActiveFloorId, setFloorMode, setCutaway, setTopView, setViewMode, viewMode })

  // A "?tour=" query param — e.g. from Procurement's "Walk the Material
  // Flow" link — starts that guided tour on arrival, once, rather than
  // just landing on a single focused object.
  useEffect(() => {
    const requestedTour = parseTourParam(searchParams.toString())
    if (requestedTour) tour.start(requestedTour)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      selection,
      select,
      clear,
      cutaway,
      setCutaway,
      topView,
      setTopView,
      activeFloorId,
      setActiveFloorId,
      floorMode,
      setFloorMode,
      viewMode,
      setViewMode,
      timeOfDay,
      setTimeOfDay,
    }),
    [selection, select, clear, cutaway, topView, activeFloorId, floorMode, viewMode, timeOfDay],
  )

  const preset = selection ? presetForSelection(selection) : topView ? TOP_VIEW : FACTORY_OVERVIEW

  return (
    <SelectionContext.Provider value={value}>
      <div className="flex h-full flex-col gap-3">
        <StatusBar />

        <div className="flex min-h-0 flex-1 gap-3">
          <div className="glass-panel relative min-w-0 flex-1 overflow-hidden">
            <Canvas
              shadows="soft"
              dpr={[1, 1.75]}
              // Starts wide and high (INTRO_START), not at the default
              // overview position — CameraRig's normal transition system
              // then carries the camera from here into FACTORY_OVERVIEW as
              // a single slow cinematic dolly-in on first load.
              camera={{ position: INTRO_START.position, fov: 42, near: 0.5, far: 500 }}
              gl={{ antialias: true }}
              onPointerMissed={clear}
            >
              <color attach="background" args={[SKY[timeOfDay].bg]} />
              {/* Fog starts inside the site's own footprint, not beyond it —
                  otherwise it never actually becomes visible from a normal
                  camera distance and reads as a hard edge instead of haze. */}
              <fog attach="fog" args={[SKY[timeOfDay].bg, SKY[timeOfDay].fogNear, SKY[timeOfDay].fogFar]} />
              <Suspense fallback={null}>
                <FacilityScene />
              </Suspense>
              {/* Exactly one control scheme is mounted at a time — swapping
                  them is what makes "makeDefault" hand over cleanly. */}
              {viewMode === 'walk' ? <WalkControls onExit={() => setViewMode('orbit')} /> : <CameraRig preset={preset} />}
              {/* Subtle bloom so the status lights' emissive glow actually
                  blooms instead of reading as flat saturated color. Kept
                  restrained (low intensity, a fairly high luminance
                  threshold) — it should catch the glow, not wash the scene.
                  Turned up a little at night, where the facility's own
                  lights (not the sun) are what should read as bright. */}
              <EffectComposer multisampling={0}>
                <Bloom
                  luminanceThreshold={timeOfDay === 'night' ? 0.28 : 0.75}
                  luminanceSmoothing={0.9}
                  intensity={timeOfDay === 'night' ? 0.75 : 0.32}
                  mipmapBlur
                  radius={0.5}
                />
              </EffectComposer>
            </Canvas>

            <Breadcrumb selection={selection} state={state} onSelect={select} onClear={clear} activeFloorId={activeFloorId} />
            <TwinControls onReset={reset} tour={tour} />
            <FloorSelector />
            <Minimap />
            <StatusLegend />
            <TourBar tour={tour} />
          </div>

          <div className="w-[320px] shrink-0 overflow-y-auto">
            <InfoPanel />
          </div>
        </div>
      </div>
    </SelectionContext.Provider>
  )
}

function Breadcrumb({
  selection,
  state,
  onSelect,
  onClear,
  activeFloorId,
}: {
  selection: Selection
  state: ReturnType<typeof useSimulation>
  onSelect: (kind: SelectionKind, id: string) => void
  onClear: () => void
  activeFloorId: string | null
}) {
  const crumbs: { label: string; onClick: () => void }[] = [{ label: state.site.name, onClick: onClear }]

  if (selection && selection.kind !== 'site') {
    const eq = selection.kind === 'equipment' ? state.equipment[selection.id] : null
    const line = selection.kind === 'line' ? state.lines.find((l) => l.id === selection.id) : eq ? state.lines.find((l) => l.id === eq.lineId) : null
    const area = selection.kind === 'area' ? state.areas.find((a) => a.id === selection.id) : line ? state.areas.find((a) => a.id === line.areaId) : null

    // BMS / camera / safety assets hang off a building directly rather than
    // off the production hierarchy, so resolve their building separately.
    const asset =
      selection.kind === 'bms'
        ? state.bmsAssets.find((a) => a.id === selection.id)
        : selection.kind === 'safety'
          ? state.safetyAssets.find((a) => a.id === selection.id)
          : null
    const cam = selection.kind === 'camera' ? state.security.cameras.find((c) => c.id === selection.id) : null
    const room = selection.kind === 'room' ? state.rooms.find((r) => r.id === selection.id) : null
    const vehicle = selection.kind === "vehicle" ? state.vehicles.find((v) => v.id === selection.id) : null
    const stage = selection.kind === "stage" ? state.valueChain.find((s) => s.id === selection.id) : null

    // Value-chain plots sit on the campus alongside the buildings, so they
    // get an Operations trail rather than a building hierarchy.
    if (stage) {
      crumbs.push({ label: "Operations", onClick: () => onClear() })
      crumbs.push({ label: stage.name, onClick: () => onSelect("stage", stage.id) })
      return <BreadcrumbBar crumbs={crumbs} selection={selection} onClear={onClear} />
    }

    // Vehicles are site-level assets — they sit on the campus, not inside a
    // building — so they get their own short trail rather than the building
    // → floor → area chain.
    if (vehicle) {
      crumbs.push({ label: 'Logistics', onClick: () => onClear() })
      crumbs.push({ label: vehicle.id, onClick: () => onSelect('vehicle', vehicle.id) })
      return <BreadcrumbBar crumbs={crumbs} selection={selection} onClear={onClear} />
    }

    const floor =
      selection.kind === 'floor'
        ? FLOOR_LAYOUTS.find((f) => f.floor.id === selection.id)?.floor
        : room
          ? state.floors.find((f) => f.id === room.floorId)
          : asset
            ? state.floors.find((f) => f.id === asset.floorId)
            : area || line || eq
              ? state.floors.find((f) => f.id === (activeFloorId ?? 'FLR-G'))
              : null

    const buildingId =
      selection.kind === 'building'
        ? selection.id
        : room?.buildingId ?? asset?.buildingId ?? cam?.buildingId ?? (floor?.buildingId || area?.buildingId) ?? 'BLD-PROD'
    const building = state.buildings.find((b) => b.id === buildingId)

    if (building) crumbs.push({ label: building.name, onClick: () => onSelect('building', building.id) })
    if (floor) crumbs.push({ label: floor.name, onClick: () => onSelect('floor', floor.id) })
    if (room) crumbs.push({ label: room.name, onClick: () => onSelect('room', room.id) })
    if (area) crumbs.push({ label: area.name, onClick: () => onSelect('area', area.id) })
    if (line) crumbs.push({ label: line.name, onClick: () => onSelect('line', line.id) })
    if (eq) crumbs.push({ label: eq.id, onClick: () => onSelect('equipment', eq.id) })
    if (asset) crumbs.push({ label: asset.id, onClick: () => onSelect(selection.kind, asset.id) })
    if (cam) crumbs.push({ label: cam.id, onClick: () => onSelect('camera', cam.id) })
  }

  return <BreadcrumbBar crumbs={crumbs} selection={selection} onClear={onClear} />
}

function BreadcrumbBar({
  crumbs,
  selection,
  onClear,
}: {
  crumbs: { label: string; onClick: () => void }[]
  selection: Selection
  onClear: () => void
}) {
  return (
    <div
      className="absolute left-3 top-3 flex max-w-[calc(100%-360px)] flex-wrap items-center gap-1 rounded-lg px-2.5 py-1.5 backdrop-blur-sm"
      style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 90%, transparent)' }}
    >
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
              ▸
            </span>
          )}
          <button className="text-[11px]" style={{ color: 'var(--app-text-muted)' }} onClick={c.onClick}>
            {c.label}
          </button>
        </span>
      ))}
      {selection && (
        <button className="app-btn ml-2 h-6 px-2 text-[10.5px]" onClick={onClear}>
          Factory Overview
        </button>
      )}
    </div>
  )
}
