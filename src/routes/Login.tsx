import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import refineryHero from '../assets/refinery-hero.webp'
import astrikosLogo from '../assets/astrikos-logo.png'

const CAPABILITIES = ['Production', 'Assets', 'Facilities', 'Intelligence']

const STATUS_LINES = [
  { label: 'Authentication Services', value: 'Operational' },
  { label: 'Digital Twin Engine', value: 'Connected' },
  { label: 'Data Synchronization', value: 'Live' },
]

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await signIn(username, password)
      navigate('/app/overview', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
      setPending(false)
    }
  }

  function fillDemo() {
    setUsername('admin')
    setPassword('Astrikos2026')
    setError(null)
    setDemoOpen(true)
  }

  return (
    <div data-theme="dark" className="grid min-h-full grid-cols-1 lg:grid-cols-[1fr_480px]" style={{ background: 'var(--app-panel)' }}>
      {/* ------------------------------------------------ context panel -- */}
      <aside className="relative hidden flex-col overflow-hidden lg:flex" style={{ background: '#0a0d11' }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${refineryHero})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
            filter: 'grayscale(0.65) contrast(1.08) brightness(0.62) saturate(0.85)',
            opacity: 0.55,
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(160deg, rgba(8,11,15,0.96) 0%, rgba(10,14,20,0.9) 38%, rgba(15,23,34,0.86) 68%, rgba(10,13,18,0.95) 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: 'inset 0 0 140px rgba(0,0,0,0.55)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-14">
          {/* brand lockup -- */}
          <div>
            <img src={astrikosLogo} alt="Astrikos" style={{ height: 46, width: 'auto', display: 'block' }} />
            <div className="mt-5 h-px w-10" style={{ background: 'var(--app-border)' }} />
            <p className="mt-5 text-[22px] font-bold tracking-[-0.01em]" style={{ color: 'var(--app-text)' }}>
              Integrated Manufacturing Facility
            </p>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--app-text-faint)' }}>
              Connected Operations &amp; Digital Twin Platform
            </p>
          </div>

          {/* headline -- */}
          <div className="max-w-[540px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--app-accent)' }}>
              Main Manufacturing Facility
            </p>
            <h1 className="mt-4 text-[34px] font-semibold leading-[1.2] tracking-[-0.015em] text-balance xl:text-[38px]" style={{ color: 'var(--app-text)' }}>
              Connected intelligence for modern industrial operations.
            </h1>
            <p className="mt-4 max-w-[46ch] text-[13.5px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Monitor production, assets, facilities, and operational performance through one unified digital twin platform.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2">
              {CAPABILITIES.map((c, i) => (
                <span key={c} className="flex items-center gap-3">
                  {i > 0 && (
                    <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--app-text-faint)' }} />
                  )}
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--app-text-faint)' }}>
                    {c}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* footer tag -- */}
          <div className="flex items-center gap-2.5 pt-6" style={{ borderTop: '1px solid var(--app-border-soft)' }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--app-success)' }} className="pulse-dot" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--app-text-faint)' }}>
              Site systems nominal
            </span>
          </div>
        </div>
      </aside>

      {/* -------------------------------------------------------- form --- */}
      <main className="flex flex-col justify-center overflow-y-auto px-6 py-10 sm:px-12" style={{ background: 'var(--app-panel)' }}>
        <div className="mx-auto w-full max-w-[360px]">
          {/* mobile-only brand lockup -- */}
          <div className="mb-8 lg:hidden">
            <img src={astrikosLogo} alt="Astrikos" style={{ height: 34, width: 'auto', display: 'block' }} />
            <p className="mt-3 text-[16px] font-bold tracking-[-0.01em]" style={{ color: 'var(--app-text)' }}>
              Integrated Manufacturing Facility
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span aria-hidden="true" style={{ width: 4, height: 4, background: 'var(--app-accent)' }} />
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--app-accent)' }}>
              Secure Access
            </p>
          </div>
          <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--app-text)' }}>
            Operations Command Center
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--app-text-faint)' }}>
            Sign in to access the Manufacturing Digital Twin platform.
          </p>

          <form className="mt-7 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                className="field"
                style={{ background: 'var(--app-surface-soft)' }}
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  className="text-[10px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--app-text-faint)' }}
                  onClick={() => setShow((s) => !s)}
                  aria-pressed={show}
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                className="field"
                style={{ background: 'var(--app-surface-soft)' }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="border-l-2 px-3 py-2 text-[12px]"
                style={{ borderColor: 'var(--app-danger)', background: 'var(--app-danger-bg)', color: 'var(--app-danger)' }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-1 h-11 w-full text-[13.5px] font-semibold uppercase tracking-[0.04em] transition-colors"
              style={{ background: 'var(--app-accent)', color: '#fff', borderRadius: 6 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--app-accent-strong)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--app-accent)')}
              disabled={pending || !username || !password}
            >
              {pending ? 'Verifying…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDemoOpen((v) => !v)}
              className="text-[11px] font-medium"
              style={{ color: 'var(--app-text-faint)' }}
            >
              {demoOpen ? 'Hide demo access ▲' : 'Need demo access? ▾'}
            </button>
            {demoOpen && (
              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-sm px-3 py-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--app-text-faint)' }}>
                    Demo Credentials
                  </p>
                  <p className="tnum mt-0.5 font-[family-name:var(--font-mono)] text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
                    admin / Astrikos2026
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="shrink-0 whitespace-nowrap px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em]"
                  style={{ background: 'var(--app-accent-bg)', color: 'var(--app-accent)', border: '1px solid var(--app-accent-border)', borderRadius: 4 }}
                >
                  Autofill
                </button>
              </div>
            )}
          </div>

          <div className="mt-9 pt-5" style={{ borderTop: '1px solid var(--app-border)' }}>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--app-success)' }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--app-text-faint)' }}>
                Platform Status
              </span>
              <span className="ml-auto text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--app-success)' }}>
                Operational
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {STATUS_LINES.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-[11px]">
                  <span style={{ color: 'var(--app-text-faint)' }}>{s.label}</span>
                  <span style={{ color: 'var(--app-text-muted)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
