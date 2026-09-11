import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { EQUIPMENT_LAYOUTS } from './layout'
import { UNIT_SPHERE, getStatusMaterial } from './geometries'
import { useSimulation } from '../simulation/useSimulation'

/**
 * One small status light per equipment unit, hovering just above it.
 *
 * These use the same cached, emissive `getStatusMaterial` every equipment
 * body's status-colored part already uses — so the beacon and the machine
 * it sits above breathe in sync, and both bloom under the same post effect.
 * That ruled out instancing all 30 into one draw call (an InstancedMesh
 * needs one shared material, which can't carry six different emissive
 * colors); 30 small individual meshes is a trivial cost next to the
 * hundreds of non-instanced meshes the rest of the facility already draws.
 */
export function StatusBeacons() {
  const state = useSimulation()
  return (
    <>
      {EQUIPMENT_LAYOUTS.map((layout) => {
        const eq = state.equipment[layout.equipment.id] ?? layout.equipment
        return <Beacon key={layout.equipment.id} position={layout.position} height={layout.footprint[1]} status={eq.status} />
      })}
    </>
  )
}

function Beacon({ position, height, status }: { position: [number, number, number]; height: number; status: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const critical = status === 'critical'

  // Critical units also get a size pulse on top of the shared material's
  // emissive breathing — a second, faster cue that draws the eye straight
  // to what needs attention without relying on color alone.
  useFrame((frame) => {
    if (!critical || !ref.current) return
    const pulse = 1 + Math.sin(frame.clock.elapsedTime * 4) * 0.18
    ref.current.scale.setScalar(0.16 * pulse)
  })

  return (
    <mesh
      ref={ref}
      geometry={UNIT_SPHERE}
      material={getStatusMaterial(status as Parameters<typeof getStatusMaterial>[0])}
      position={[position[0], height + 0.55, position[2]]}
      scale={critical ? undefined : 0.16}
      frustumCulled={false}
    />
  )
}
