import { Outlines } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import { ACCENT_HEX, MATERIAL_HEX } from './colors'
import { MATERIALS, UNIT_BOX, UNIT_CYLINDER, getNeutralMaterial } from './geometries'
import { ROOM_LAYOUTS, type RoomLayout } from './facilityLayout'
import { useSelection } from './selection'
import type { RoomKind } from '../simulation/types'

/**
 * Enclosed rooms on a building level. Each has real partition walls with a
 * door opening, a finished floor, a ceiling, and a fit-out appropriate to
 * what it is — consoles in a control room, racks in the server room,
 * benches in the workshop. This is what turns an open deck into a finished
 * building interior, and adds Room to the navigable hierarchy.
 */

const PARTITION = getNeutralMaterial(0x59636e, 0.86, 0.05)
const CEILING = getNeutralMaterial(0x4d5661, 0.92, 0.02)
const ROOM_FLOOR = getNeutralMaterial(0x59616b, 0.88, 0.03)
const SCREEN = getNeutralMaterial(0x35506e, 0.4, 0.3)
const GLAZING = getNeutralMaterial(MATERIAL_HEX.glass, 0.2, 0.6)

export function Rooms({ visibleFloorIds }: { visibleFloorIds: string[] | null }) {
  const rooms = visibleFloorIds ? ROOM_LAYOUTS.filter((r) => visibleFloorIds.includes(r.room.floorId)) : ROOM_LAYOUTS
  return (
    <group>
      {rooms.map((r) => (
        <RoomModel key={r.room.id} layout={r} />
      ))}
    </group>
  )
}

function RoomModel({ layout }: { layout: RoomLayout }) {
  const { selection, select, activeFloorId, floorMode } = useSelection()
  const [hovered, setHovered] = useState(false)
  const isSelected = selection?.kind === 'room' && selection.id === layout.room.id

  // Once the user has isolated this level they are working inside it, so the
  // room ceilings come off — otherwise every room reads as a sealed block and
  // the fit-out that explains what the room is for stays hidden.
  const opened = floorMode === 'isolate' && activeFloorId === layout.room.floorId

  const [w, d] = layout.size
  const h = layout.height
  const t = 0.22
  const doorW = 1.8

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    select('room', layout.room.id)
  }

  // Each wall is drawn as one slab, except the one carrying the door, which
  // is split into two piers with a header over the opening.
  const walls: { side: RoomLayout['doorSide']; scale: [number, number, number]; pos: [number, number, number]; axis: 'x' | 'z' }[] = [
    { side: 'south', scale: [w, h, t], pos: [0, h / 2, d / 2], axis: 'x' },
    { side: 'north', scale: [w, h, t], pos: [0, h / 2, -d / 2], axis: 'x' },
    { side: 'east', scale: [t, h, d], pos: [w / 2, h / 2, 0], axis: 'z' },
    { side: 'west', scale: [t, h, d], pos: [-w / 2, h / 2, 0], axis: 'z' },
  ]

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
      {/* finished floor inside the room */}
      <mesh geometry={UNIT_BOX} material={ROOM_FLOOR} scale={[w, 0.06, d]} position={[0, 0.03, 0]} receiveShadow />

      {walls.map((wall) => {
        if (wall.side !== layout.doorSide) {
          return <mesh key={wall.side} geometry={UNIT_BOX} material={PARTITION} scale={wall.scale} position={wall.pos} castShadow receiveShadow />
        }

        // Doorway: two piers either side of the opening plus a header above.
        const span = wall.axis === 'x' ? w : d
        const pier = (span - doorW) / 2
        const off = doorW / 2 + pier / 2
        const pierScale: [number, number, number] = wall.axis === 'x' ? [pier, h, t] : [t, h, pier]
        const headerScale: [number, number, number] = wall.axis === 'x' ? [doorW, h - 2.2, t] : [t, h - 2.2, doorW]

        return (
          <group key={wall.side}>
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                geometry={UNIT_BOX}
                material={PARTITION}
                scale={pierScale}
                position={
                  wall.axis === 'x'
                    ? [s * off, h / 2, wall.pos[2]]
                    : [wall.pos[0], h / 2, s * off]
                }
                castShadow
                receiveShadow
              />
            ))}
            <mesh geometry={UNIT_BOX} material={PARTITION} scale={headerScale} position={[wall.pos[0], h - (h - 2.2) / 2, wall.pos[2]]} />
          </group>
        )
      })}

      {/* vision panel in the wall opposite the door, so rooms read as occupied space */}
      <VisionPanel doorSide={layout.doorSide} w={w} d={d} h={h} />

      {/* ceiling — lifted while the level is isolated so the room is legible */}
      {!opened && <mesh geometry={UNIT_BOX} material={CEILING} scale={[w, 0.14, d]} position={[0, h - 0.07, 0]} />}

      <RoomFitOut kind={layout.room.kind} w={w} d={d} h={h} />

      {(isSelected || hovered) && (
        <mesh geometry={UNIT_BOX} scale={[w + 0.4, h + 0.3, d + 0.4]} position={[0, h / 2, 0]}>
          <meshBasicMaterial visible={false} />
          <Outlines thickness={isSelected ? 2.6 : 1.4} color={isSelected ? ACCENT_HEX : 0xffffff} transparent opacity={isSelected ? 0.95 : 0.45} />
        </mesh>
      )}
    </group>
  )
}

