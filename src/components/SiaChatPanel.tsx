import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COPILOT_SUGGESTIONS, answer, type CopilotAnswer } from '../lib/copilot'
import { useSimulation } from '../simulation/useSimulation'
import { twinLink } from '../twin/focusLink'

/**
 * Sia as a floating chatbot rather than a dedicated sidebar page — the
 * conversation lives here, mounted once in AppShell, so it's reachable
 * from every page (the header button toggles this panel) and the thread
 * survives navigating between pages, since AppShell itself never
 * unmounts during in-app navigation.
 *
 * Every reply is computed from the live simulation state at the moment
 * the question is asked, the same state the dashboards and Digital Twin
 * read — Sia reports on this facility, not a generic chatbot answer.
 */

type Turn = { id: number; question: string; response: CopilotAnswer; at: string }

export function SiaChatPanel({ onClose }: { onClose: () => void }) {
  const state = useSimulation()
  const navigate = useNavigate()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const nextId = useRef(1)

  function ask(question: string) {
    const q = question.trim()
    if (!q) return
    setTurns((prev) => [...prev, { id: nextId.current++, question: q, response: answer(q, state), at: state.lastUpdated }])
    setDraft('')
  }

  return (
    <div className="sia-panel flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--app-advisory-bg)', border: '1px solid var(--app-advisory-border)' }}
          >
            <svg className="h-4 w-4" fill="none" stroke="var(--app-advisory)" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--app-advisory)' }}>
              Sia
            </h3>
            <p className="text-xs" style={{ color: 'var(--app-text-faint)' }}>
              Answers computed from the live facility state
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {turns.length > 0 && (
            <button className="app-btn h-7 px-2.5 text-[11px]" onClick={() => setTurns([])}>
              Clear
            </button>
          )}
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
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
                    className="sia-chip rounded-sm px-2.5 py-1 text-[11.5px]"
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
                className="max-w-[85%] rounded-lg px-3 py-2 text-[12.5px]"
                style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-accent-border)', color: 'var(--app-text)' }}
              >
                {t.question}
              </p>
            </div>

            <div className="max-w-[95%] rounded-lg px-3.5 py-3" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', borderLeft: '2px solid var(--app-advisory)' }}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-advisory)' }}>
                  Sia
                </span>
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
                        onClick={() => {
                          onClose()
                          navigate(twinLink(a.kind, a.id))
                        }}
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

      <div className="flex items-center gap-2 border-t p-3" style={{ borderColor: 'var(--app-border)' }}>
        <input
          className="field flex-1"
          placeholder="Ask about the facility…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') ask(draft)
          }}
          autoFocus
        />
        <button
          className="h-[38px] rounded-md px-4 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--app-advisory)', color: '#fff' }}
          onClick={() => ask(draft)}
          disabled={!draft.trim()}
        >
          Ask
        </button>
      </div>
      <p className="px-3 pb-3 text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
        Responses are generated locally by a rules-based analysis of the running simulation. No external model is called and no data leaves the browser.
      </p>
    </div>
  )
}
