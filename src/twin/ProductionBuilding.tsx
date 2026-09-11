import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { ACCENT_HEX, MATERIAL_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, getNeutralMaterial } from './geometries'
import { FLOOR_LAYOUTS, type FloorLayout } from './facilityLayout'
import { PRODUCTION_BUILDING } from './layout'
import { useSelection } from './selection'

/**
 * The main production building — a finished, enclosed industrial structure,
 * not an exposed steel frame. Every level has a solid deck and a ceiling
 * soffit above it, the columns are clad, and the envelope is a real
 * cladded facade with glazing, roller doors and a roof.
 *
 * Cutaway opens the building the way an architectural section model does:
 * the roof and the two camera-facing walls come off, while the decks,
 * ceilings, rooms and columns stay solid. Nothing is ever shown as bare
 * unfinished structure.
 */

const COLUMN_SPACING_X = 12
const COLUMN_SPACING_Z = 13.5

const GLAZING = getNeutralMaterial(MATERIAL_HEX.glass, 0.2, 0.6)
const CLADDING = getNeutralMaterial(0x5b6672, 0.82, 0.08)
const SOFFIT = getNeutralMaterial(0x49525c, 0.9, 0.04)
const DECK_TOP = getNeutralMaterial(0x646f7a, 0.9, 0.02)

/** Semi-transparent wall used for the two far walls in cutaway, so the box still reads as enclosed. */
const GHOST_WALL = new THREE.MeshStandardMaterial({
  color: MATERIAL_HEX.wallLight,
  roughness: 0.85,
  metalness: 0.05,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
})

export function ProductionBuilding() {
  const { selection, select, cutaway, activeFloorId, floorMode } = useSelection()
  const isSelected = selection?.kind === 'building' && selection.id === 'BLD-PROD'
  const [w, d] = PRODUCTION_BUILDING.size
  const [cx, cz] = PRODUCTION_BUILDING.center
  const h = PRODUCTION_BUILDING.height

  const isolating = floorMode === 'isolate' && activeFloorId !== null

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('building', 'BLD-PROD')
  }

  return (
    <group position={[cx, 0, cz]}>
      {/* ground slab — also the click target for the building as a whole */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[w, 0.3, d]} position={[0, 0.15, 0]} onClick={onClick} receiveShadow>
        {isSelected && <Outlines thickness={2.4} color={ACCENT_HEX} transparent opacity={0.9} />}
      </mesh>

      <ColumnGrid w={w} d={d} h={h} />

      {/* every level gets a solid deck plus the ceiling soffit below it */}
      {FLOOR_LAYOUTS.filter((f) => f.floor.level > 0).map((f) => (
        <FloorDeck key={f.floor.id} layout={f} w={w} d={d} isolating={isolating} activeFloorId={activeFloorId} />
      ))}

      <StairCore w={w} d={d} h={h} />
      <FloorMarkings w={w} d={d} />
      <Envelope w={w} d={d} h={h} cutaway={cutaway} />
      {!cutaway && <Roof w={w} d={d} h={h} />}
    </group>
  )
}

/**
 * Structural columns, clad rather than bare steel. Instanced so the whole
 * grid is one draw call; the cap plates at each floor level are a second.
 */