/** A glazed strip in the wall facing away from the door. */
function VisionPanel({ doorSide, w, d, h }: { doorSide: RoomLayout['doorSide']; w: number; d: number; h: number }) {
  const opposite = doorSide === 'north' ? 'south' : doorSide === 'south' ? 'north' : doorSide === 'east' ? 'west' : 'east'
  const y = h * 0.62
  if (opposite === 'south') return <mesh geometry={UNIT_BOX} material={GLAZING} scale={[w * 0.72, 1.1, 0.08]} position={[0, y, d / 2 + 0.02]} />
  if (opposite === 'north') return <mesh geometry={UNIT_BOX} material={GLAZING} scale={[w * 0.72, 1.1, 0.08]} position={[0, y, -d / 2 - 0.02]} />
  if (opposite === 'east') return <mesh geometry={UNIT_BOX} material={GLAZING} scale={[0.08, 1.1, d * 0.72]} position={[w / 2 + 0.02, y, 0]} />
  return <mesh geometry={UNIT_BOX} material={GLAZING} scale={[0.08, 1.1, d * 0.72]} position={[-w / 2 - 0.02, y, 0]} />
}

/** Furniture and equipment appropriate to what the room is for. */
function RoomFitOut({ kind, w, d, h }: { kind: RoomKind; w: number; d: number; h: number }) {
  switch (kind) {
    case 'control':
      return (
        <group>
          {/* curved operator desk with consoles */}
          {[-1, 0, 1].map((k) => (
            <group key={k} position={[k * (w / 4), 0, d * 0.12]}>
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w / 4.6, 0.1, 1.4]} position={[0, 0.78, 0]} castShadow />
              <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.1, 0.72, 0.1]} position={[0, 0.4, 0]} />
              <mesh geometry={UNIT_BOX} material={SCREEN} scale={[w / 5.4, 0.6, 0.06]} position={[0, 1.2, -0.5]} />
              {/* operator chair */}
              <mesh geometry={UNIT_CYLINDER} material={MATERIALS.steelDark} scale={[0.28, 0.28, 0.12]} position={[0, 0.5, 1.1]} />
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.5, 0.6, 0.1]} position={[0, 0.85, 1.35]} />
            </group>
          ))}
          {/* facility overview video wall */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.68, 1.9, 0.12]} position={[0, h * 0.55, -d / 2 + 0.35]} />
          {[-1, 0, 1].map((k) => (
            <mesh key={`vw-${k}`} geometry={UNIT_BOX} material={SCREEN} scale={[w * 0.2, 1.5, 0.04]} position={[k * w * 0.22, h * 0.55, -d / 2 + 0.44]} />
          ))}
        </group>
      )
    case 'electrical':
      return (
        <group>
          {/* switchgear line-up against the back wall */}
          {[-2, -1, 0, 1, 2].map((k) => (
            <group key={k} position={[k * 1.9, 0, -d / 2 + 1.1]}>
              <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[1.7, 2.2, 1]} position={[0, 1.1, 0]} castShadow />
              <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[0.06, 0.5, 0.05]} position={[0.7, 1.2, 0.53]} />
              <mesh geometry={UNIT_BOX} material={SCREEN} scale={[0.5, 0.3, 0.03]} position={[0, 1.8, 0.53]} />
            </group>
          ))}
          {/* cable trays overhead */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[w * 0.8, 0.06, 0.5]} position={[0, h - 0.6, -d * 0.2]} />
        </group>
      )
    case 'server':
      return (
        <group>
          {/* two rack rows with a cold aisle between them */}
          {[-1, 1].map((row) =>
            [-1.5, -0.5, 0.5, 1.5].map((k) => (
              <group key={`${row}-${k}`} position={[k * 1.1, 0, row * 1.6]}>
                <mesh geometry={UNIT_BOX} material={MATERIALS.transformer} scale={[0.95, 2.1, 1.05]} position={[0, 1.05, 0]} castShadow />
                {[0.5, 1, 1.5].map((y) => (
                  <mesh key={y} geometry={UNIT_BOX} material={SCREEN} scale={[0.7, 0.06, 0.03]} position={[0, y, row * 0.54]} />
                ))}
              </group>
            )),
          )}
          {/* in-row cooling unit */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[1, 2.1, 1.05]} position={[-w / 2 + 1.2, 1.05, 0]} castShadow />
        </group>
      )
    case 'maintenance':
      return (
        <group>
          {[-1, 1].map((k) => (
            <group key={k} position={[k * (w / 4), 0, -d / 2 + 1.2]}>
              <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[w / 3.4, 0.1, 1]} position={[0, 0.9, 0]} castShadow />
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w / 3.4, 0.9, 0.08]} position={[0, 0.45, -0.45]} />
            </group>
          ))}
          {/* parts shelving */}
          <group position={[w / 2 - 0.8, 0, 0]}>
            {[0.6, 1.4, 2.2].map((y) => (
              <mesh key={y} geometry={UNIT_BOX} material={MATERIALS.rack} scale={[1.1, 0.08, d * 0.6]} position={[0, y, 0]} />
            ))}
          </group>
          {/* tool board */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.08, 1.6, d * 0.4]} position={[-w / 2 + 0.2, 1.7, 0]} />
        </group>
      )
    case 'quality':
      return (
        <group>
          {[-1, 0, 1].map((k) => (
            <group key={k} position={[k * (w / 3.6), 0, 0]}>
              <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[2, 0.1, 1.2]} position={[0, 0.9, 0]} castShadow />
              {/* measuring head over the bench */}
              <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.35, 0.9, 0.35]} position={[0, 1.4, -0.2]} />
              <mesh geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.06, 0.06, 0.5]} position={[0, 1.05, 0.15]} />
              <mesh geometry={UNIT_BOX} material={SCREEN} scale={[0.5, 0.36, 0.04]} position={[0.6, 1.3, -0.3]} />
            </group>
          ))}
          {/* sample storage cabinet */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.2, 2, d * 0.5]} position={[-w / 2 + 0.9, 1, d * 0.2]} castShadow />
        </group>
      )
    case 'security':
      return (
        <group>
          {/* CCTV monitoring wall */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.7, 2, 0.12]} position={[0, h * 0.55, -d / 2 + 0.35]} />
          {[-1, 0, 1].map((cx) =>
            [-0.45, 0.45].map((cy) => (
              <mesh key={`${cx}-${cy}`} geometry={UNIT_BOX} material={SCREEN} scale={[w * 0.19, 0.7, 0.04]} position={[cx * w * 0.22, h * 0.55 + cy, -d / 2 + 0.44]} />
            )),
          )}
          {/* operator desk */}
          <mesh geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[w * 0.55, 0.1, 1.3]} position={[0, 0.78, 0.2]} castShadow />
          <mesh geometry={UNIT_BOX} material={SCREEN} scale={[1.2, 0.5, 0.05]} position={[0, 1.1, -0.2]} />
        </group>
      )
    case 'mechanical':
      return (
        <group>
          {/* plant room is mostly occupied by BMS assets rendered separately;
              this adds the pipework and housekeeping around them */}
          {[-0.3, 0, 0.3].map((f) => (
            <mesh key={f} geometry={UNIT_CYLINDER} material={MATERIALS.pipe} scale={[0.18, 0.18, w * 0.85]} position={[0, h - 0.9, f * d * 0.5]} rotation={[0, 0, Math.PI / 2]} />
          ))}
          <mesh geometry={UNIT_BOX} material={MATERIALS.walkway} scale={[w * 0.8, 0.03, 1.6]} position={[0, 0.08, 0]} />
        </group>
      )
    case 'storage':
      return (
        <group>
          {/* shelving bays down both long walls */}
          {[-1, 1].map((side) => (
            <group key={side} position={[0, 0, side * (d / 2 - 0.9)]}>
              {[0.5, 1.3, 2.1].map((y) => (
                <mesh key={y} geometry={UNIT_BOX} material={MATERIALS.rack} scale={[w * 0.8, 0.08, 1.2]} position={[0, y, 0]} />
              ))}
              {[-1, 0, 1].map((k) => (
                <mesh key={`b-${k}`} geometry={UNIT_BOX} material={MATERIALS.pallet} scale={[w * 0.2, 0.6, 0.9]} position={[k * w * 0.26, 0.85, 0]} />
              ))}
            </group>
          ))}
        </group>
      )
    case 'staff':
      return (
        <group>
          {/* tables and lockers */}
          {[-1, 1].map((k) => (
            <group key={k} position={[k * (w / 4), 0, d * 0.1]}>
              <mesh geometry={UNIT_BOX} material={MATERIALS.steel} scale={[2.4, 0.08, 1]} position={[0, 0.76, 0]} castShadow />
              {[-0.8, 0.8].map((s) => (
                <mesh key={s} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[0.5, 0.45, 0.5]} position={[s, 0.22, 0.9]} />
              ))}
            </group>
          ))}
          {[-2, -1, 0, 1, 2].map((k) => (
            <mesh key={`lk-${k}`} geometry={UNIT_BOX} material={MATERIALS.steelDark} scale={[1.1, 2, 0.6]} position={[k * 1.2, 1, -d / 2 + 0.5]} castShadow />
          ))}
        </group>
      )
    default:
      return null
  }
}
