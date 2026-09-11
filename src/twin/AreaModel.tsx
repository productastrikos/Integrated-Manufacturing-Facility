import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { UNIT_BOX, MATERIALS } from './geometries'
import { ACCENT_HEX } from './colors'
import { LINE_LAYOUTS, type AreaLayout } from './layout'
import { LineModel } from './LineModel'
import { useSelection } from './selection'

export function AreaModel({ layout }: { layout: AreaLayout }) {
  const { selection, select } = useSelection()
  const isSelected = selection?.kind === 'area' && selection.id === layout.area.id
  const lines = LINE_LAYOUTS.filter((l) => l.line.areaId === layout.area.id)

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('area', layout.area.id)
  }

  return (
    <group>
      <mesh
        geometry={UNIT_BOX}
        material={MATERIALS.concrete}
        scale={[layout.size[0], 0.08, layout.size[1]]}
        position={[layout.center[0], 0.04, layout.center[1]]}
        onClick={onClick}
        receiveShadow
      >
        {isSelected && <Outlines thickness={2.2} color={ACCENT_HEX} transparent opacity={0.85} />}
      </mesh>
      {/* walkway stripes marking the area's safety-zone boundary, front and back */}
      {[layout.size[1] / 2, -layout.size[1] / 2].map((oz, i) => (
        <mesh
          key={i}
          geometry={UNIT_BOX}
          material={MATERIALS.walkway}
          scale={[layout.size[0], 0.09, 0.4]}
          position={[layout.center[0], 0.05, layout.center[1] + oz]}
        />
      ))}

      {lines.map((l) => (
        <LineModel key={l.line.id} layout={l} />
      ))}
    </group>
  )
}
