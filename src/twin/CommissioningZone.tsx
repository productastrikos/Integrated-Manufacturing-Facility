import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import { ACCENT_HEX, MATERIAL_HEX, STATUS_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, getNeutralMaterial } from './geometries'
import { stageZoneById } from './facilityLayout'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'

/**
 * The Commissioning & Test Yard — where finished equipment is set up, run
 * up under load and signed off before it leaves the site for installation.
 *
 * The bays fill from left to right with the number of jobs currently open,
 * so the yard is visibly busier when the Installation stage is carrying
 * more work. The bay a job occupies is a fixed slot, not a random one, so
 * the yard doesn't reshuffle itself every tick.
 */

const BAY_PAINT = getNeutralMaterial(MATERIAL_HEX.hazard, 0.9, 0)
const APRON = getNeutralMaterial(0x4b545e, 0.94, 0)
const CRATE = getNeutralMaterial(0x8a7048, 0.88, 0)
const CANOPY = getNeutralMaterial(0x505a65, 0.8, 0.1)

const BAY_COUNT = 4

export function CommissioningZone() {
  const zone = stageZoneById('installation')
  const state = useSimulation()
  const { selection, select } = useSelection()
  const [hovered, setHovered] = useState(false)

  const stage = state.valueChain.find((s) => s.id === 'installation')
  const isSelected = selection?.kind === 'stage' && selection.id === 'installation'

  if (!zone || !stage) return null
  const [w, d] = zone.size
  const [cx, cz] = zone.center
  // Open jobs fill the bays; anything beyond the yard's capacity is waiting
  // in the crate line rather than occupying a bay.
  const occupiedBays = Math.min(BAY_COUNT, stage.openItems)

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('stage', 'installation')
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
      {/* hardstanding apron */}
      <mesh geometry={UNIT_BOX} material={APRON} scale={[w, 0.1, d]} position={[0, 0.05, 0]} receiveShadow />

      {/* painted commissioning bays */}
      {Array.from({ length: BAY_COUNT }).map((_, i) => {
        const x = -w * 0.34 + (i * (w * 0.68)) / (BAY_COUNT - 1)
        const busy = i < occupiedBays
        return (
          <group key={i} position={[x, 0, -d * 0.16]}>
            {/* bay outline */}
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={UNIT_BOX} material={BAY_PAINT} scale={[0.14, 0.02, 7]} position={[s * 1.9, 0.11, 0]} />
            ))}
            <mesh geometry={UNIT_BOX} material={BAY_PAINT} scale={[3.9, 0.02, 0.14]} position={[0, 0.11, -3.5]} />
            {busy && <UnitUnderTest />}
          </group>
        )
      })}

      <TestCanopy w={w} d={d} />
      <PowerCabinets w={w} d={d} />
      <CrateLine w={w} d={d} count={Math.max(0, stage.openItems - occupiedBays) + 2} />

      {/* Selection reads as a flat plot outline. A box scaled to the yard's
          full height would render as a solid amber wall from most angles. */}
      {(isSelected || hovered) && (
        <mesh geometry={UNIT_BOX} scale={[w + 1.2, 0.3, d + 1.2]} position={[0, 0.2, 0]}>
          <meshBasicMaterial visible={false} />
          <Outlines thickness={isSelected ? 3 : 1.6} color={isSelected ? ACCENT_HEX : 0xffffff} transparent opacity={isSelected ? 0.95 : 0.4} />
        </mesh>
      )}
    </group>
  )
}

/** A unit sitting in a bay on its shipping skid, connected up for testing. */
function UnitUnderTest() {
  const running = getNeutralMaterial(STATUS_HEX.running, 0.55, 0.25)
  return (
    <group>
      {/* transport skid */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[3.2, 0.24, 5]} position={[0, 0.22, 0]} />
      {/* the equipment itself */}
      <mesh geometry={UNIT_BOX} material={running} scale={[2.6, 2.4, 4]} position={[0, 1.54, 0]} castShadow />
      {/* control panel on the end */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[0.9, 1.2, 0.16]} position={[0, 1.6, 2.08]} />
      {/* access platform + steps */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[1.4, 0.1, 1.6]} position={[2.2, 0.9, 0]} />
      <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.06, 0.9, 1.6]} position={[2.85, 1.35, 0]} />
      {/* test cabling running back to the power cabinet */}
      <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.08, 0.08, 3.4]} position={[-1.6, 0.3, 1.4]} rotation={[0, 0.5, Math.PI / 2]} />
    </group>
  )
}

/** Open-sided canopy over the test bays, so work continues in weather. */
function TestCanopy({ w, d }: { w: number; d: number }) {
  const legs: [number, number][] = [
    [-w * 0.38, -d * 0.34],
    [w * 0.38, -d * 0.34],
    [-w * 0.38, d * 0.02],
    [w * 0.38, d * 0.02],
  ]
  return (
    <group>
      {legs.map(([x, z], i) => (
        <mesh key={i} geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.18, 0.18, 6]} position={[x, 3, z]} castShadow />
      ))}
      <mesh geometry={UNIT_BOX} material={CANOPY} scale={[w * 0.84, 0.24, d * 0.42]} position={[0, 6.1, -d * 0.16]} castShadow />
      {/* roof purlins */}
      {[-0.3, -0.1, 0.1].map((f) => (
        <mesh key={f} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.84, 0.16, 0.16]} position={[0, 5.9, f * d]} />
      ))}
    </group>
  )
}

/** Test supply cabinets feeding the bays. */
function PowerCabinets({ w, d }: { w: number; d: number }) {
  return (
    <group position={[-w * 0.44, 0, -d * 0.16]}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, 0, -2.4 + i * 2.4]}>
          <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[1.2, 2, 1]} position={[0, 1, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.3, 0.12, 1.1]} position={[0, 2.06, 0]} />
        </group>
      ))}
    </group>
  )
}

/** Crated units awaiting a bay, or already signed off and waiting for a truck. */
function CrateLine({ w, d, count }: { w: number; d: number; count: number }) {
  const shown = Math.min(5, Math.max(1, count))
  return (
    <group position={[0, 0, d * 0.36]}>
      {Array.from({ length: shown }).map((_, i) => (
        <group key={i} position={[-w * 0.32 + i * 3.6, 0, 0]}>
          <mesh geometry={UNIT_BOX} material={MATERIALS.pallet} scale={[3, 0.18, 2.4]} position={[0, 0.14, 0]} />
          <mesh geometry={UNIT_BOX} material={CRATE} scale={[2.9, 2.2, 2.3]} position={[0, 1.35, 0]} castShadow />
          {/* crate banding */}
          {[-0.8, 0.8].map((s) => (
            <mesh key={s} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.08, 2.25, 2.35]} position={[s, 1.35, 0]} />
          ))}
        </group>
      ))}
    </group>
  )
}
