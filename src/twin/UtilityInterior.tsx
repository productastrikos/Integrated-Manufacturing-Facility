import { MATERIALS, UNIT_BOX, UNIT_CYLINDER } from './geometries'
import type { BuildingLayout } from './layout'

/**
 * BMS / utility plant content — storage tanks, a transformer bank, a pipe
 * run, and rooftop-style fan/chiller boxes — so the Utility building reads
 * as the plant's mechanical & electrical room rather than an empty shed.
 */
export function UtilityInterior({ layout }: { layout: BuildingLayout }) {
  const [w, d] = layout.size

  return (
    <group>
      {/* two vertical tanks */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * w * 0.28, 0, -d * 0.2]}>
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.tank} scale={[1.6, 1.6, 4.2]} position={[0, 2.2, 0]} castShadow />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[1.65, 1.65, 0.2]} position={[0, 4.3, 0]} />
        </group>
      ))}

      {/* transformer bank */}
      <group position={[0, 0, d * 0.28]}>
        {[-1, 0, 1].map((k) => (
          <mesh key={k} geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[1.2, 1.4, 1]} position={[k * 2, 0.7, 0]} castShadow />
        ))}
        {[-1, 0, 1].map((k) => (
          <mesh key={`fin-${k}`} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.3, 0.1, 1.1]} position={[k * 2, 1.42, 0]} />
        ))}
      </group>

      {/* pipe run connecting tanks to the transformer/utility zone */}
      <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.14, 0.14, w * 0.55]} position={[0, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} />

      {/* fan/chiller boxes along the far wall */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={UNIT_BOX} material={MATERIALS.steel} scale={[1.6, 1.2, 1]} position={[sx * w * 0.35, 0.6, d / 2 - 0.7]} castShadow />
      ))}
    </group>
  )
}
