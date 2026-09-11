import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { ReactNode } from 'react'
import type * as THREE from 'three'
import { MATERIALS, UNIT_BOX } from './geometries'
import { ACCENT_HEX } from './colors'
import type { BuildingLayout, Vec3 } from './layout'
import { useSelection } from './selection'
import { useScenarioAlert } from '../simulation/scenarioAlertState'
import { ScenarioTargetPulse } from './ScenarioTargetPulse'

/**
 * A building rendered as a floor slab + low perimeter walls, no roof — so
 * whatever's inside (racks, tanks, workbenches, production lines) stays
 * visible from the default camera, not just behind a Cutaway toggle.
 * Shared by the Production Building, Warehouse, Utility Area and
 * Maintenance Area so all four "working interior" buildings look and
 * behave the same way.
 */
export function OpenBuildingShell({
  layout,
  wallHeight = 2.4,
  wallMaterial = MATERIALS.wallLight,
  children,
}: {
  layout: BuildingLayout
  wallHeight?: number
  /** Lets each building carry a slightly different wall tone (cooler/warmer) instead of one uniform grey. */
  wallMaterial?: THREE.Material
  children?: ReactNode
}) {
  const { selection, select } = useSelection()
  const isSelected = selection?.kind === 'building' && selection.id === layout.building.id
  const scenarioAlert = useScenarioAlert()
  const isScenarioTarget = scenarioAlert?.targetKind === 'building' && scenarioAlert.targetId === layout.building.id
  const [w, d] = layout.size
  const [cx, cz] = layout.center

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('building', layout.building.id)
  }

  const walls: { scale: Vec3; pos: Vec3 }[] = [
    { scale: [w, wallHeight, 0.4], pos: [0, wallHeight / 2, d / 2] },
    { scale: [w, wallHeight, 0.4], pos: [0, wallHeight / 2, -d / 2] },
    { scale: [0.4, wallHeight, d], pos: [w / 2, wallHeight / 2, 0] },
    { scale: [0.4, wallHeight, d], pos: [-w / 2, wallHeight / 2, 0] },
  ]

  return (
    <group position={[cx, 0, cz]}>
      <mesh geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[w, 0.1, d]} position={[0, 0.05, 0]} onClick={onClick} receiveShadow>
        {isSelected && <Outlines thickness={2.4} color={ACCENT_HEX} transparent opacity={0.9} />}
      </mesh>
      {walls.map((wall, i) => (
        <mesh key={i} geometry={UNIT_BOX} material={wallMaterial} scale={wall.scale} position={wall.pos} castShadow receiveShadow />
      ))}
      {isScenarioTarget && <ScenarioTargetPulse heightAbove={wallHeight + 1} ringRadius={Math.min(w, d) * 0.35} />}
      {children}
    </group>
  )
}
