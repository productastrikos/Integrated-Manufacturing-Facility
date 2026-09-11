import { Html } from '@react-three/drei'
import { BUILDING_LAYOUTS, LINE_LAYOUTS, EQUIPMENT_LAYOUTS } from './layout'
import { STAGE_ZONE_LAYOUTS } from './facilityLayout'
import { useSelection } from './selection'

/**
 * In-scene name labels, tied to the current selection depth rather than
 * camera distance — cheap (no per-frame distance checks) and predictable:
 * building names are always up, line names appear once you're inside a
 * building/area, equipment IDs appear once you're on a line. Rendered
 * with drei's <Html> (real DOM, the app's own fonts) — never drei's
 * <Text>, which pulls a remote font and would break offline use.
 */
export function Labels() {
  const { selection } = useSelection()

  // All production lines live inside the single Production Building, so
  // selecting it (or any area/line within it) is enough to reveal them.
  const showLines = selection?.kind === 'building' || selection?.kind === 'area' || selection?.kind === 'line' || selection?.kind === 'equipment'
  const showEquipment = selection?.kind === 'line' || selection?.kind === 'equipment'
  const focusedLineId = selection?.kind === 'line' ? selection.id : selection?.kind === 'equipment' ? EQUIPMENT_LAYOUTS.find((e) => e.equipment.id === selection.id)?.equipment.lineId : null

  return (
    <group>
      {STAGE_ZONE_LAYOUTS.map((z) => (
        <Html key={z.stageId} position={[z.center[0], 4.2, z.center[1]]} center distanceFactor={38} occlude={false}>
          <div className="twin-label twin-label-building">{z.name}</div>
        </Html>
      ))}

      {BUILDING_LAYOUTS.map((b) => (
        <Html key={b.building.id} position={[b.center[0], b.height + 3.2, b.center[1]]} center distanceFactor={38} occlude={false}>
          <div className="twin-label twin-label-building">{b.building.name}</div>
        </Html>
      ))}

      {showLines &&
        LINE_LAYOUTS.map((l) => (
          <Html key={l.line.id} position={[l.center[0], 2.6, l.center[1]]} center distanceFactor={20} occlude={false}>
            <div className="twin-label twin-label-line">{l.line.name}</div>
          </Html>
        ))}

      {showEquipment &&
        EQUIPMENT_LAYOUTS.filter((e) => !focusedLineId || e.equipment.lineId === focusedLineId).map((e) => (
          <Html key={e.equipment.id} position={[e.position[0], e.footprint[1] + 0.6, e.position[2]]} center distanceFactor={10} occlude={false}>
            <div className="twin-label twin-label-equipment">{e.equipment.id}</div>
          </Html>
        ))}
    </group>
  )
}
