import { useCallback, useEffect, useRef, useState } from 'react'
import { TOUR_STOPS_BY_ID, type TourId, type TourStop } from './tourStops'
import type { FloorMode, SelectionKind, ViewMode } from './selection'

/**
 * Drives a guided tour: a timed walk through one of TOUR_STOPS_BY_ID using
 * the same selection/floor/cutaway state the rest of the twin already
 * understands, so every stop gets the identical camera framing, info
 * panel and breadcrumb a manual click on that object would produce.
 *
 * Lives as a hook rather than inside a component because DigitalTwin.tsx
 * already owns every setter it needs (select, clear, setActiveFloorId,
 * setFloorMode, setCutaway, setViewMode) — no new context, no prop
 * drilling into the scene.
 */
export function useFacilityTour(actions: {
  select: (kind: SelectionKind, id: string) => void
  clear: () => void
  setActiveFloorId: (id: string | null) => void
  setFloorMode: (m: FloorMode) => void
  setCutaway: (v: boolean) => void
  setTopView: (v: boolean) => void
  setViewMode: (m: ViewMode) => void
  viewMode: ViewMode
}) {
  const [active, setActive] = useState(false)
  const [tourId, setTourId] = useState<TourId>('facility')
  const [stops, setStops] = useState<TourStop[]>(TOUR_STOPS_BY_ID.facility)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const goToStop = useCallback(
    (stopList: TourStop[], i: number) => {
      const stop = stopList[i]
      if (!stop) return
      actions.setTopView(false)
      if (stop.floor) {
        actions.setActiveFloorId(stop.floor.activeFloorId)
        actions.setFloorMode(stop.floor.mode)
      } else {
        actions.setActiveFloorId(null)
        actions.setFloorMode('all')
      }
      if (stop.selection) {
        actions.select(stop.selection.kind, stop.selection.id)
      } else {
        actions.clear()
        actions.setCutaway(false)
      }
    },
    // actions is a fresh object every render from the caller; the setters
    // themselves are stable (useCallback/useState setters), so depending
    // on the object would re-create this needlessly. Deliberately narrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // The tour auto-pauses itself if the user leaves Orbit mode (switches to
  // Walk) — its camera moves go through the same preset system Orbit
  // consumes, so it has nothing to drive while Walk mode owns the camera.
  useEffect(() => {
    if (active && actions.viewMode !== 'orbit') setPaused(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.viewMode, active])

  // Advance to the next stop after the current one's dwell time, as long
  // as the tour is active, not paused, and not already on the last stop.
  useEffect(() => {
    clearTimer()
    if (!active || paused) return
    const stop = stops[index]
    if (!stop) return
    if (index >= stops.length - 1) return // last stop: wait for the user, don't loop silently
    timer.current = setTimeout(() => setIndex((i) => i + 1), stop.dwellMs)
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, index, stops])

  // Apply whichever stop is current whenever the tour is active and the
  // index (or the stop list itself) changes, including the very first
  // stop on start.
  useEffect(() => {
    if (!active) return
    goToStop(stops, index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, stops, goToStop])

  const start = useCallback(
    (id: TourId = 'facility') => {
      actions.setViewMode('orbit')
      setTourId(id)
      setStops(TOUR_STOPS_BY_ID[id])
      setIndex(0)
      setPaused(false)
      setActive(true)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions],
  )

  const stop = useCallback(() => {
    clearTimer()
    setActive(false)
    setPaused(false)
    actions.clear()
    actions.setCutaway(false)
    actions.setActiveFloorId(null)
    actions.setFloorMode('all')
  }, [actions])

  const next = useCallback(() => {
    setIndex((i) => Math.min(stops.length - 1, i + 1))
    setPaused(false)
  }, [stops.length])

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
    setPaused(false)
  }, [])

  const togglePause = useCallback(() => {
    setPaused((p) => !p)
  }, [])

  return {
    active,
    paused,
    tourId,
    index,
    total: stops.length,
    currentStop: stops[index] ?? null,
    isLastStop: index >= stops.length - 1,
    start,
    stop,
    next,
    prev,
    togglePause,
  }
}

export type FacilityTour = ReturnType<typeof useFacilityTour>
