import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, getNeutralMaterial } from './geometries'
import { MATERIAL_HEX } from './colors'
import { BMS_ASSET_LAYOUTS, FLOOR_02_CORRIDOR, elevationForFloor } from './facilityLayout'
import { BmsAssetModel } from './BmsAssetModel'
import { PRODUCTION_BUILDING } from './layout'

/**
 * Content for the production building's upper levels. Neither floor is an
 * empty deck: Floor 01 carries the process control room and utility
 * distribution, Floor 02 is the building-services plant deck. The
 * selectable machinery on both comes from the shared BMS asset list, so
 * these components only add the fixed context around it — cable trays,
 * pipe runs, platforms and the control room shell.
 */

const GLAZING = getNeutralMaterial(MATERIAL_HEX.glass, 0.2, 0.6)
const CORRIDOR_EDGE = getNeutralMaterial(MATERIAL_HEX.hazard, 0.9, 0)

export function FloorInterior({ floorId }: { floorId: string }) {
  const assets = BMS_ASSET_LAYOUTS.filter((a) => a.asset.buildingId === 'BLD-PROD' && a.asset.floorId === floorId)

  return (
    <group>
      {assets.map((a) => (
        <BmsAssetModel key={a.asset.id} layout={a} />
      ))}
      {floorId === 'FLR-01' && <ControlRoomLevel />}
      {floorId === 'FLR-02' && <PlantDeck />}
    </group>
  )
}

