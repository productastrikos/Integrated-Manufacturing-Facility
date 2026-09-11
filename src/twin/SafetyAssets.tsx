import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import { ACCENT_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, UNIT_CONE, getNeutralMaterial } from './geometries'
import { SAFETY_ASSET_LAYOUTS, type SafetyAssetLayout } from './facilityLayout'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'

/** Muted safety palette — visible enough to find, restrained enough not to shout. */
const SAFETY_RED = getNeutralMaterial(0xa8544a, 0.6, 0.1)
const SAFETY_GREEN = getNeutralMaterial(0x57946f, 0.6, 0.1)
const SAFETY_WHITE = getNeutralMaterial(0x9aa6b0, 0.7, 0.05)

/** Physical safety infrastructure, placed where it would really be and individually selectable. */
export function SafetyAssets() {
  return (
    <group>
      {SAFETY_ASSET_LAYOUTS.map((a) => (
        <SafetyAssetModel key={a.asset.id} layout={a} />
      ))}
    </group>
  )
}

function SafetyAssetModel({ layout }: { layout: SafetyAssetLayout }) {
  const state = useSimulation()
  const { selection, select } = useSelection()
  const [hovered, setHovered] = useState(false)

  const asset = state.safetyAssets.find((a) => a.id === layout.asset.id) ?? layout.asset
  const isSelected = selection?.kind === 'safety' && selection.id === asset.id

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('safety', asset.id)
  }

  return (
    <group
      position={layout.position}
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
      <SafetyBody type={asset.type} />
      {(isSelected || hovered) && (
        <mesh geometry={UNIT_BOX} scale={asset.type === 'muster' ? [6, 1, 6] : [1.1, 1.8, 1.1]} position={[0, asset.type === 'muster' ? 0.5 : 0.6, 0]}>
          <meshBasicMaterial visible={false} />
          <Outlines thickness={isSelected ? 2.4 : 1.4} color={isSelected ? ACCENT_HEX : 0xffffff} transparent opacity={isSelected ? 0.95 : 0.45} />
        </mesh>
      )}
    </group>
  )
}

function SafetyBody({ type }: { type: SafetyAssetLayout['asset']['type'] }) {
  switch (type) {
    case 'extinguisher':
      return (
        <group>
          {/* wall bracket + cylinder + horn */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.3, 0.5, 0.06]} position={[0, 0.55, -0.16]} />
          <mesh geometry={UNIT_CYLINDER} material={SAFETY_RED} scale={[0.14, 0.14, 0.66]} position={[0, 0.55, 0]} castShadow />
          <mesh geometry={UNIT_CONE} material={SAFETY_RED} scale={[0.14, 0.14, 0.14]} position={[0, 0.93, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.04, 0.04, 0.16]} position={[0, 1.02, 0]} />
        </group>
      )
    case 'exit':
      return (
        <group>
          {/* door reveal + illuminated exit sign above it */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.6, 2.2, 0.08]} position={[0, 1.1, 0]} />
          <mesh geometry={UNIT_BOX} material={SAFETY_GREEN} scale={[0.8, 0.26, 0.06]} position={[0, 2.45, 0.05]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[1.8, 0.02, 1.2]} position={[0, -0.09, 0.7]} />
        </group>
      )
    case 'muster':
      return (
        <group>
          {/* painted assembly area + sign post */}
          <mesh geometry={UNIT_BOX} material={SAFETY_GREEN} scale={[6, 0.02, 6]} position={[0, 0.02, 0]} />
          <mesh geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[5.4, 0.03, 5.4]} position={[0, 0.03, 0]} />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[0.08, 0.08, 2.6]} position={[2.4, 1.3, 2.4]} castShadow />
          <mesh geometry={UNIT_BOX} material={SAFETY_GREEN} scale={[1, 0.7, 0.05]} position={[2.4, 2.6, 2.4]} />
        </group>
      )
    case 'firePanel':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={SAFETY_RED} scale={[0.7, 0.9, 0.18]} position={[0, 0.9, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[0.48, 0.34, 0.03]} position={[0, 1.05, 0.1]} />
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[0.06, 0.06, 0.1]} position={[0, 0.66, 0.1]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      )
    case 'eyewash':
      return (
        <group>
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.07, 0.07, 1.2]} position={[0, 0.6, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={SAFETY_GREEN} scale={[0.5, 0.1, 0.34]} position={[0, 1.2, 0]} />
          {[-1, 1].map((k) => (
            <mesh key={k} geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.05, 0.05, 0.12]} position={[k * 0.14, 1.3, 0]} />
          ))}
          <mesh geometry={UNIT_CYLINDER} material={MATERIALS.concreteLight} scale={[0.3, 0.3, 0.1]} position={[0, 0.05, 0]} />
        </group>
      )
    case 'firstAid':
      return (
        <group>
          <mesh geometry={UNIT_BOX} material={SAFETY_WHITE} scale={[0.6, 0.7, 0.22]} position={[0, 0.9, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={SAFETY_GREEN} scale={[0.34, 0.1, 0.03]} position={[0, 0.9, 0.12]} />
          <mesh geometry={UNIT_BOX} material={SAFETY_GREEN} scale={[0.1, 0.34, 0.03]} position={[0, 0.9, 0.12]} />
        </group>
      )
    default:
      return <mesh geometry={UNIT_BOX} material={SAFETY_WHITE} scale={[0.5, 0.7, 0.3]} position={[0, 0.35, 0]} />
  }
}
