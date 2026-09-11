import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import type * as THREE from 'three'
import type { EquipmentLayout } from './layout'
import { MATERIALS, UNIT_BOX, UNIT_CONE, UNIT_CYLINDER, getStatusMaterial } from './geometries'
import { ACCENT_HEX } from './colors'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'
import { useScenarioAlert } from '../simulation/scenarioAlertState'
import { ScenarioTargetPulse } from './ScenarioTargetPulse'

/**
 * One piece of equipment. The body's primary block carries the live
 * status color; secondary details (motor housings, pipes, legs, control
 * panels) stay a neutral steel so the whole unit doesn't turn into a
 * traffic light — only the part that means something communicates state.
 *
 * Every variant is a small composed assembly (body + base + control panel
 * + variant-specific detail), not a single scaled cube — that composition
 * is what reads as "a machine" instead of "a box".
 */
export function EquipmentModel({ layout }: { layout: EquipmentLayout }) {
  const state = useSimulation()
  const { selection, select } = useSelection()
  const [hovered, setHovered] = useState(false)

  const eq = state.equipment[layout.equipment.id] ?? layout.equipment
  const isSelected = selection?.kind === 'equipment' && selection.id === eq.id
  const scenarioAlert = useScenarioAlert()
  const isScenarioTarget = scenarioAlert?.targetKind === 'equipment' && scenarioAlert.targetId === eq.id
  const statusMat = useMemo(() => getStatusMaterial(eq.status), [eq.status])
  const [w, h, d] = layout.footprint

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('equipment', eq.id)
  }

  return (
    <group
      position={layout.position}
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
      {/* base plinth — every unit sits on a mounting pad, not floats on the floor */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 1.08, 0.08, d * 1.08]} position={[0, 0.04, 0]} receiveShadow />

      <EquipmentBody variant={layout.variant} w={w} h={h} d={d} statusMaterial={statusMat} />

      {(isSelected || hovered) && (
        <mesh geometry={UNIT_BOX} scale={[w * 1.1, h * 1.1, d * 1.1]} position={[0, h / 2, 0]}>
          <meshBasicMaterial visible={false} />
          <Outlines thickness={isSelected ? 2.4 : 1.4} color={isSelected ? ACCENT_HEX : 0xffffff} transparent opacity={isSelected ? 0.95 : 0.5} />
        </mesh>
      )}

      {isScenarioTarget && <ScenarioTargetPulse heightAbove={h + 0.6} ringRadius={Math.max(w, d) * 0.9} />}
    </group>
  )
}

/** Small control panel — a fixture nearly every real machine has, reused across variants. */
function ControlPanel({ x, y, z, ry = 0 }: { x: number; y: number; z: number; ry?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.32, 0.4, 0.12]} castShadow />
      <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[0.2, 0.14, 0.02]} position={[0, 0.08, 0.07]} />
    </group>
  )
}