/** Floor 01: process control room, utility distribution skids, cable trays. */
function ControlRoomLevel() {
  const [w, d] = PRODUCTION_BUILDING.size
  const [cx, cz] = PRODUCTION_BUILDING.center
  const y = elevationForFloor('FLR-01') + 0.25

  return (
    <group position={[cx, y, cz]}>
      {/* glazed process control room overlooking the production floor */}
      <group position={[-w * 0.12, 0, -d * 0.3]}>
        <mesh geometry={UNIT_BOX} material={MATERIALS.wall} scale={[14, 3.4, 8]} position={[0, 1.7, 0]} castShadow />
        <mesh geometry={UNIT_BOX} material={GLAZING} scale={[13.4, 2, 0.1]} position={[0, 2, 4.05]} />
        <mesh geometry={UNIT_BOX} material={GLAZING} scale={[0.1, 2, 7.4]} position={[7.05, 2, 0]} />
        <mesh geometry={UNIT_BOX} material={MATERIALS.roof} scale={[14.4, 0.24, 8.4]} position={[0, 3.5, 0]} />
        {/* operator desks + wall of screens inside */}
        {[-1, 0, 1].map((k) => (
          <mesh key={k} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[3, 0.1, 1.2]} position={[k * 4, 0.85, 1.6]} />
        ))}
        {[-1, 0, 1].map((k) => (
          <mesh key={`s-${k}`} geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[3.4, 1.4, 0.12]} position={[k * 4, 2.1, -3.6]} />
        ))}
      </group>

      {/* utility distribution skids along the far side */}
      {[-1, 0, 1].map((k) => (
        <group key={k} position={[k * 12 + w * 0.1, 0, d * 0.08]}>
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[5, 0.14, 2.6]} position={[0, 0.5, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.tank} scale={[0.9, 0.9, 2.4]} position={[-1.4, 1.7, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[1.6, 1.6, 1.6]} position={[1.4, 1.3, 0]} castShadow />
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}-${sz}`} geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[0.12, 0.12, 0.5]} position={[sx * 2.2, 0.25, sz * 1.1]} />
            )),
          )}
        </group>
      ))}

      <CableTrays w={w} d={d} runZ={d * 0.2} />
      <PipeRun w={w} runZ={d * 0.24} height={3.2} />
    </group>
  )
}

/**
 * Floor 02 is the zoned services level: the HVAC plant hall occupies the west
 * wing, the security wing the east, and a marked central corridor runs
 * between them. The corridor is what makes the split legible from above —
 * without it the two wings read as unrelated rooms on one deck.
 */
function PlantDeck() {
  const [w, d] = PRODUCTION_BUILDING.size
  const [cx, cz] = PRODUCTION_BUILDING.center
  const y = elevationForFloor('FLR-02') + 0.25
  const corridorX = FLOOR_02_CORRIDOR.center[0] - cx
  const corridorZ = FLOOR_02_CORRIDOR.center[1] - cz

  return (
    <group position={[cx, y, cz]}>
      {/* central circulation corridor dividing the two wings */}
      <group position={[corridorX, 0, corridorZ]}>
        <mesh geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[FLOOR_02_CORRIDOR.width, 0.05, FLOOR_02_CORRIDOR.depth]} position={[0, 0.04, 0]} />
        {/* hazard edging down both sides of the corridor */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            geometry={UNIT_BOX}
            material={CORRIDOR_EDGE}
            scale={[0.3, 0.05, FLOOR_02_CORRIDOR.depth]}
            position={[(s * FLOOR_02_CORRIDOR.width) / 2, 0.05, 0]}
          />
        ))}
        {/* wing signage gantry over the corridor */}
        <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[FLOOR_02_CORRIDOR.width + 2, 0.2, 0.3]} position={[0, 3.2, -FLOOR_02_CORRIDOR.depth * 0.3]} />
        {[-1, 1].map((s) => (
          <mesh key={`p-${s}`} geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.08, 0.08, 3.2]} position={[(s * (FLOOR_02_CORRIDOR.width + 2)) / 2, 1.6, -FLOOR_02_CORRIDOR.depth * 0.3]} />
        ))}
      </group>

      {/* maintenance access platform between the plant rows */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[w * 0.34, 0.06, 3]} position={[-w * 0.26, 0.03, -d * 0.09]} />

      {/* duct mains leaving the air handlers and running the length of the deck */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.pipe} scale={[w * 0.72, 1.5, 1.8]} position={[0, 3.6, -d * 0.3]} castShadow />
      {[-0.24, -0.06, 0.12].map((f) => (
        <mesh key={f} geometry={UNIT_BOX} material={MATERIALS.pipe} scale={[1.4, 1.2, d * 0.18]} position={[f * w, 3.4, -d * 0.2]} />
      ))}
      {/* drop diffusers down through the slab */}
      {[-0.3, -0.14, 0.02, 0.18].map((f) => (
        <mesh key={f} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.9, 0.5, 0.9]} position={[f * w, 2.4, -d * 0.12]} />
      ))}

      <CableTrays w={w} d={d} runZ={d * 0.16} />
      <PipeRun w={w} runZ={d * 0.22} height={2.6} />
    </group>
  )
}

/** Cable tray run with support brackets — a small detail that reads as real building services. */
function CableTrays({ w, runZ }: { w: number; d: number; runZ: number }) {
  const brackets = Math.floor(w / 8)
  return (
    <group>
      {[0, 0.45].map((yOff) => (
        <mesh key={yOff} geometry={UNIT_BOX} material={MATERIALS.steel} scale={[w * 0.8, 0.06, 0.55]} position={[0, 4.4 + yOff, runZ]} />
      ))}
      {Array.from({ length: brackets }).map((_, i) => {
        const x = -w * 0.4 + ((i + 0.5) * (w * 0.8)) / brackets
        return <mesh key={i} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.08, 1, 0.08]} position={[x, 4.9, runZ]} />
      })}
    </group>
  )
}

/** Overhead process pipe run with periodic hangers. */
function PipeRun({ w, runZ, height }: { w: number; runZ: number; height: number }) {
  return (
    <group>
      {[-0.35, 0, 0.35].map((off) => (
        <mesh
          key={off}
          geometry={UNIT_CYLINDER}
          material={MATERIALS.pipe}
          scale={[0.18, 0.18, w * 0.78]}
          position={[0, height, runZ + off]}
          rotation={[0, 0, Math.PI / 2]}
        />
      ))}
      {Array.from({ length: 5 }).map((_, i) => {
        const x = -w * 0.36 + (i * (w * 0.72)) / 4
        return <mesh key={i} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.08, 0.9, 1.1]} position={[x, height + 0.5, runZ]} />
      })}
    </group>
  )
}