function ColumnGrid({ w, d, h }: { w: number; d: number; h: number }) {
  const positions = useMemo(() => {
    const pts: [number, number][] = []
    const nx = Math.max(1, Math.floor(w / COLUMN_SPACING_X))
    const nz = Math.max(1, Math.floor(d / COLUMN_SPACING_Z))
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        pts.push([-w / 2 + (i * w) / nx, -d / 2 + (j * d) / nz])
      }
    }
    return pts
  }, [w, d])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  function setRef(mesh: THREE.InstancedMesh | null) {
    if (!mesh) return
    positions.forEach(([x, z], i) => {
      dummy.position.set(x, h / 2, z)
      dummy.scale.set(1, h, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  return (
    <instancedMesh ref={setRef} args={[UNIT_BOX, undefined, positions.length]} frustumCulled={false} castShadow receiveShadow>
      <primitive object={CLADDING} attach="material" />
    </instancedMesh>
  )
}

/**
 * One building level: a solid structural deck, a finished floor surface on
 * top and a ceiling soffit hung underneath, so from below you see a
 * ceiling rather than the underside of a bare slab.
 */
function FloorDeck({
  layout,
  w,
  d,
  isolating,
  activeFloorId,
}: {
  layout: FloorLayout
  w: number
  d: number
  isolating: boolean
  activeFloorId: string | null
}) {
  const { selection, select } = useSelection()
  const isSelected = selection?.kind === 'floor' && selection.id === layout.floor.id
  const isActive = activeFloorId === layout.floor.id

  // Isolating a level hides the decks above and below it entirely so the
  // camera has a clear view of the one the user is working on.
  if (isolating && !isActive) return null

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('floor', layout.floor.id)
  }

  const deckW = w - 1
  const deckD = d - 1

  return (
    <group position={[0, layout.elevation, 0]}>
      {/* ceiling soffit for the level below */}
      <mesh geometry={UNIT_BOX} material={SOFFIT} scale={[deckW, 0.18, deckD]} position={[0, -0.55, 0]} />

      {/* structural deck */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.concrete} scale={[deckW, 0.45, deckD]} position={[0, -0.23, 0]} castShadow receiveShadow />

      {/* finished floor surface — the clickable face of this level */}
      <mesh geometry={UNIT_BOX} material={DECK_TOP} scale={[deckW, 0.08, deckD]} position={[0, 0.04, 0]} onClick={onClick} receiveShadow>
        {isSelected && <Outlines thickness={2.2} color={ACCENT_HEX} transparent opacity={0.9} />}
      </mesh>

      {/* perimeter upstand + edge railing, so the deck edge is finished */}
      <EdgeTrim w={deckW} d={deckD} />
    </group>
  )
}

/** Kerb upstand and handrail around a deck edge. */
function EdgeTrim({ w, d }: { w: number; d: number }) {
  const edges: { scale: [number, number, number]; pos: [number, number, number] }[] = [
    { scale: [w, 0.4, 0.25], pos: [0, 0.28, -d / 2] },
    { scale: [w, 0.4, 0.25], pos: [0, 0.28, d / 2] },
    { scale: [0.25, 0.4, d], pos: [-w / 2, 0.28, 0] },
    { scale: [0.25, 0.4, d], pos: [w / 2, 0.28, 0] },
  ]
  const rails: { scale: [number, number, number]; pos: [number, number, number] }[] = [
    { scale: [w, 0.05, 0.05], pos: [0, 1.15, -d / 2] },
    { scale: [w, 0.05, 0.05], pos: [0, 1.15, d / 2] },
    { scale: [0.05, 0.05, d], pos: [-w / 2, 1.15, 0] },
    { scale: [0.05, 0.05, d], pos: [w / 2, 1.15, 0] },
  ]
  return (
    <group>
      {edges.map((e, i) => (
        <mesh key={`e${i}`} geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={e.scale} position={e.pos} />
      ))}
      {rails.map((r, i) => (
        <mesh key={`r${i}`} geometry={UNIT_BOX} material={MATERIALS.steel} scale={r.scale} position={r.pos} />
      ))}
    </group>
  )
}

/** Enclosed stair and lift core linking every level. */
function StairCore({ w, d, h }: { w: number; d: number; h: number }) {
  const x = -w / 2 + 6
  const z = d / 2 - 6
  const flights = Math.max(2, Math.round(h / 3.5))

  return (
    <group position={[x, 0, z]}>
      {/* enclosed lift shaft, clad like the rest of the building */}
      <mesh geometry={UNIT_BOX} material={CLADDING} scale={[3.6, h, 3.6]} position={[0, h / 2, -4.6]} castShadow receiveShadow />
      {[0, 1, 2].map((lvl) => (
        <mesh key={lvl} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.6, 2.2, 0.1]} position={[1.85, lvl * 7 + 1.35, -4.6]} />
      ))}

      {/* stair enclosure walls, open on the approach side */}
      <mesh geometry={UNIT_BOX} material={CLADDING} scale={[0.3, h, 6.4]} position={[-2.2, h / 2, 0]} castShadow />
      <mesh geometry={UNIT_BOX} material={CLADDING} scale={[4.4, h, 0.3]} position={[0, h / 2, 3.2]} castShadow />

      {/* stair flights with landings, alternating direction as they climb */}
      {Array.from({ length: flights }).map((_, i) => (
        <group key={i} position={[0, i * (h / flights), 0]}>
          <mesh
            geometry={UNIT_BOX}
            material={MATERIALS.concreteLight}
            scale={[2.6, 0.2, 4.8]}
            position={[0, h / flights / 2, 0]}
            rotation={[i % 2 === 0 ? -0.62 : 0.62, 0, 0]}
            castShadow
          />
          <mesh geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[2.8, 0.2, 1.6]} position={[0, h / flights, i % 2 === 0 ? 2.5 : -2.5]} />
          {/* handrail alongside the flight */}
          <mesh
            geometry={UNIT_BOX}
            material={MATERIALS.steel}
            scale={[0.06, 0.06, 4.8]}
            position={[1.35, h / flights / 2 + 1, 0]}
            rotation={[i % 2 === 0 ? -0.62 : 0.62, 0, 0]}
          />
        </group>
      ))}
    </group>
  )
}

