import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import { ACCENT_HEX, MATERIAL_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, getNeutralMaterial } from './geometries'
import { vehiclePosition } from './facilityLayout'
import { VEHICLE_FRAME_PROGRESS } from './cameraPresets'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'
import type { Vehicle } from '../simulation/types'

/**
 * Trucks and forklifts working the yard. Position comes from the vehicle's
 * live `routeProgress` in the central state, so they move on the same tick
 * as everything else and their 3D position always matches the logistics
 * record shown when you click them.
 */

const HAZARD = getNeutralMaterial(MATERIAL_HEX.hazard, 0.9, 0)
const TRUCK_BODY = getNeutralMaterial(0x5d6771, 0.6, 0.2)
const TRUCK_CAB = getNeutralMaterial(0x49535d, 0.5, 0.3)

export function Vehicles() {
  const state = useSimulation()

  // Publish live route progress so the camera preset can frame a vehicle
  // that is still moving rather than where it was when it was selected.
  for (const v of state.vehicles) VEHICLE_FRAME_PROGRESS.set(v.id, v.routeProgress)

  return (
    <group>
      {state.vehicles.map((v) => (
        <VehicleModel key={v.id} vehicle={v} />
      ))}
    </group>
  )
}

function VehicleModel({ vehicle }: { vehicle: Vehicle }) {
  const { selection, select } = useSelection()
  const [hovered, setHovered] = useState(false)
  const isSelected = selection?.kind === 'vehicle' && selection.id === vehicle.id

  const placement = vehiclePosition(vehicle.id, vehicle.routeProgress)
  if (!placement) return null

  const isTruck = vehicle.kind === 'truck'

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('vehicle', vehicle.id)
  }

  return (
    <group
      position={placement.position}
      rotation={[0, placement.rotationY, 0]}
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
      {isTruck ? <TruckBody /> : <ForkliftBody />}

      {(isSelected || hovered) && (
        <mesh geometry={UNIT_BOX} scale={isTruck ? [3.4, 4.2, 13] : [1.8, 2.9, 3]} position={isTruck ? [0, 2.1, 3.5] : [0, 1.4, 0.3]}>
          <meshBasicMaterial visible={false} />
          <Outlines thickness={isSelected ? 2.6 : 1.4} color={isSelected ? ACCENT_HEX : 0xffffff} transparent opacity={isSelected ? 0.95 : 0.5} />
        </mesh>
      )}
    </group>
  )
}

function TruckBody() {
  return (
    <group>
      <mesh geometry={UNIT_BOX} material={TRUCK_BODY} scale={[2.8, 3, 9]} position={[0, 2.1, 2.5]} castShadow />
      {/* trailer ribs */}
      {[-3, -1, 1, 3].map((z) => (
        <mesh key={z} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[2.86, 0.12, 0.14]} position={[0, 2.1, 2.5 + z]} />
      ))}
      <mesh geometry={UNIT_BOX} material={TRUCK_CAB} scale={[2.7, 2.4, 3]} position={[0, 1.8, 8.6]} castShadow />
      <mesh geometry={UNIT_BOX} material={MATERIALS.glass} scale={[2.5, 1, 0.1]} position={[0, 2.4, 10.05]} />
      {/* chassis + wheels */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[2.2, 0.3, 11]} position={[0, 0.85, 4]} />
      {[-1, 1].map((sx) =>
        [-1.2, 2.6, 6.2, 8.6].map((z) => (
          <mesh
            key={`${sx}-${z}`}
            geometry={UNIT_CYLINDER}
            material={MATERIALS.steelDark}
            scale={[0.55, 0.55, 0.32]}
            position={[sx * 1.3, 0.55, z]}
            rotation={[0, 0, Math.PI / 2]}
          />
        )),
      )}
    </group>
  )
}

function ForkliftBody() {
  return (
    <group>
      <mesh geometry={UNIT_BOX} material={HAZARD} scale={[1.2, 0.9, 2]} position={[0, 0.75, 0]} castShadow />
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1, 0.1, 0.9]} position={[0, 1.3, -0.3]} />
      {/* seat + overhead guard */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.6, 0.5, 0.1]} position={[0, 1.5, -0.65]} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}-${sz}`} geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[0.06, 0.06, 1.5]} position={[sx * 0.5, 1.9, sz * 0.7]} />
        )),
      )}
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.2, 0.08, 1.6]} position={[0, 2.65, 0]} />
      {/* mast + forks */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.12, 2.4, 0.12]} position={[sx * 0.4, 1.2, 1.1]} />
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={`f-${sx}`} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.14, 0.06, 1.1]} position={[sx * 0.35, 0.12, 1.7]} />
      ))}
      {/* pallet on the forks */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.pallet} scale={[1.1, 0.14, 1.1]} position={[0, 0.22, 1.7]} />
      <mesh geometry={UNIT_BOX} material={MATERIALS.rack} scale={[1, 0.7, 1]} position={[0, 0.64, 1.7]} castShadow />
      {[-1, 1].map((sx) =>
        [-0.7, 0.7].map((sz) => (
          <mesh
            key={`w-${sx}-${sz}`}
            geometry={UNIT_CYLINDER}
            material={MATERIALS.steelDark}
            scale={[0.32, 0.32, 0.22]}
            position={[sx * 0.6, 0.32, sz]}
            rotation={[0, 0, Math.PI / 2]}
          />
        )),
      )}
    </group>
  )
}
