import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { AREA_LAYOUTS, BUILDING_LAYOUTS, SITE_GROUND, buildingLayoutById } from './layout'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, updateStatusMaterialPulses } from './geometries'
import { BMS_ASSET_LAYOUTS } from './facilityLayout'
import { FLOODLIGHT_HEX } from './colors'
import { AreaModel } from './AreaModel'
import { BuildingModel } from './BuildingModel'
import { BmsAssetModel } from './BmsAssetModel'
import { OpenBuildingShell } from './OpenBuildingShell'
import { ProductionBuilding } from './ProductionBuilding'
import { FloorInterior } from './FloorInteriors'
import { WarehouseInterior } from './WarehouseInterior'
import { UtilityInterior } from './UtilityInterior'
import { MaintenanceInterior } from './MaintenanceInterior'
import { SecurityAssets } from './SecurityAssets'
import { SafetyAssets } from './SafetyAssets'
import { SiteApproach } from './SiteApproach'
import { Rooms } from './RoomModel'
import { Vehicles } from './VehicleModels'
import { ConstructionZone } from './ConstructionZone'
import { CommissioningZone } from './CommissioningZone'
import { Labels } from './Labels'
import { StatusBeacons } from './StatusBeacons'
import { useSelection } from './selection'

// Buildings with a live "working interior" story get an open shell (no
// roof) so their contents are visible from the default view. The
// production building is a full multi-level structure of its own.
const OPEN_INTERIOR_IDS = new Set(['BLD-PROD', 'BLD-WARE', 'BLD-UTIL', 'BLD-MAINT'])

export function FacilityScene() {
  const { select, activeFloorId, floorMode } = useSelection()
  const [groundW, groundD] = SITE_GROUND
  const solidBuildings = BUILDING_LAYOUTS.filter((b) => !OPEN_INTERIOR_IDS.has(b.building.id))
  const warehouse = buildingLayoutById('BLD-WARE')
  const utility = buildingLayoutById('BLD-UTIL')
  const maintenance = buildingLayoutById('BLD-MAINT')

  // With a level isolated, only that level's content renders; otherwise the
  // whole building is shown at once.
  const isolating = floorMode === 'isolate' && activeFloorId !== null
  const showFloor = (id: string) => !isolating || activeFloorId === id

  // BMS plant that lives outside the production building (utility yard, admin roof).
  const externalBmsAssets = BMS_ASSET_LAYOUTS.filter((a) => a.asset.buildingId !== 'BLD-PROD')

  function onGroundClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('site', 'SITE-01')
  }

  return (
    <>
      <Lighting />
      <StatusPulseDriver />

      {/* ground — a touch of reflectivity so it picks up ambient light and
          the status glow above it, instead of sitting as a flat dark fill */}
      <mesh geometry={UNIT_BOX} material={MATERIALS.groundReflective} scale={[groundW, 0.2, groundD]} position={[0, -0.1, 0]} receiveShadow onClick={onGroundClick} />

      <Roads />
      <Perimeter />
      <SiteApproach />

      {solidBuildings.map((b) => (
        <BuildingModel key={b.building.id} layout={b} />
      ))}

      <ProductionBuilding />

      {/* ground floor holds the production areas, lines and equipment */}
      {showFloor('FLR-G') &&
        AREA_LAYOUTS.map((a) => (
          <AreaModel key={a.area.id} layout={a} />
        ))}
      {showFloor('FLR-G') && <StatusBeacons />}

      {showFloor("FLR-01") && <FloorInterior floorId="FLR-01" />}
      {showFloor("FLR-02") && <FloorInterior floorId="FLR-02" />}

      {/* enclosed rooms give each level a finished interior */}
      <Rooms visibleFloorIds={isolating && activeFloorId ? [activeFloorId] : null} />

      {warehouse && (
        <OpenBuildingShell layout={warehouse} wallHeight={3.2} wallMaterial={MATERIALS.wallWarm}>
          <WarehouseInterior layout={warehouse} />
        </OpenBuildingShell>
      )}
      {utility && (
        <OpenBuildingShell layout={utility} wallHeight={2.2} wallMaterial={MATERIALS.wallCool}>
          <UtilityInterior layout={utility} />
        </OpenBuildingShell>
      )}
      {maintenance && (
        <OpenBuildingShell layout={maintenance} wallHeight={2.6} wallMaterial={MATERIALS.wallWarm}>
          <MaintenanceInterior layout={maintenance} />
        </OpenBuildingShell>
      )}

      {externalBmsAssets.map((a) => (
        <BmsAssetModel key={a.asset.id} layout={a} />
      ))}

      {/* value-chain stages that have their own plot on the campus */}
      <ConstructionZone />
      <CommissioningZone />

      <SecurityAssets />
      <SafetyAssets />
      <Vehicles />
      <Labels />
    </>
  )
}

