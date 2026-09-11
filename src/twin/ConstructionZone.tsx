import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { ACCENT_HEX, MATERIAL_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, getNeutralMaterial } from './geometries'
import { stageZoneById } from './facilityLayout'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'

/**
 * The Capital Works site — a plant extension actually under construction on
 * the west expansion plot.
 *
 * This is the one place on the campus that is *deliberately* unfinished: a
 * poured slab, a steel frame part-way up, a tower crane, spoil heaps and
 * site cabins. Everywhere else an exposed frame would be a modelling
 * failure; here it is the point, and it reads as construction precisely
 * because the finished buildings around it do not.
 *
 * How much frame is erected tracks the live capital-works progress, so the
 * site visibly reflects the number the Operations module reports.
 */

const HOARDING = getNeutralMaterial(0x4e5862, 0.9, 0.03)
const CRANE = getNeutralMaterial(MATERIAL_HEX.hazard, 0.75, 0.15)
const REBAR = getNeutralMaterial(0x7a6a52, 0.85, 0.2)
const SPOIL = getNeutralMaterial(0x4a443a, 0.98, 0)
const CABIN = getNeutralMaterial(0x5a6470, 0.8, 0.08)

export function ConstructionZone() {
  const zone = stageZoneById('construction')
  const state = useSimulation()
  const { selection, select } = useSelection()
  const [hovered, setHovered] = useState(false)

  const stage = state.valueChain.find((s) => s.id === 'construction')
  const isSelected = selection?.kind === 'stage' && selection.id === 'construction'

  // Bay heights are derived once from a fixed pattern; the live progress only
  // decides HOW MANY bays are erected, so the frame never re-generates or
  // jitters as the simulation ticks.
  const bayPattern = useMemo(() => [1, 0.92, 0.78, 0.55, 0.34, 0.16], [])

  if (!zone || !stage) return null
  const [w, d] = zone.size
  const [cx, cz] = zone.center
  const bays = bayPattern.length
  const erectedFraction = stage.progressPct / 100

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('stage', 'construction')
  }

  return (
    <group
      position={[cx, 0, cz]}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      {/* compacted ground + poured slab */}
      <mesh geometry={UNIT_BOX} material={SPOIL} scale={[w, 0.08, d]} position={[0, 0.04, 0]} receiveShadow />
      <mesh geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[w * 0.62, 0.35, d * 0.6]} position={[0, 0.18, -d * 0.12]} receiveShadow />

      {/* exposed rebar starter bars on the un-poured half of the slab */}
      {Array.from({ length: 5 }).map((_, i) =>
        Array.from({ length: 4 }).map((__, j) => (
          <mesh
            key={`rb-${i}-${j}`}
            geometry={UNIT_CYLINDER}
            material={REBAR}
            scale={[0.05, 0.05, 1.1]}
            position={[-w * 0.28 + i * (w * 0.14), 0.9, d * 0.16 + j * 1.6]}
          />
        )),
      )}

      <SteelFrame w={w} d={d} bays={bays} pattern={bayPattern} erectedFraction={erectedFraction} />
      <TowerCrane w={w} d={d} />
      <SiteCabins w={w} d={d} />
      <MaterialStacks w={w} d={d} />
      <Excavator position={[w * 0.3, 0, d * 0.34]} />
      <Hoarding w={w} d={d} />

      {/* Selection reads as a flat plot outline, not a tall volume — a box
          scaled to the crane height renders as a solid amber wall. */}
      {(isSelected || hovered) && (
        <mesh geometry={UNIT_BOX} scale={[w + 1.2, 0.3, d + 1.2]} position={[0, 0.2, 0]}>
          <meshBasicMaterial visible={false} />
          <Outlines thickness={isSelected ? 3 : 1.6} color={isSelected ? ACCENT_HEX : 0xffffff} transparent opacity={isSelected ? 0.95 : 0.4} />
        </mesh>
      )}
    </group>
  )
}

/**
 * A part-erected portal frame. Columns rise across the plot and the beams
 * only connect the bays that have actually been erected — the leading edge
 * is where work has reached.
 */
