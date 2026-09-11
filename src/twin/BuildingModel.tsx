import { Html, Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import type * as THREE from 'three'
import { UNIT_BOX, UNIT_CONE, UNIT_CYLINDER, MATERIALS } from './geometries'
import { ACCENT_HEX } from './colors'
import type { BuildingLayout } from './layout'
import { useSelection } from './selection'
import { useSimulation } from '../simulation/useSimulation'
import { buildingQuickStat } from './zoneIntel'

const ZONE_DOT_COLOR: Record<'normal' | 'warning' | 'critical', string> = {
  normal: 'var(--app-success)',
  warning: 'var(--app-warning)',
  critical: 'var(--app-danger)',
}

/**
 * Solid-block facility (Administration, Loading/Dispatch, Security, Main
 * Gate) — the buildings whose interiors don't need a live production
 * story, so a real roof usually stays on. The Production Building,
 * Warehouse, Utility Area and Maintenance Area are rendered open (see
 * OpenBuildingShell in FacilityScene) so their interiors are visible by
 * default; this component's roof also lifts off under the Cutaway toggle.
 */
// Each solid building gets a slightly different wall tone — cooler for the
// office/security buildings, warmer for the industrial dispatch shed — so
// the campus reads as a set of distinct real structures rather than one
// material repeated across every block.
const WALL_MATERIAL_BY_ID: Record<string, THREE.Material> = {
  'BLD-ADMIN': MATERIALS.wallCool,
  'BLD-SEC': MATERIALS.wallCool,
  'BLD-LOAD': MATERIALS.wallWarm,
}

export function BuildingModel({ layout }: { layout: BuildingLayout }) {
  const { selection, select, cutaway } = useSelection()
  const state = useSimulation()
  const [hovered, setHovered] = useState(false)
  const isSelected = selection?.kind === 'building' && selection.id === layout.building.id
  const [w, d] = layout.size
  const h = layout.height
  const isGate = layout.building.kind === 'gate'
  const id = layout.building.id
  const wallMaterial = WALL_MATERIAL_BY_ID[id] ?? MATERIALS.wallLight
  const quickStat = hovered ? buildingQuickStat(id, state) : null

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('building', id)
  }

  return (
    <group
      position={[layout.center[0], 0, layout.center[1]]}
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
      {quickStat && !isSelected && (
        <Html position={[0, h + 1.6, 0]} center distanceFactor={30} occlude={false}>
          <div className="twin-hover-tooltip">
            <div className="twin-hover-tooltip-title">{layout.building.name}</div>
            <div className="twin-hover-tooltip-row">
              <span style={{ color: ZONE_DOT_COLOR[quickStat.zone] }}>●</span>
              {quickStat.line}
            </div>
          </div>
        </Html>
      )}
      {isGate ? (
        <>
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.6, h, 0.6]} position={[-w / 2 + 0.3, h / 2, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.6, h, 0.6]} position={[w / 2 - 0.3, h / 2, 0]} castShadow />
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w, 0.5, 0.5]} position={[0, h - 0.25, 0]} castShadow>
            {isSelected && <Outlines thickness={2} color={ACCENT_HEX} />}
          </mesh>
          {/* boom barrier arm */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.42, 0.08, 0.08]} position={[-w * 0.21, 1.1, 0]} />
        </>
      ) : (
        <>
          {/* base plinth */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.concreteLight} scale={[w * 1.04, 0.3, d * 1.04]} position={[0, 0.15, 0]} receiveShadow />

          <mesh geometry={UNIT_BOX} material={wallMaterial} scale={[w, h, d]} position={[0, h / 2 + 0.15, 0]} castShadow receiveShadow>
            {isSelected && <Outlines thickness={2.2} color={ACCENT_HEX} transparent opacity={0.9} />}
          </mesh>

          {/* corner columns — read as structure, not a flat box */}
          {[
            [-w / 2 + 0.15, -d / 2 + 0.15],
            [w / 2 - 0.15, -d / 2 + 0.15],
            [-w / 2 + 0.15, d / 2 - 0.15],
            [w / 2 - 0.15, d / 2 - 0.15],
          ].map(([cx, cz], i) => (
            <mesh key={i} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.3, h, 0.3]} position={[cx, h / 2 + 0.15, cz]} />
          ))}

          {!cutaway && (
            <>
              <mesh geometry={UNIT_BOX} material={MATERIALS.roof} scale={[w * 1.02, 0.3, d * 1.02]} position={[0, h + 0.3, 0]} />
              {/* roof parapet trim */}
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 1.02, 0.12, 0.1]} position={[0, h + 0.51, d / 2]} />
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 1.02, 0.12, 0.1]} position={[0, h + 0.51, -d / 2]} />
            </>
          )}

          {/* a band of glazing near the roofline reads as an office/admin facade */}
          {layout.building.kind === 'building' && (
            <mesh geometry={UNIT_BOX} material={MATERIALS.glass} scale={[w * 0.9, h * 0.18, 0.05]} position={[0, h * 0.78 + 0.15, d / 2 + 0.03]} />
          )}
          {layout.building.kind === 'area' && (
            <mesh geometry={UNIT_CONE} material={MATERIALS.steelDark} scale={[0.35, 0.35, 1.4]} position={[w / 2 - 1, h + 0.85, d / 2 - 1]} />
          )}

          {/* loading-door insets for Loading/Dispatch */}
          {id === 'BLD-LOAD' && (
            <group>
              {[-1, 0, 1].map((k) => (
                <mesh key={k} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.16, h * 0.55, 0.06]} position={[k * w * 0.24, h * 0.3, d / 2 + 0.05]} />
              ))}
              {/* dock canopy */}
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.9, 0.1, 1.4]} position={[0, h * 0.62, d / 2 + 0.7]} />
              {[-1, 1].map((sx) => (
                <mesh key={sx} geometry={UNIT_CYLINDER} material={MATERIALS.steel} scale={[0.06, 0.06, h * 0.62]} position={[sx * w * 0.4, h * 0.31, d / 2 + 1.35]} />
              ))}
            </group>
          )}

          {/* small security guard window band */}
          {id === 'BLD-SEC' && <mesh geometry={UNIT_BOX} material={MATERIALS.glass} scale={[w * 0.7, h * 0.3, 0.04]} position={[0, h * 0.55 + 0.15, d / 2 + 0.03]} />}
        </>
      )}
    </group>
  )
}