function Lighting() {
  const { timeOfDay } = useSelection()

  if (timeOfDay === 'night') {
    return (
      <>
        {/* Cool, dim moonlight fill — still enough to read building mass
            and geometry (a night scene that goes pure black just looks
            broken, not atmospheric), just markedly dimmer and bluer than
            daylight. */}
        <ambientLight intensity={0.22} />
        <hemisphereLight args={[0x5a76a8, 0x0e1218, 0.4]} />
        {/* The "moon": same caster as the day sun, lower intensity and a
            cool blue tone, still soft-shadowed for the same reason. */}
        <directionalLight
          position={[-40, 70, 50]}
          intensity={0.85}
          color={0x9fb6e8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
          shadow-camera-far={260}
          shadow-bias={-0.0003}
          shadow-radius={4}
        />
        <directionalLight position={[50, 30, -40]} intensity={0.22} color={0x6f86b8} />
        <NightFloodlights />
      </>
    )
  }

  return (
    <>
      {/* Open daylight: the sky itself is a large soft source, so the
          ambient/hemisphere fill carries real weight here rather than just
          lifting the shadows off black. The key light still has to out-run
          it comfortably or the scene goes flat and shadowless. */}
      <ambientLight intensity={0.85} />
      <hemisphereLight args={[0xcfe2f2, 0x5a6068, 1.1]} />
      {/* Key light: the one caster. Soft-shadow map (set on the canvas) plus
          a shadow-radius blur is what keeps the shadow edge soft rather
          than a hard, aliased line. */}
      <directionalLight
        position={[60, 90, 40]}
        intensity={3.4}
        color={0xfff4e2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-camera-far={260}
        shadow-bias={-0.0003}
        shadow-radius={4}
      />
      {/* Soft fill from the opposite side, no shadow casting — this is what
          stops the unlit face of every building reading as flat black. */}
      <directionalLight position={[-50, 40, -60]} intensity={1.1} color={0xdce8f5} />
    </>
  )
}

/**
 * Warm sodium-vapor point lights at the main gate and each major building's
 * entrance — without these, "night mode" is just a dark version of the day
 * scene rather than a facility that visibly runs its own lighting after
 * hours.
 */
function NightFloodlights() {
  // Placed just outside each building's real footprint (see BUILDING_LAYOUTS
  // in layout.ts) so the light pool actually lands on a facade or the
  // ground in front of it, not inside a solid wall where it'd never
  // reach the camera.
  const positions: [number, number, number][] = [
    [0, 8, 46], // main gate
    [-2, 14, 22], // production building main facade
    [38, 14, -10], // production building east flank
    [50, 8, 22], // warehouse forecourt
    [48, 8, -52], // utility yard
    [-46, 8, -52], // maintenance forecourt
    [-43, 10, 22], // admin building
  ]
  return (
    <>
      {positions.map((p, i) => (
        <pointLight key={i} position={p} color={FLOODLIGHT_HEX} intensity={55} distance={42} decay={2} />
      ))}
    </>
  )
}

/**
 * Advances the shared status-material pulses once per frame. A single
 * driver here — rather than each of the ~150+ status-colored meshes across
 * the facility running its own animation — keeps the "breathing" glow
 * synchronized and cheap: it only ever touches the handful of cached
 * materials in geometries.ts, never per-mesh state.
 */
function StatusPulseDriver() {
  useFrame((frame) => updateStatusMaterialPulses(frame.clock.elapsedTime))
  return null
}

function Roads() {
  const segments: { pos: [number, number]; size: [number, number] }[] = [
    { pos: [0, 47], size: [10, 20] }, // gate approach
    { pos: [15, 20], size: [70, 6] }, // main east-west spine
    { pos: [48, -10], size: [6, 46] }, // spine to warehouse/utility
    { pos: [-44, -6], size: [6, 60] }, // spine to admin/maintenance
  ]
  return (
    <>
      {segments.map((s, i) => (
        <mesh key={i} geometry={UNIT_BOX} material={MATERIALS.road} scale={[s.size[0], 0.05, s.size[1]]} position={[s.pos[0], 0.02, s.pos[1]]} receiveShadow />
      ))}
    </>
  )
}

function Perimeter() {
  const meshRef = useRef<THREE.InstancedMesh | null>(null)
  const [w, d] = SITE_GROUND
  const posts = useMemo(() => {
    const spacing = 8
    const pts: [number, number][] = []
    for (let x = -w / 2; x <= w / 2; x += spacing) {
      pts.push([x, -d / 2])
      pts.push([x, d / 2])
    }
    for (let z = -d / 2 + spacing; z < d / 2; z += spacing) {
      pts.push([-w / 2, z])
      pts.push([w / 2, z])
    }
    return pts
  }, [w, d])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Positions are static, so set them once via a ref callback instead of every frame.
  function setRef(mesh: THREE.InstancedMesh | null) {
    meshRef.current = mesh
    if (!mesh) return
    posts.forEach(([x, z], i) => {
      dummy.position.set(x, 0.75, z)
      dummy.scale.set(0.06, 1.5, 0.06)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  return (
    <>
      <instancedMesh ref={setRef} args={[UNIT_CYLINDER, undefined, posts.length]} frustumCulled={false}>
        <primitive object={MATERIALS.fence} attach="material" />
      </instancedMesh>
      <FenceRails w={w} d={d} />
    </>
  )
}

/** Two horizontal rails running the perimeter, connecting the fence posts into a continuous line. */
function FenceRails({ w, d }: { w: number; d: number }) {
  const rails: { scale: [number, number, number]; pos: [number, number, number] }[] = [
    { scale: [w, 0.06, 0.06], pos: [0, 1.1, -d / 2] },
    { scale: [w, 0.06, 0.06], pos: [0, 1.1, d / 2] },
    { scale: [0.06, 0.06, d], pos: [-w / 2, 1.1, 0] },
    { scale: [0.06, 0.06, d], pos: [w / 2, 1.1, 0] },
  ]
  return (
    <>
      {rails.map((r, i) => (
        <mesh key={i} geometry={UNIT_BOX} material={MATERIALS.fence} scale={r.scale} position={r.pos} />
      ))}
    </>
  )
}