/** Painted walkways and safety-zone edges on the production floor. */
function FloorMarkings({ w, d }: { w: number; d: number }) {
  const hazard = useMemo(() => getNeutralMaterial(MATERIAL_HEX.hazard, 0.9, 0), [])
  return (
    <group position={[0, 0.31, 0]}>
      <mesh geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[w * 0.92, 0.02, 2.6]} position={[0, 0, d * 0.3]} />
      {[-0.26, 0.06].map((f) => (
        <mesh key={f} geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[w * 0.92, 0.02, 1.6]} position={[0, 0, f * d]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={UNIT_BOX} material={hazard} scale={[w * 0.92, 0.02, 0.18]} position={[0, 0.005, d * 0.3 + s * 1.4]} />
      ))}
    </group>
  )
}

/**
 * The building envelope: full-height cladded facades with glazing bands,
 * roller doors and personnel doors. In cutaway the two camera-facing walls
 * are removed and the far two drop to a translucent shell, so the building
 * still reads as an enclosed volume you are looking into.
 */
function Envelope({ w, d, h, cutaway }: { w: number; d: number; h: number; cutaway: boolean }) {
  const t = 0.6

  return (
    <group>
      {/* far walls — solid normally, translucent in cutaway */}
      <mesh geometry={UNIT_BOX} material={cutaway ? GHOST_WALL : MATERIALS.wallLight} scale={[w, h, t]} position={[0, h / 2, -d / 2]} castShadow receiveShadow />
      <mesh geometry={UNIT_BOX} material={cutaway ? GHOST_WALL : MATERIALS.wallLight} scale={[t, h, d]} position={[-w / 2, h / 2, 0]} castShadow receiveShadow />

      {/* near walls — removed entirely in cutaway so the camera sees in */}
      {!cutaway && (
        <>
          <mesh geometry={UNIT_BOX} material={MATERIALS.wallLight} scale={[w, h, t]} position={[0, h / 2, d / 2]} castShadow receiveShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.wallLight} scale={[t, h, d]} position={[w / 2, h / 2, 0]} castShadow receiveShadow />
        </>
      )}

      {/* a low kerb wall remains where the near walls were, so the floor plate
          still reads as bounded rather than as an open platform */}
      {cutaway && (
        <>
          <mesh geometry={UNIT_BOX} material={MATERIALS.wallLight} scale={[w, 1.2, t]} position={[0, 0.6, d / 2]} castShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.wallLight} scale={[t, 1.2, d]} position={[w / 2, 0.6, 0]} castShadow />
        </>
      )}

      {/* facade detailing — only where a solid wall actually exists */}
      {!cutaway && (
        <>
          {FLOOR_LAYOUTS.map((f) => (
            <group key={f.floor.id}>
              <mesh geometry={UNIT_BOX} material={GLAZING} scale={[w * 0.94, 1.8, 0.1]} position={[0, f.elevation + 4.2, d / 2 + 0.32]} />
              <mesh geometry={UNIT_BOX} material={GLAZING} scale={[0.1, 1.8, d * 0.94]} position={[w / 2 + 0.32, f.elevation + 4.2, 0]} />
            </group>
          ))}

          {/* cladding rib lines break up the facade */}
          {Array.from({ length: 9 }).map((_, i) => (
            <mesh
              key={`rib-${i}`}
              geometry={UNIT_BOX}
              material={MATERIALS.steelDark}
              scale={[0.18, h, 0.1]}
              position={[-w / 2 + ((i + 0.5) * w) / 9, h / 2, d / 2 + 0.33]}
            />
          ))}

          {/* industrial roller doors on the warehouse-facing elevation */}
          {[-0.24, 0, 0.24].map((f) => (
            <group key={f}>
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.16, 5.6, 6]} position={[w / 2 + 0.32, 2.8, f * d]} />
              <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.2, 0.4, 6.6]} position={[w / 2 + 0.34, 5.8, f * d]} />
            </group>
          ))}

          {/* personnel entrance with a canopy */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[3, 3.2, 0.16]} position={[-w * 0.28, 1.6, d / 2 + 0.34]} />
          <mesh geometry={UNIT_BOX} material={GLAZING} scale={[2.4, 2.2, 0.06]} position={[-w * 0.28, 1.8, d / 2 + 0.44]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[5, 0.16, 2.2]} position={[-w * 0.28, 3.6, d / 2 + 1.3]} />
        </>
      )}
    </group>
  )
}

