import { MATERIALS, UNIT_BOX } from './geometries'
import type { BuildingLayout } from './layout'

/**
 * Storage racks (3 aisles) with pallet loads, plus a dock marker near the
 * building's road-facing edge — enough visual density to read as an
 * active warehouse floor, kept to reusable box primitives for cost.
 */
export function WarehouseInterior({ layout }: { layout: BuildingLayout }) {
  const [w, d] = layout.size
  const aisleCount = 3
  const rackDepth = d * 0.72
  const rackSpacing = (w * 0.82) / aisleCount

  return (
    <group>
      {Array.from({ length: aisleCount }).map((_, i) => {
        const x = -w * 0.41 + rackSpacing * (i + 0.5)
        return (
          <group key={i} position={[x, 0, 0]}>
            {/* rack frame — three shelf levels */}
            {[0.5, 2.2, 3.9].map((y, li) => (
              <mesh key={li} geometry={UNIT_BOX} material={MATERIALS.rack} scale={[1.4, 0.12, rackDepth]} position={[0, y, 0]} castShadow />
            ))}
            {[-1, 1].map((sx) =>
              [-1, 1].map((sz) => (
                <mesh
                  key={`${sx}-${sz}`}
                  geometry={UNIT_BOX}
                  material={MATERIALS.steelDark}
                  scale={[0.1, 4.6, 0.1]}
                  position={[sx * 0.65, 2.3, (sz * rackDepth) / 2.1]}
                />
              )),
            )}
            {/* pallet loads sitting on the lower two shelves */}
            {[0.62, 2.32].map((y, pi) =>
              [-0.32, 0.02, 0.34].map((pz, pj) => (
                <mesh
                  key={`${pi}-${pj}`}
                  geometry={UNIT_BOX}
                  material={MATERIALS.pallet}
                  scale={[1.1, 0.5, rackDepth * 0.22]}
                  position={[0, y + 0.28, pz * rackDepth]}
                  castShadow
                />
              )),
            )}
          </group>
        )
      })}

      {/* dock marker near the entrance edge */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[w * 0.3, 0.02, 1.6]} position={[0, 0.11, -d / 2 + 1.2]} />
    </group>
  )
}
