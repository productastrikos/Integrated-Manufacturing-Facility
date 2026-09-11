import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiveBadge } from '../components/ui'
import { COPILOT_SUGGESTIONS, answer, type CopilotAnswer } from '../lib/copilot'
import { useSimulation } from '../simulation/useSimulation'
import { twinLink } from '../twin/focusLink'

/**
 * AI Project Copilot. Every reply is computed from the live simulation
 * state at the moment the question is asked — the same state the
 * dashboards and Digital Twin are reading — so it reports on this
 * facility rather than answering generically. Assets it names link
 * straight into the twin, closing the loop from question to location.
 */

type Turn = { id: number; question: string; response: CopilotAnswer; at: string }

export default function Copilot() {
  const state = useSimulation()
  const navigate = useNavigate()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const nextId = useRef(1)

  function ask(question: string) {
    const q = question.trim()
    if (!q) return
    // Read state at ask time, so the answer is a snapshot of that instant.
    setTurns((prev) => [...prev, { id: nextId.current++, question: q, response: answer(q, state), at: state.lastUpdated }])
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header-block">
        <div>
          <h1 className="page-title">Sia</h1>
          <p className="page-subtitle">Answers computed from the live facility state — production, equipment, energy, BMS, safety, security and materials.</p>
        </div>
        <LiveBadge lastUpdated={state.lastUpdated} />
      </div>

      <div className="glass-panel flex flex-col">
        {/* conversation */}
        <div className="flex min-h-[320px] flex-col gap-4 p-4">
          {turns.length === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px]" style={{ color: 'var(--app-text-muted)' }}>
                Ask about the facility. Sia reads the same live simulation state as every other module — it is not a general-purpose chatbot and does not
                answer from outside this facility&apos;s data.
              </p>
              <div>
                <p className="label mb-2">Try asking</p>
                <div className="flex flex-wrap gap-1.5">
                  {COPILOT_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="rounded-sm px-2.5 py-1 text-[11.5px]"
                      style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {turns.map((t) => (
            <div key={t.id} className="flex flex-col gap-2">
              <div className="flex justify-end">
                <p
                  className="max-w-[80%] rounded-lg px-3 py-2 text-[12.5px]"
                  style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-accent-border)', color: 'var(--app-text)' }}
                >
                  {t.question}
                </p>
              </div>

              <div
                className="max-w-[92%] rounded-lg px-3.5 py-3"
                style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}
              >
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="label">Sia</span>
                  <span className="tnum text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                    state at {t.at}
                  </span>
                </div>

                <p className="text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>
                  {t.response.headline}
                </p>

                {t.response.findings.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {t.response.findings.map((f, i) => (
                      <li key={i} className="flex gap-2 text-[12px]" style={{ color: 'var(--app-text-muted)' }}>
                        <span style={{ color: 'var(--app-text-faint)' }}>·</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {t.response.assets.length > 0 && (
                  <div className="mt-3 border-t pt-2.5" style={{ borderColor: 'var(--app-border)' }}>
                    <p className="label mb-1.5">Open in Digital Twin</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.response.assets.map((a) => (
                        <button
                          key={`${a.kind}-${a.id}`}
                          onClick={() => navigate(twinLink(a.kind, a.id))}
                          className="rounded-sm px-2 py-1 text-[11px] font-medium"
                          style={{ background: 'var(--app-surface)', border: '1px solid var(--app-accent-border)', color: 'var(--app-accent)' }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* composer */}
        <div className="flex items-center gap-2 border-t p-3" style={{ borderColor: 'var(--app-border)' }}>
          <input
            className="field flex-1"
            placeholder="Ask about the facility…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ask(draft)
            }}
          />
          <button className="app-btn h-[38px] px-4 text-[12.5px]" onClick={() => ask(draft)} disabled={!draft.trim()}>
            Ask
          </button>
          {turns.length > 0 && (
            <button className="app-btn h-[38px] px-3 text-[12.5px]" onClick={() => setTurns([])}>
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
        Responses are generated locally by a rules-based analysis of the running simulation. No external model is called and no data leaves the browser.
      </p>
    </div>
  )
}
