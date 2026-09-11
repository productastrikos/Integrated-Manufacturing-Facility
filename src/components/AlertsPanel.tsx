import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { twinLink } from '../twin/focusLink'
import { useSimulation } from '../simulation/useSimulation'
import type { AttentionItem } from '../simulation/types'
import { materialStatus, stockCoverDays } from '../lib/materialsIntelligence'
import { dismissNotification, useNotifications } from '../lib/notifications'

type PanelAlert = {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  zone: string
  /** Equipment this alert came from, when it maps to a physical asset. */
  equipmentId?: string
  /** Materials & Logistics deep-link, when this alert came from inventory. */
  materialId?: string
}

function toPanelAlert(a: AttentionItem): PanelAlert {
  return {
    id: a.equipmentId,
    type: a.status === 'critical' ? 'critical' : 'warning',
    title: `${a.equipmentId} — ${a.reason}`,
    message: `${a.equipmentName} on ${a.lineId} is reading ${a.metric}.`,
    zone: a.lineId,
    equipmentId: a.equipmentId,
  }
}

const TYPE_STYLE = {
  critical: { chip: 'status-chip-danger', dot: 'var(--app-danger)' },
  warning: { chip: 'status-chip-warning', dot: 'var(--app-warning)' },
  info: { chip: 'status-chip-info', dot: 'var(--app-info)' },
} as const

export function AlertsPanel({ onClose }: { onClose: () => void }) {
  const state = useSimulation()
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const navigate = useNavigate()
  const activity = useNotifications()

  const equipmentAlerts = state.attention.map(toPanelAlert)
  const infoAlerts: PanelAlert[] =
    state.safetySecurity.nearMisses > 0
      ? [
          {
            id: 'safety-near-miss',
            type: 'info',
            title: `${state.safetySecurity.nearMisses} near miss on record`,
            message: 'Logged this session — no immediate action required.',
            zone: 'Safety',
          },
        ]
      : []

  // Inventory intelligence feeds the same alert stream — a material's
  // status here is computed the identical way Materials & Logistics does,
  // so a critical/out-of-stock reading never disagrees between the two.
  const materialAlerts: PanelAlert[] = []
  for (const m of state.materials.materials) {
    const status = materialStatus(m)
    if (status === 'out_of_stock' || status === 'critical') {
      const cover = stockCoverDays(m)
      materialAlerts.push({
        id: `mat-stock-${m.id}`,
        type: 'critical',
        title: status === 'out_of_stock' ? `${m.name} is out of stock` : `${m.name} projected to run out in ${cover.toFixed(1)} days`,
        message: m.productionLines.length ? `May affect ${m.productionLines.join(', ')}. In ${m.warehouseZone}.` : `In ${m.warehouseZone}.`,
        zone: 'Materials',
        materialId: m.id,
      })
    } else if (status === 'low') {
      materialAlerts.push({
        id: `mat-low-${m.id}`,
        type: 'warning',
        title: `${m.name} below reorder point`,
        message: `${m.stockLevel.toFixed(0)} ${m.unit} on hand in ${m.warehouseZone}.`,
        zone: 'Materials',
        materialId: m.id,
      })
    }
  }
  for (const s of state.materials.suppliers) {
    if (s.delayedOrders > 0) {
      materialAlerts.push({
        id: `sup-delay-${s.id}`,
        type: 'warning',
        title: `${s.name} has ${s.delayedOrders} delayed order${s.delayedOrders > 1 ? 's' : ''}`,
        message: `On-time rate ${s.onTimePct.toFixed(1)}% · avg lead time ${s.avgLeadTimeDays.toFixed(1)} days.`,
        zone: 'Materials',
      })
    }
  }

  const active = [...equipmentAlerts, ...materialAlerts, ...infoAlerts].filter((a) => !acknowledged.has(a.id))
  const grouped = {
    critical: active.filter((a) => a.type === 'critical'),
    warning: active.filter((a) => a.type === 'warning'),
    info: active.filter((a) => a.type === 'info'),
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>
            Real-Time Alerts
          </h3>
          <p className="text-xs" style={{ color: 'var(--app-text-faint)' }}>
            {active.length} active
          </p>
        </div>
        <button onClick={onClose} className="icon-btn" aria-label="Close">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {(['critical', 'warning', 'info'] as const).map(
          (type) =>
            grouped[type].length > 0 && (
              <div key={type}>
                <div className={`status-chip ${TYPE_STYLE[type].chip} mb-1.5`}>
                  {type} ({grouped[type].length})
                </div>
                {grouped[type].map((alert) => (
                  <div
                    key={alert.id}
                    className="mb-1.5 rounded-lg p-2.5"
                    style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={type === 'critical' ? 'pulse-dot' : ''}
                        style={{ width: 8, height: 8, borderRadius: 999, marginTop: 4, flexShrink: 0, background: TYPE_STYLE[type].dot }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium" style={{ color: 'var(--app-text)' }}>
                          {alert.title}
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                          {alert.message}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                            {alert.zone}
                          </span>
                          <span className="flex items-center gap-3">
                            {alert.equipmentId && (
                              <button
                                onClick={() => {
                                  onClose()
                                  navigate(twinLink("equipment", alert.equipmentId!))
                                }}
                                className="text-[10px] font-medium"
                                style={{ color: "var(--app-accent)" }}
                              >
                                View in Twin
                              </button>
                            )}
                            {alert.materialId && (
                              <button
                                onClick={() => {
                                  onClose()
                                  navigate(`/app/materials?attn=${encodeURIComponent(alert.materialId!)}`)
                                }}
                                className="text-[10px] font-medium"
                                style={{ color: "var(--app-accent)" }}
                              >
                                View Material
                              </button>
                            )}
                            <button
                              onClick={() => setAcknowledged((s) => new Set(s).add(alert.id))}
                              className="text-[10px] font-medium"
                              style={{ color: "var(--app-text-faint)" }}
                            >
                              Acknowledge
                            </button>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ),
        )}

        {active.length === 0 && activity.length === 0 && (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--app-text-faint)' }}>
            No active alerts
          </div>
        )}

        {activity.length > 0 && (
          <div>
            <div className="status-chip status-chip-success mb-1.5">activity ({activity.length})</div>
            {activity.map((n) => (
              <div key={n.id} className="mb-1.5 rounded-lg p-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-start gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: 999, marginTop: 4, flexShrink: 0, background: 'var(--app-success)' }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium" style={{ color: 'var(--app-text)' }}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      {n.message}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                        {n.at}
                      </span>
                      <span className="flex items-center gap-3">
                        {n.href && (
                          <button
                            onClick={() => {
                              onClose()
                              navigate(n.href!)
                            }}
                            className="text-[10px] font-medium"
                            style={{ color: 'var(--app-accent)' }}
                          >
                            {n.hrefLabel ?? 'View →'}
                          </button>
                        )}
                        <button onClick={() => dismissNotification(n.id)} className="text-[10px] font-medium" style={{ color: 'var(--app-text-faint)' }}>
                          Dismiss
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
