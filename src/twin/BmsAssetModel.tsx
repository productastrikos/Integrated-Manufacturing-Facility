import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import type * as THREE from 'three'
import { ACCENT_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, UNIT_CONE, getStatusMaterial } from './geometries'
import type { BmsAssetLayout } from './facilityLayout'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'

/**
 * A physical building-services asset — air handler, chiller, transformer,
 * generator, compressor, pump, panel or tank. Each is a composed assembly
 * rather than a labelled cube, and each is individually selectable so BMS
 * rows and 3D objects are the same thing.
 *
 * Only the primary body carries the live status colour; ducts, frames and
 * pipework stay neutral steel so the plant deck doesn't read as a signal
 * board.
 */
export function BmsAssetModel({ layout }: { layout: BmsAssetLayout }) {
  const state = useSimulation()
  const { selection, select } = useSelection()
  const [hovered, setHovered] = useState(false)

  const asset = state.bmsAssets.find((a) => a.id === layout.asset.id) ?? layout.asset
  const isSelected = selection?.kind === 'bms' && selection.id === asset.id
  // BMS status vocabulary maps onto the shared equipment status colours.
  const statusMat = useMemo(
    () => getStatusMaterial(asset.status === 'warning' ? 'warning' : asset.status === 'idle' ? 'idle' : asset.status === 'maintenance' ? 'maintenance' : 'running'),
    [asset.status],
  )
  const [w, h, d] = layout.footprint

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('bms', asset.id)
  }

  return (
    <group
      position={layout.position}
      rotation={[0, layout.rotationY, 0]}
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
      <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 1.06, 0.12, d * 1.06]} position={[0, 0.06, 0]} receiveShadow />
      <BmsAssetBody type={asset.type} w={w} h={h} d={d} statusMaterial={statusMat} />

      {(isSelected || hovered) && (
        <mesh geometry={UNIT_BOX} scale={[w * 1.1, h * 1.12, d * 1.1]} position={[0, h / 2, 0]}>
          <meshBasicMaterial visible={false} />
          <Outlines thickness={isSelected ? 2.4 : 1.4} color={isSelected ? ACCENT_HEX : 0xffffff} transparent opacity={isSelected ? 0.95 : 0.5} />
        </mesh>
      )}
    </group>
  )
}

