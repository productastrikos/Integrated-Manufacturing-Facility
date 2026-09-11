import { AREA_LAYOUTS, BUILDING_LAYOUTS, EQUIPMENT_LAYOUTS, LINE_LAYOUTS, SITE_GROUND } from './layout'
import { STAGE_ZONE_LAYOUTS } from './facilityLayout'
import { useSelection } from './selection'

/**
 * A small orthographic floor plan of the campus, drawn as plain SVG from
 * the same static layout the 3D scene uses. It marks every building, the
 * production lines, and whatever is currently selected — so the user always
 * knows where in the site they are looking, even zoomed into one machine.
 */

const [SITE_W, SITE_D] = SITE_GROUND
const PAD = 4

export function Minimap() {
  const { selection, select } = useSelection()

  // Scene x/z maps directly to SVG x/y; the site is centred on the origin.
  const toX = (x: number) => x + SITE_W / 2
  const toY = (z: number) => z + SITE_D / 2

  const selectedBuildingId = selection?.kind === 'building' ? selection.id : null
  const selectedAreaId = selection?.kind === 'area' ? selection.id : null
  const selectedLineId = selection?.kind === 'line' ? selection.id : null
  const selectedEquipment = selection?.kind === 'equipment' ? EQUIPMENT_LAYOUTS.find((e) => e.equipment.id === selection.id) : null

  return (
    <div
      className="absolute bottom-3 left-3 rounded-lg p-2 backdrop-blur-sm"
      style={{ border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-panel) 90%, transparent)' }}
    >
      <div className="label mb-1.5 px-0.5">Site Plan</div>
      <svg
        viewBox={`${-PAD} ${-PAD} ${SITE_W + PAD * 2} ${SITE_D + PAD * 2}`}
        className="block"
        style={{ width: 168, height: Math.round((168 * (SITE_D + PAD * 2)) / (SITE_W + PAD * 2)) }}
        role="img"
        aria-label="Facility site plan"
      >
        {/* site boundary */}
        <rect x={0} y={0} width={SITE_W} height={SITE_D} fill="var(--app-bg)" stroke="var(--app-border)" strokeWidth={1.5} rx={2} />

        {BUILDING_LAYOUTS.map((b) => {
          const isSel = selectedBuildingId === b.building.id
          return (
            <rect
              key={b.building.id}
              x={toX(b.center[0]) - b.size[0] / 2}
              y={toY(b.center[1]) - b.size[1] / 2}
              width={b.size[0]}
              height={b.size[1]}
              fill={isSel ? 'var(--twin-amber)' : 'var(--app-border)'}
              fillOpacity={isSel ? 0.5 : 0.55}
              stroke={isSel ? 'var(--twin-amber)' : 'var(--app-text-faint)'}
              strokeWidth={isSel ? 2 : 0.8}
              style={{ cursor: 'pointer' }}
              onClick={() => select('building', b.building.id)}
            />
          )
        })}

        {/* value-chain plots — dashed, to read as yards rather than buildings */}
        {STAGE_ZONE_LAYOUTS.map((z) => {
          const isSel = selection?.kind === "stage" && selection.id === z.stageId
          return (
            <rect
              key={z.stageId}
              x={toX(z.center[0]) - z.size[0] / 2}
              y={toY(z.center[1]) - z.size[1] / 2}
              width={z.size[0]}
              height={z.size[1]}
              fill={isSel ? "var(--twin-amber)" : "none"}
              fillOpacity={isSel ? 0.35 : 0}
              stroke={isSel ? "var(--twin-amber)" : "var(--app-text-faint)"}
              strokeWidth={isSel ? 2 : 0.9}
              strokeDasharray="3 2"
              style={{ cursor: "pointer" }}
              onClick={() => select("stage", z.stageId)}
            />
          )
        })}

        {/* production areas inside the main building */}
        {AREA_LAYOUTS.map((a) => (
          <rect
            key={a.area.id}
            x={toX(a.center[0]) - a.size[0] / 2}
            y={toY(a.center[1]) - a.size[1] / 2}
            width={a.size[0]}
            height={a.size[1]}
            fill="none"
            stroke={selectedAreaId === a.area.id ? 'var(--twin-amber)' : 'var(--app-text-faint)'}
            strokeWidth={selectedAreaId === a.area.id ? 2 : 0.6}
            strokeOpacity={selectedAreaId === a.area.id ? 1 : 0.5}
            style={{ cursor: 'pointer' }}
            onClick={() => select('area', a.area.id)}
          />
        ))}

        {/* production lines */}
        {LINE_LAYOUTS.map((l) => (
          <line
            key={l.line.id}
            x1={toX(l.center[0] - l.length / 2)}
            y1={toY(l.center[1])}
            x2={toX(l.center[0] + l.length / 2)}
            y2={toY(l.center[1])}
            stroke={selectedLineId === l.line.id ? 'var(--twin-amber)' : 'var(--app-accent)'}
            strokeWidth={selectedLineId === l.line.id ? 2.6 : 1.2}
            strokeOpacity={selectedLineId === l.line.id ? 1 : 0.55}
            strokeLinecap="round"
          />
        ))}

        {/* selected equipment marker */}
        {selectedEquipment && (
          <circle cx={toX(selectedEquipment.position[0])} cy={toY(selectedEquipment.position[2])} r={3.4} fill="var(--twin-amber)" stroke="var(--app-panel)" strokeWidth={1} />
        )}
      </svg>
    </div>
  )
}