/** Roof deck with plant screens, skylight strips and a parapet. */
function Roof({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group position={[0, h, 0]}>
      <mesh geometry={UNIT_BOX} material={MATERIALS.roof} scale={[w * 1.03, 0.6, d * 1.03]} position={[0, 0.3, 0]} castShadow receiveShadow />

      {/* skylight strips */}
      {[-0.22, 0.16].map((f) => (
        <mesh key={f} geometry={UNIT_BOX} material={GLAZING} scale={[w * 0.7, 0.14, 3]} position={[0, 0.66, f * d]} />
      ))}

      {/* parapet all the way round, so the roof edge is finished */}
      {[
        { scale: [w * 1.04, 1, 0.3] as [number, number, number], pos: [0, 1.1, d / 2] as [number, number, number] },
        { scale: [w * 1.04, 1, 0.3] as [number, number, number], pos: [0, 1.1, -d / 2] as [number, number, number] },
        { scale: [0.3, 1, d * 1.04] as [number, number, number], pos: [w / 2, 1.1, 0] as [number, number, number] },
        { scale: [0.3, 1, d * 1.04] as [number, number, number], pos: [-w / 2, 1.1, 0] as [number, number, number] },
      ].map((p, i) => (
        <mesh key={i} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={p.scale} position={p.pos} />
      ))}

      {/* roof-mounted extract fans */}
      {[-0.3, -0.1, 0.1, 0.3].map((f) => (
        <group key={f} position={[f * w, 0.9, -d * 0.28]}>
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[1.1, 1.1, 0.7]} castShadow />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[1.25, 1.25, 0.12]} position={[0, 0.42, 0]} />
        </group>
      ))}

      {/* stair-core head house */}
      <mesh geometry={UNIT_BOX} material={CLADDING} scale={[4.4, 2.8, 4.4]} position={[-w / 2 + 6, 2, d / 2 - 6]} castShadow />
    </group>
  )
}
