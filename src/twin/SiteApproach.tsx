import { useMemo } from 'react'
import { MATERIAL_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, getNeutralMaterial } from './geometries'
import { buildingLayoutById } from './layout'

/**
 * The parts of the campus that make it read as a working site rather than
 * a set of buildings on a plane: visitor and employee parking, the gate
 * approach with boom barriers, road markings, and the logistics yard —
 * trucks at the loading docks and a forklift moving pallets.
 *
 * Everything here is fixed context. None of it is selectable or live, so it
 * costs one render and never re-renders on a simulation tick.
 */

const HAZARD = getNeutralMaterial(MATERIAL_HEX.hazard, 0.9, 0)
const LINE_PAINT = getNeutralMaterial(0x8b95a0, 0.95, 0)

export function SiteApproach() {
  return (
    <group>
      <GateApproach />
      <ParkingArea center={[-24, 44]} rows={2} bays={9} label="visitor" />
      <ParkingArea center={[26, 46]} rows={2} bays={11} label="employee" />
      <LoadingYard />
      <RoadMarkings />
    </group>
  )
}

/** Boom barriers, pedestrian gate and the guard island at the main entrance. */
function GateApproach() {
  return (
    <group>
      {/* entry and exit boom barriers either side of the gatehouse */}
      {[-3.4, 3.4].map((x) => (
        <group key={x} position={[x, 0, 47]}>
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.4, 1.1, 0.4]} position={[0, 0.55, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={HAZARD} scale={[0.12, 0.12, 5.4]} position={[0, 1.05, x > 0 ? 2.6 : -2.6]} rotation={[0, 0, 0]} />
        </group>
      ))}

      {/* guard island between the lanes */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[1.6, 0.24, 8]} position={[0, 0.12, 47]} />

      {/* pedestrian gate + turnstile to one side */}
      <group position={[-7.5, 0, 47]}>
        <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.1, 0.1, 2.4]} position={[0, 1.2, -1.2]} />
        <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.1, 0.1, 2.4]} position={[0, 1.2, 1.2]} />
        <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.9, 1, 0.14]} position={[0, 1, 0]} />
      </group>

      {/* approach kerbs */}
      {[-5.4, 5.4].map((x) => (
        <mesh key={x} geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[0.5, 0.2, 20]} position={[x, 0.1, 47]} />
      ))}
    </group>
  )
}

/** A parking area drawn as painted bays with a few parked vehicles. */
function ParkingArea({ center, rows, bays, label }: { center: [number, number]; rows: number; bays: number; label: string }) {
  const bayW = 2.6
  const bayD = 5

  // Deterministic occupancy so the yard looks used without flickering between renders.
  const occupied = useMemo(() => {
    const seed = label === 'visitor' ? 7 : 13
    const out: boolean[] = []
    for (let i = 0; i < rows * bays; i++) out.push((i * seed) % 3 !== 0)
    return out
  }, [rows, bays, label])

  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh geometry={UNIT_BOX} material={MATERIALS.road} scale={[bays * bayW + 2, 0.04, rows * bayD + 3]} position={[0, 0.03, 0]} receiveShadow />
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: bays + 1 }).map((__, b) => (
          <mesh
            key={`${r}-${b}`}
            geometry={UNIT_BOX}
            material={LINE_PAINT}
            scale={[0.1, 0.02, bayD]}
            position={[-((bays * bayW) / 2) + b * bayW, 0.06, -(rows * bayD) / 2 + r * bayD + bayD / 2]}
          />
        )),
      )}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: bays }).map((__, b) => {
          const i = r * bays + b
          if (!occupied[i]) return null
          return (
            <ParkedCar
              key={`c-${r}-${b}`}
              position={[-((bays * bayW) / 2) + b * bayW + bayW / 2, 0, -(rows * bayD) / 2 + r * bayD + bayD / 2]}
            />
          )
        }),
      )}
    </group>
  )
}

function ParkedCar({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[1.9, 0.7, 4.2]} position={[0, 0.55, 0]} castShadow />
      <mesh geometry={UNIT_BOX} material={MATERIALS.glass} scale={[1.75, 0.55, 1.9]} position={[0, 1.15, -0.2]} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            geometry={UNIT_CYLINDER}
            material={MATERIALS.steelDark}
            scale={[0.3, 0.3, 0.22]}
            position={[sx * 0.85, 0.3, sz * 1.4]}
            rotation={[0, 0, Math.PI / 2]}
          />
        )),
      )}
    </group>
  )
}

/** Trucks at the dispatch docks plus a forklift working the yard. */
function LoadingYard() {
  const load = buildingLayoutById('BLD-LOAD')
  if (!load) return null
  const [cx, cz] = load.center
  const [, d] = load.size

  return (
    <group position={[cx, 0, cz + d / 2 + 6]}>
      {/* dock apron */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.road} scale={[26, 0.04, 16]} position={[0, 0.03, 4]} receiveShadow />

      {/* staged pallets waiting to be loaded */}
      {[-2, 0, 2].map((k) => (
        <group key={k} position={[k * 1.4 - 10, 0, 7]}>
          <mesh geometry={UNIT_BOX} material={MATERIALS.pallet} scale={[1.1, 0.16, 1.1]} position={[0, 0.08, 0]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.rack} scale={[1, 0.8, 1]} position={[0, 0.56, 0]} castShadow />
        </group>
      ))}
    </group>
  )
}

/** Centre lines and crossings on the internal roads. */
function RoadMarkings() {
  const dashes = useMemo(() => {
    const out: [number, number, number][] = []
    for (let z = 38; z < 56; z += 3) out.push([0, 0.06, z])
    for (let x = -18; x < 50; x += 3) out.push([x, 0.06, 20])
    return out
  }, [])

  return (
    <group>
      {dashes.map((p, i) => (
        <mesh key={i} geometry={UNIT_BOX} material={LINE_PAINT} scale={i < 6 ? [0.16, 0.02, 1.6] : [1.6, 0.02, 0.16]} position={p} />
      ))}
      {/* pedestrian crossing on the main spine */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`cw-${i}`} geometry={UNIT_BOX} material={LINE_PAINT} scale={[0.4, 0.02, 5.6]} position={[-14 + i * 0.9, 0.06, 20]} />
      ))}
    </group>
  )
}