function SteelFrame({
  w,
  d,
  bays,
  pattern,
  erectedFraction,
}: {
  w: number
  d: number
  bays: number
  pattern: number[]
  erectedFraction: number
}) {
  const fullH = 11
  const spanZ = d * 0.5
  const erectedBays = Math.max(1, Math.round(bays * erectedFraction * 1.6))

  return (
    <group position={[0, 0.35, -d * 0.12]}>
      {pattern.map((frac, i) => {
        const x = -w * 0.26 + (i * (w * 0.52)) / (bays - 1)
        // Beyond the erected leading edge the columns are still stub height.
        const h = i < erectedBays ? fullH * frac : 1.6
        return (
          <group key={i} position={[x, 0, 0]}>
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.55, h, 0.55]} position={[0, h / 2, (s * spanZ) / 2]} castShadow />
            ))}
            {/* the roof beam only exists where both columns are up to height */}
            {i < erectedBays && frac > 0.5 && (
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.4, 0.5, spanZ]} position={[0, h, 0]} castShadow />
            )}
            {/* base plates */}
            {[-1, 1].map((s) => (
              <mesh key={`bp-${s}`} geometry={UNIT_BOX} material={MATERIALS.concrete} scale={[1.1, 0.16, 1.1]} position={[0, 0.08, (s * spanZ) / 2]} />
            ))}
          </group>
        )
      })}

      {/* longitudinal rails tying the erected bays together */}
      {[0.45, 0.8].map((f) => (
        <group key={f}>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={UNIT_BOX}
              material={MATERIALS.steel}
              scale={[(w * 0.52 * erectedBays) / bays, 0.22, 0.22]}
              position={[-w * 0.26 + (w * 0.52 * erectedBays) / bays / 2, fullH * f, (s * spanZ) / 2]}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Tower crane serving the plot — mast, slewing jib, counter-jib and hook block. */
function TowerCrane({ w, d }: { w: number; d: number }) {
  const mastH = 26
  return (
    <group position={[-w * 0.32, 0, d * 0.3]}>
      {/* ballast base */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.concrete} scale={[4.4, 0.6, 4.4]} position={[0, 0.3, 0]} receiveShadow />
      {/* lattice mast, drawn as four legs plus tie bands rather than a solid box */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}-${sz}`} geometry={UNIT_BOX} material={CRANE} scale={[0.22, mastH, 0.22]} position={[sx * 0.7, mastH / 2 + 0.6, sz * 0.7]} castShadow />
        )),
      )}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} geometry={UNIT_BOX} material={CRANE} scale={[1.6, 0.14, 1.6]} position={[0, 2 + i * 3.6, 0]} />
      ))}

      {/* slewing assembly, jib and counter-jib */}
      <group position={[0, mastH + 1.2, 0]}>
        <mesh geometry={UNIT_BOX} material={CRANE} scale={[2.2, 1.4, 2.2]} castShadow />
        <mesh geometry={UNIT_BOX} material={CRANE} scale={[22, 0.5, 0.5]} position={[10, 0.6, 0]} castShadow />
        <mesh geometry={UNIT_BOX} material={CRANE} scale={[7, 0.5, 0.9]} position={[-3.5, 0.6, 0]} />
        {/* counterweight */}
        <mesh geometry={UNIT_BOX} material={MATERIALS.concrete} scale={[2.2, 1.4, 1.6]} position={[-6, 0.4, 0]} castShadow />
        {/* A-frame + tie cables */}
        <mesh geometry={UNIT_BOX} material={CRANE} scale={[0.24, 4, 0.24]} position={[0, 2.8, 0]} />
        <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[16, 0.06, 0.06]} position={[8, 3.4, 0]} rotation={[0, 0, -0.22]} />
        {/* trolley and hook block on the hoist rope */}
        <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.8, 0.4, 0.7]} position={[12, 0.1, 0]} />
        <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.04, 0.04, 12]} position={[12, -5.9, 0]} />
        <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.5, 0.8, 0.5]} position={[12, -12.2, 0]} />
      </group>
    </group>
  )
}

/** Stacked site accommodation and the site office. */
function SiteCabins({ w, d }: { w: number; d: number }) {
  return (
    <group position={[w * 0.28, 0, -d * 0.36]}>
      {[0, 1].map((lvl) => (
        <group key={lvl} position={[0, lvl * 2.9, 0]}>
          <mesh geometry={UNIT_BOX} material={CABIN} scale={[7, 2.8, 3]} position={[0, 1.4, 0]} castShadow />
          {/* window band + door */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.glass} scale={[5, 0.9, 0.08]} position={[0, 1.8, 1.55]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.9, 2, 0.08]} position={[-2.6, 1, 1.55]} />
        </group>
      ))}
      {/* external stair to the upper cabin */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.2, 0.14, 3.6]} position={[4.2, 1.6, 1.2]} rotation={[-0.7, 0, 0]} />
      <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.06, 1.1, 3.6]} position={[4.8, 2.3, 1.2]} rotation={[-0.7, 0, 0]} />
    </group>
  )
}

/** Stacked materials waiting to be lifted — precast panels, pipe and rebar bundles. */
function MaterialStacks({ w, d }: { w: number; d: number }) {
  return (
    <group>
      {/* precast panels leaning on an A-frame rack */}
      <group position={[-w * 0.3, 0, -d * 0.34]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[0.3, 3.4, 5]} position={[i * 0.5, 1.7, 0]} rotation={[0, 0, 0.12]} castShadow />
        ))}
      </group>

      {/* pipe stack */}
      <group position={[w * 0.06, 0, d * 0.4]}>
        {[0, 1, 2].map((row) =>
          Array.from({ length: 3 - row }).map((_, i) => (
            <mesh
              key={`${row}-${i}`}
              geometry={UNIT_CYLINDER}
              material={MATERIALS.pipe}
              scale={[0.45, 0.45, 5]}
              position={[row * 0.45 + i * 0.95, 0.5 + row * 0.8, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          )),
        )}
      </group>

      {/* rebar bundles */}
      {[0, 1].map((i) => (
        <mesh key={i} geometry={UNIT_BOX} material={REBAR} scale={[1.2, 0.5, 6]} position={[-w * 0.06 + i * 1.6, 0.3, d * 0.4]} />
      ))}

      {/* spoil heap from the excavation */}
      <mesh geometry={UNIT_BOX} material={SPOIL} scale={[6, 1.6, 4]} position={[w * 0.28, 0.8, d * 0.12]} rotation={[0, 0.3, 0]} castShadow />
    </group>
  )
}

/** Tracked excavator working the plot. */
function Excavator({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, -0.6, 0]}>
      {/* tracks */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1, 0.8, 3.6]} position={[s * 1.1, 0.4, 0]} castShadow />
      ))}
      {/* slewing house + cab */}
      <mesh geometry={UNIT_BOX} material={CRANE} scale={[2.4, 1.5, 3]} position={[0, 1.5, -0.3]} castShadow />
      <mesh geometry={UNIT_BOX} material={MATERIALS.glass} scale={[1.2, 1.2, 1.2]} position={[-0.6, 2.7, 0.6]} />
      {/* boom, dipper and bucket */}
      <mesh geometry={UNIT_BOX} material={CRANE} scale={[0.6, 0.6, 4.4]} position={[0.6, 2.6, 2] } rotation={[0.5, 0, 0]} castShadow />
      <mesh geometry={UNIT_BOX} material={CRANE} scale={[0.5, 0.5, 3]} position={[0.6, 2.2, 4.4]} rotation={[-0.9, 0, 0]} />
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.1, 0.9, 1.1]} position={[0.6, 0.7, 5.4]} />
    </group>
  )
}

/** Site hoarding with mesh panels, marking the works boundary. */
function Hoarding({ w, d }: { w: number; d: number }) {
  const posts = useMemo(() => {
    const pts: [number, number][] = []
    const step = 4
    for (let x = -w / 2; x <= w / 2; x += step) {
      pts.push([x, -d / 2])
      pts.push([x, d / 2])
    }
    for (let z = -d / 2 + step; z < d / 2; z += step) {
      pts.push([-w / 2, z])
      pts.push([w / 2, z])
    }
    return pts
  }, [w, d])

  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} geometry={UNIT_BOX} material={HOARDING} scale={[0.12, 2.2, 0.12]} position={[x, 1.1, z]} />
      ))}
      {/* mesh panels between the posts, drawn as thin translucent slabs */}
      {[
        { s: [w, 2, 0.06] as [number, number, number], p: [0, 1.1, -d / 2] as [number, number, number] },
        { s: [w, 2, 0.06] as [number, number, number], p: [0, 1.1, d / 2] as [number, number, number] },
        { s: [0.06, 2, d] as [number, number, number], p: [-w / 2, 1.1, 0] as [number, number, number] },
        { s: [0.06, 2, d] as [number, number, number], p: [w / 2, 1.1, 0] as [number, number, number] },
      ].map((panel, i) => (
        <mesh key={`p-${i}`} geometry={UNIT_BOX} scale={panel.s} position={panel.p}>
          <meshStandardMaterial color={0x6b7580} roughness={0.8} transparent opacity={0.28} />
        </mesh>
      ))}
    </group>
  )
}