function BmsAssetBody({
  type,
  w,
  h,
  d,
  statusMaterial,
}: {
  type: BmsAssetLayout['asset']['type']
  w: number
  h: number
  d: number
  statusMaterial: THREE.Material
}) {
  switch (type) {
    case 'ahu':
      return (
        <group>
          {/* sectional casing — an AHU reads as several joined modules */}
          {[-1, 0, 1].map((k) => (
            <mesh key={k} geometry={UNIT_BOX} material={k === 0 ? statusMaterial : MATERIALS.steel} scale={[w / 3.15, h, d]} position={[(k * w) / 3, h / 2 + 0.12, 0]} castShadow />
          ))}
          {/* supply + return duct spigots */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.pipe} scale={[1.1, h * 0.5, d * 0.55]} position={[-w / 2 - 0.5, h * 0.6, 0]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.pipe} scale={[1.1, h * 0.5, d * 0.55]} position={[w / 2 + 0.5, h * 0.6, 0]} />
          {/* access doors + control box */}
          {[-1, 0, 1].map((k) => (
            <mesh key={`dr-${k}`} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w / 4.2, h * 0.62, 0.05]} position={[(k * w) / 3, h * 0.5, d / 2 + 0.03]} />
          ))}
          <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[0.5, 0.7, 0.16]} position={[w / 2 - 0.4, h * 0.62, d / 2 + 0.1]} />
        </group>
      )
    case 'chiller':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w, h * 0.62, d]} position={[0, (h * 0.62) / 2 + 0.12, 0]} castShadow />
          {/* condenser fan bank on top */}
          {[-1, 1].map((k) => (
            <group key={k} position={[(k * w) / 3.4, h * 0.66, 0]}>
              <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[d * 0.34, d * 0.34, 0.3]} />
              <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[d * 0.1, d * 0.1, 0.42]} position={[0, 0.1, 0]} />
            </group>
          ))}
          {/* refrigerant/chilled water headers */}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.2, 0.2, w * 0.9]} position={[0, h * 0.22, d / 2 + 0.28]} rotation={[0, 0, Math.PI / 2]} />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.2, 0.2, w * 0.9]} position={[0, h * 0.42, d / 2 + 0.28]} rotation={[0, 0, Math.PI / 2]} />
        </group>
      )
    case 'transformer':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w * 0.8, h * 0.78, d * 0.8]} position={[0, (h * 0.78) / 2 + 0.12, 0]} castShadow />
          {/* radiator fins down both flanks */}
          {[-1, 1].map((sx) =>
            [-0.6, -0.2, 0.2, 0.6].map((oz, i) => (
              <mesh key={`${sx}-${i}`} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.16, h * 0.6, 0.1]} position={[(sx * w) / 2.3, h * 0.42, oz * d * 0.6]} />
            )),
          )}
          {/* HV bushings */}
          {[-1, 0, 1].map((k) => (
            <mesh key={`b-${k}`} geometry={UNIT_CONE} material={MATERIALS.glass} scale={[0.22, 0.22, 0.8]} position={[(k * w) / 4, h * 0.78 + 0.5, 0]} />
          ))}
        </group>
      )
    case 'generator':
      return (
        <group>
          {/* skid-mounted set inside an acoustic enclosure */}
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w, h * 0.72, d]} position={[0, (h * 0.72) / 2 + 0.12, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 1.02, 0.14, d * 1.02]} position={[0, h * 0.72 + 0.18, 0]} />
          {/* exhaust stack */}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.22, 0.22, h * 0.9]} position={[w / 2 - 0.5, h * 1.1, -d / 2 + 0.4]} />
          {/* louvre bands */}
          {[0.3, 0.5, 0.7].map((f) => (
            <mesh key={f} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.5, 0.08, 0.05]} position={[-w * 0.2, h * f, d / 2 + 0.03]} />
          ))}
        </group>
      )
    case 'compressor':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w, h * 0.7, d]} position={[0, (h * 0.7) / 2 + 0.12, 0]} castShadow />
          {/* air receiver alongside */}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.tank} scale={[0.55, 0.55, h * 0.95]} position={[w / 2 + 0.7, h * 0.55, 0]} castShadow />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.1, 0.1, 1.4]} position={[w / 2 + 0.2, h * 0.72, 0]} rotation={[0, 0, Math.PI / 2]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[0.4, 0.5, 0.12]} position={[-w * 0.25, h * 0.5, d / 2 + 0.07]} />
        </group>
      )
    case 'pump':
      return (
        <group>
          {/* pump body + coupled motor on a common baseplate */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w, 0.16, d]} position={[0, 0.2, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={statusMaterial} scale={[d * 0.36, d * 0.36, w * 0.42]} position={[-w * 0.2, h * 0.45, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[d * 0.28, d * 0.28, w * 0.36]} position={[w * 0.25, h * 0.45, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
          {/* suction + discharge pipework */}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.14, 0.14, h]} position={[-w * 0.2, h * 0.9, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.14, 0.14, d * 0.9]} position={[-w * 0.2, h * 0.45, d * 0.5]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      )
    case 'panel':
      return (
        <group>
          {/* cabinet bank */}
          {[-1, 0, 1].map((k) => (
            <mesh key={k} geometry={UNIT_BOX} material={k === 0 ? statusMaterial : MATERIALS.transformer} scale={[w / 3.15, h, d]} position={[(k * w) / 3, h / 2 + 0.12, 0]} castShadow />
          ))}
          {/* door handles + indicator strip */}
          {[-1, 0, 1].map((k) => (
            <mesh key={`h-${k}`} geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.06, h * 0.3, 0.05]} position={[(k * w) / 3 + w / 8, h * 0.55, d / 2 + 0.03]} />
          ))}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w, 0.1, d * 1.05]} position={[0, h + 0.16, 0]} />
        </group>
      )
    case 'tank':
      return (
        <group>
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[w * 0.52, w * 0.52, 0.2]} position={[0, 0.2, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={statusMaterial} scale={[w * 0.46, w * 0.46, h * 0.82]} position={[0, (h * 0.82) / 2 + 0.25, 0]} castShadow />
          <mesh geometry={UNIT_CONE} material={MATERIALS.steelDark} scale={[w * 0.48, w * 0.48, h * 0.16]} position={[0, h * 0.82 + h * 0.08 + 0.25, 0]} />
          {/* level gauge + outlet valve */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.pipe} scale={[0.07, h * 0.66, 0.07]} position={[w * 0.47, h * 0.45, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.12, 0.12, 0.9]} position={[w * 0.6, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.2, 0.2, 0.2]} position={[w * 0.95, 0.65, 0]} />
        </group>
      )
    default:
      return <mesh geometry={UNIT_BOX} material={statusMaterial} scale={[w, h, d]} position={[0, h / 2 + 0.12, 0]} castShadow />
  }
}
