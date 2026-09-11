import { MATERIALS, UNIT_BOX } from './geometries'
import type { BuildingLayout } from './layout'

/**
 * Maintenance bay content — workbenches along one wall, a tool rack, and
 * an equipment-under-repair bay marker on the floor.
 */
export function MaintenanceInterior({ layout }: { layout: BuildingLayout }) {
  const [w, d] = layout.size

  return (
    <group>
      {/* workbenches along the back wall */}
      {[-1, 0, 1].map((k) => (
        <group key={k} position={[k * w * 0.26, 0, -d / 2 + 1.1]}>
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[2, 0.08, 0.9]} position={[0, 0.9, 0]} castShadow />
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}-${sz}`} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.06, 0.9, 0.06]} position={[sx * 0.9, 0.45, sz * 0.4]} />
            )),
          )}
        </group>
      ))}

      {/* tool rack */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.rack} scale={[0.15, 1.6, w * 0.4]} position={[w / 2 - 0.6, 0.8, d * 0.25]} castShadow />

      {/* equipment-under-repair bay marker */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[4.4, 0.02, 4.4]} position={[0, 0.11, d * 0.15]} />
    </group>
  )
}