function EquipmentBody({
  variant,
  w,
  h,
  d,
  statusMaterial,
}: {
  variant: EquipmentLayout['variant']
  w: number
  h: number
  d: number
  statusMaterial: THREE.Material
}) {
  switch (variant) {
    case 'motor':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w, h * 0.7, d]} position={[0, (h * 0.7) / 2, 0]} castShadow />
          {/* drive motor */}
          <mesh
            geometry={UNIT_CYLINDER}
            material={MATERIALS.steel}
            scale={[w * 0.32, w * 0.32, h * 0.5]}
            position={[w * 0.32, h * 0.7 + (h * 0.5) / 2 * 0.55, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          />
          {/* mounting feet */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.1, 0.14, d * 0.9]} position={[(sx * w) / 2.1, 0.07, 0]} />
          ))}
          <ControlPanel x={-w * 0.5 - 0.02} y={h * 0.4} z={0} ry={Math.PI / 2} />
        </group>
      )
    case 'process':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w * 0.9, h, d * 0.9]} position={[0, h / 2, 0]} castShadow />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.14, 0.14, h * 0.9]} position={[w * 0.5, h * 0.55, d * 0.2]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.14, 0.14, h * 0.6]} position={[w * 0.5, h * 0.3, -d * 0.2]} rotation={[Math.PI / 2, 0, 0]} />
          {/* roof vent stub */}
          <mesh geometry={UNIT_CONE} material={MATERIALS.steelDark} scale={[0.16, 0.16, 0.3]} position={[-w * 0.2, h + 0.15, 0]} />
          <ControlPanel x={0} y={h * 0.35} z={-d * 0.5 - 0.02} />
        </group>
      )
    case 'vessel':
      return (
        <group>
          {/* support ring */}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[w * 0.55, w * 0.55, 0.14]} position={[0, 0.1, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={statusMaterial} scale={[w * 0.5, w * 0.5, h * 0.85]} position={[0, (h * 0.85) / 2 + 0.1, 0]} castShadow />
          <mesh geometry={UNIT_CONE} material={MATERIALS.steelDark} scale={[w * 0.52, w * 0.52, h * 0.18]} position={[0, h * 0.85 + (h * 0.18) / 2 + 0.1, 0]} />
          {/* level-indicator strip */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.pipe} scale={[0.06, h * 0.7, 0.06]} position={[w * 0.5 + 0.06, h * 0.4, 0]} />
          {/* valve + pipe stub near the base */}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.1, 0.1, 0.6]} position={[w * 0.55, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.16, 0.16, 0.16]} position={[w * 0.5 + 0.3, 0.4, 0]} />
        </group>
      )
    case 'conveyor':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w, h * 0.28, d]} position={[0, h * 0.5, 0]} castShadow />
          {/* side rails */}
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w, 0.08, 0.06]} position={[0, h * 0.5 + h * 0.16, (sz * d) / 2.3]} />
          ))}
          {/* drive drum at one end */}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[d * 0.42, d * 0.42, d * 0.9]} position={[w * 0.48, h * 0.5, 0]} rotation={[0, 0, Math.PI / 2]} />
          {/* support legs */}
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`${sx}-${sz}`}
                geometry={UNIT_CYLINDER}
                material={MATERIALS.steelDark}
                scale={[0.1, 0.1, h * 0.4]}
                position={[(sx * w) / 2.4, h * 0.2, (sz * d) / 2.4]}
                rotation={[Math.PI / 2, 0, 0]}
              />
            )),
          )}
          <ControlPanel x={-w * 0.42} y={h * 0.6} z={d * 0.55} />
        </group>
      )
    case 'packaging':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w, h * 0.55, d]} position={[0, (h * 0.55) / 2, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[w * 0.55, h * 0.4, d * 0.55]} position={[0, h * 0.55 + (h * 0.4) / 2, 0]} castShadow />
          {/* safety enclosure — corner posts + top rail */}
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`${sx}-${sz}`}
                geometry={UNIT_CYLINDER}
                material={MATERIALS.steelDark}
                scale={[0.05, 0.05, h]}
                position={[(sx * w) / 2.15, h / 2, (sz * d) / 2.15]}
              />
            )),
          )}
          {/* infeed / outfeed conveyor stubs */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[d * 0.5, 0.1, 0.5]} position={[-w * 0.7, h * 0.25, 0]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[d * 0.5, 0.1, 0.5]} position={[w * 0.7, h * 0.25, 0]} />
          <ControlPanel x={w * 0.5 + 0.02} y={h * 0.35} z={-d * 0.3} ry={-Math.PI / 2} />
        </group>
      )
    case 'inspection':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[w * 0.5, h * 0.5, d * 0.5]} position={[0, (h * 0.5) / 2, 0]} castShadow />
          {/* work surface */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.9, 0.06, d * 0.6]} position={[0, h * 0.5 + 0.03, 0]} />
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w * 0.1, h * 0.7, d * 0.6]} position={[0, h * 0.5 + (h * 0.7) / 2, 0]} castShadow />
          {/* sensor arm + head */}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.05, 0.05, h * 0.5]} position={[w * 0.15, h * 0.9, 0]} rotation={[0, 0, Math.PI / 2.4]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[0.14, 0.1, 0.14]} position={[w * 0.32, h * 0.55, 0]} />
        </group>
      )
    case 'handling':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w * 1.1, h * 0.35, d]} position={[0, h * 0.22, 0]} castShadow />
          {/* side rails */}
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 1.1, 0.12, 0.05]} position={[0, h * 0.42, (sz * d) / 2.2]} />
          ))}
          {/* stacked pallet load on top */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.pallet} scale={[w * 0.75, 0.14, d * 0.75]} position={[0, h * 0.48, 0]} />
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`${sx}-${sz}`}
                geometry={UNIT_CYLINDER}
                material={MATERIALS.steelDark}
                scale={[0.16, 0.16, 0.16]}
                position={[(sx * w) / 2.6, 0.16, (sz * d) / 2.6]}
                rotation={[Math.PI / 2, 0, 0]}
              />
            )),
          )}
        </group>
      )
    default:
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w * 0.8, h * 0.8, d * 0.8]} position={[0, (h * 0.8) / 2, 0]} castShadow />
          <ControlPanel x={w * 0.4 + 0.02} y={h * 0.4} z={0} ry={-Math.PI / 2} />
        </group>
      )
  }
}
