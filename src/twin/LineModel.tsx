import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { UNIT_BOX, getStatusMaterial, MATERIALS } from './geometries'
import { ACCENT_HEX } from './colors'
import { EQUIPMENT_LAYOUTS, type LineLayout } from './layout'
import { EquipmentModel } from './EquipmentModel'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'

export function LineModel({ layout }: { layout: LineLayout }) {
  const state = useSimulation()
  const { selection, select } = useSelection()
  const line = state.lines.find((l) => l.id === layout.line.id) ?? layout.line
  const isSelected = selection?.kind === 'line' && selection.id === line.id
  const statusMat = useMemo(() => getStatusMaterial(line.status), [line.status])
  const equipment = EQUIPMENT_LAYOUTS.filter((e) => e.equipment.lineId === line.id)

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('line', line.id)
  }

  return (
    <>
      {/* base platform — the clickable "whole line" surface, and a status edge stripe.
          Local to a group translated to the line's world center. */}
      <group position={[layout.center[0], 0, layout.center[1]]}>
        <mesh
          geometry={UNIT_BOX}
          material={MATERIALS.concreteLight}
          scale={[layout.length, 0.12, layout.depth]}
          position={[0, 0.06, 0]}
          onClick={onClick}
          receiveShadow
        >
          {isSelected && <Outlines thickness={2} color={ACCENT_HEX} transparent opacity={0.9} />}
        </mesh>
        <mesh geometry={UNIT_BOX} material={statusMat} scale={[layout.length, 0.03, 0.14]} position={[0, 0.13, -layout.depth / 2]} />
      </group>

      {/* Equipment carries its own absolute world position (see layout.ts), so it
          renders at the top level rather than nested in the group above — nesting
          it there would translate an already-world coordinate a second time. */}
      {equipment.map((e) => (
        <EquipmentModel key={e.equipment.id} layout={e} />
      ))}
    </>
  )
}
