import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import { ACCENT_HEX, STATUS_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, UNIT_CONE, getNeutralMaterial } from './geometries'
import { CAMERA_LAYOUTS, type CameraLayout } from './facilityLayout'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'

/** Physical CCTV infrastructure — real, selectable objects in the scene. */
export function SecurityAssets() {
  return (
    <group>
      {CAMERA_LAYOUTS.map((c) => (
        <CameraModel key={c.camera.id} layout={c} />
      ))}
    </group>
  )
}

function CameraModel({ layout }: { layout: CameraLayout }) {
  const state = useSimulation()
  const { selection, select } = useSelection()
  const [hovered, setHovered] = useState(false)

  const camera = state.security.cameras.find((c) => c.id === layout.camera.id) ?? layout.camera
  const isSelected = selection?.kind === 'camera' && selection.id === camera.id
  const lensMaterial = getNeutralMaterial(camera.status === 'online' ? STATUS_HEX.running : STATUS_HEX.offline, 0.35, 0.4)
  const [x, y, z] = layout.position

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('camera', camera.id)
  }

  return (
    <group
      position={[x, 0, z]}
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
      {/* pole, where the camera isn't wall-mounted */}
      {layout.poleHeight > 0 && (
        <>
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[0.12, 0.12, layout.poleHeight]} position={[0, layout.poleHeight / 2, 0]} castShadow />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.concreteLight} scale={[0.34, 0.34, 0.16]} position={[0, 0.08, 0]} />
        </>
      )}

      <group position={[0, y, 0]} rotation={[0, layout.rotationY, 0]}>
        {/* mounting arm + housing + lens */}
        <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.08, 0.08, 0.5]} position={[0, 0, 0.25]} />
        <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.26, 0.24, 0.52]} position={[0, -0.05, 0.6]} castShadow />
        <mesh geometry={UNIT_CYLINDER} material={lensMaterial} scale={[0.09, 0.09, 0.1]} position={[0, -0.05, 0.87]} rotation={[Math.PI / 2, 0, 0]} />
        {/* sun shroud */}
        <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.3, 0.03, 0.56]} position={[0, 0.09, 0.6]} />
        {/* coverage indicator — a faint cone showing where it looks */}
        <mesh geometry={UNIT_CONE} position={[0, -0.05, 2.6]} rotation={[Math.PI / 2, 0, 0]} scale={[1.7, 1.7, 3.4]}>
          <meshBasicMaterial color={isSelected ? ACCENT_HEX : 0x8fa4b8} transparent opacity={isSelected ? 0.14 : 0.05} depthWrite={false} />
        </mesh>

        {(isSelected || hovered) && (
          <mesh geometry={UNIT_BOX} scale={[0.42, 0.42, 0.72]} position={[0, -0.05, 0.6]}>
            <meshBasicMaterial visible={false} />
            <Outlines thickness={isSelected ? 2.4 : 1.4} color={isSelected ? ACCENT_HEX : 0xffffff} transparent opacity={isSelected ? 0.95 : 0.5} />
          </mesh>
        )}
      </group>
    </group>
  )
}
