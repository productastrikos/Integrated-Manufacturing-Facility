import type { Equipment, SimulationState } from '../simulation/types'

export type WorkOrderStatus = 'scheduled' | 'in-progress' | 'completed' | 'overdue' | 'critical'
export type WorkOrderType = 'preventive' | 'corrective'

export type WorkOrder = {
  id: string
  equipmentId: string
  equipmentName: string
  lineId: string
  type: WorkOrderType
  status: WorkOrderStatus
  description: string
}

/**
 * Work orders are derived live from equipment state every render — not
 * stored separately — so "Equipment-014: Health 87, Maintenance: Inspection
 * Required" can never drift out of sync with what the twin and Operations
 * are showing for that same asset.
 */
export function deriveWorkOrders(state: SimulationState): WorkOrder[] {
  const orders: WorkOrder[] = []
  for (const eq of Object.values(state.equipment)) {
    const base = { equipmentId: eq.id, equipmentName: eq.name, lineId: eq.lineId }

    if (eq.status === 'maintenance') {
      orders.push({ id: `WO-${eq.id}-M`, ...base, type: 'preventive', status: 'in-progress', description: 'Scheduled preventive maintenance in progress.' })
      continue
    }
    if (eq.status === 'critical') {
      orders.push({ id: `WO-${eq.id}-C`, ...base, type: 'corrective', status: 'critical', description: 'Critical fault — corrective action required immediately.' })
      continue
    }
    if (eq.maintenanceDueInDays <= 0) {
      orders.push({ id: `WO-${eq.id}-O`, ...base, type: 'preventive', status: 'overdue', description: 'Preventive maintenance window has passed.' })
      continue
    }
    if (eq.status === 'warning') {
      orders.push({ id: `WO-${eq.id}-W`, ...base, type: 'corrective', status: 'in-progress', description: 'Elevated sensor reading — inspection required.' })
      continue
    }
    if (eq.maintenanceDueInDays <= 10) {
      orders.push({ id: `WO-${eq.id}-S`, ...base, type: 'preventive', status: 'scheduled', description: `Preventive maintenance due in ${Math.round(eq.maintenanceDueInDays)} day(s).` })
    }
  }
  return orders.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
}

const STATUS_RANK: Record<WorkOrderStatus, number> = { critical: 0, overdue: 1, 'in-progress': 2, scheduled: 3, completed: 4 }

export function maintenanceLabel(eq: Equipment): string {
  if (eq.status === 'maintenance') return 'In progress'
  if (eq.status === 'critical') return 'Critical — action required'
  if (eq.maintenanceDueInDays <= 0) return 'Overdue'
  if (eq.status === 'warning') return 'Inspection required'
  if (eq.maintenanceDueInDays <= 10) return `Due in ${Math.round(eq.maintenanceDueInDays)}d`
  return 'On schedule'
}
