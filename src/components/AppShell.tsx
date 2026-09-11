import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AlertsPanel } from './AlertsPanel'
import { ToastStack } from './ToastStack'
import { ScenarioAlertBanner } from './ScenarioAlertBanner'
import { SiaChatPanel } from './SiaChatPanel'
import { Mark, Wordmark } from './ui'
import { NAV_ITEMS, NAV_SECTIONS } from '../data/navigation'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { simulationEngine } from '../simulation/simulationEngine'
import { useSimulation } from '../simulation/useSimulation'

function SvgIcon({ d, size = 'h-4 w-4', strokeWidth = 1.7 }: { d: string; size?: string; strokeWidth?: number }) {
  return (
    <svg className={`${size} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={d} />
    </svg>
  )
}

export default function AppShell() {
  useEffect(() => {
    simulationEngine.start()
    return () => simulationEngine.stop()
  }, [])

  const state = useSimulation()
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showSia, setShowSia] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [clock, setClock] = useState(new Date())

  const profileRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setShowSearch(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!showSearch) return
    const onDocClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showSearch])

  useEffect(() => {
    if (!showProfile) return
    const onDocClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false)
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setShowProfile(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [showProfile])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 8)
  }, [searchQuery])

  const notifications = state.attention.length + (state.safetySecurity.criticalAlerts > 0 ? 1 : 0)
  const criticalCount = state.safetySecurity.criticalAlerts
  const health = state.kpis.systemHealthPct
  const currentItem = NAV_ITEMS.find((n) => location.pathname.endsWith(n.path))

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      {/* ---------------------------------------------------------- sidebar -- */}
      <aside
        className="flex flex-shrink-0 flex-col overflow-hidden transition-all duration-200"
        style={{ width: sidebarOpen ? 'var(--app-sidebar-w)' : '60px', background: 'var(--app-panel)', borderRight: '1px solid var(--app-border)' }}
      >
        <div
          className="flex flex-shrink-0 cursor-pointer items-center gap-3 px-4"
          style={{ height: 'var(--app-header-h)', borderBottom: '1px solid var(--app-border)' }}
          onClick={() => navigate('/app/overview')}
        >
          {sidebarOpen ? <Wordmark size={46} /> : <Mark size={28} />}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              {sidebarOpen ? <p className="nav-section-label">{section.label}</p> : <div className="h-3" />}
              {section.items.map((item) => (
                <div key={item.id} className="px-2">
                  <NavLink
                    to={`/app/${item.path}`}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <SvgIcon d={item.icon} />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--app-border)' }}>
          {sidebarOpen && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ background: 'var(--app-accent)' }}
              >
                {user?.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold" style={{ color: 'var(--app-text)' }}>
                  {user?.name}
                </div>
                <div className="truncate text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                  {user?.role}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* -------------------------------------------------------- main area -- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ------------------------------------------------------- topbar --- */}
        <header
          className="flex flex-shrink-0 items-center gap-3 px-4"
          style={{ height: 'var(--app-header-h)', background: 'var(--app-chrome-bg)', borderBottom: '1px solid var(--app-border)' }}
        >
          <button onClick={() => setSidebarOpen((o) => !o)} className="icon-btn" title="Toggle sidebar">
            <SvgIcon d="M4 6h16M4 12h16M4 18h16" strokeWidth={2} />
          </button>

          <div className="ml-1 hidden flex-col sm:flex">
            <span className="text-[11px] font-bold" style={{ color: 'var(--app-text)', letterSpacing: '0.1em' }}>
              {state.site.name.toUpperCase()}
            </span>
            <span className="text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
              {currentItem?.label ?? 'Executive Overview'} · Live simulation
            </span>
          </div>

          <div className="header-search relative ml-3 max-w-xs flex-1" ref={searchRef}>
            <svg className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search modules… (Ctrl+K)"
              aria-label="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSearch(true)
              }}
              onFocus={() => setShowSearch(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSearch(false)
                  setSearchQuery('')
                  ;(e.target as HTMLInputElement).blur()
                }
                if (e.key === 'Enter' && searchResults.length > 0) {
                  navigate(`/app/${searchResults[0].path}`)
                  setShowSearch(false)
                  setSearchQuery('')
                }
              }}
            />
            {showSearch && searchQuery.trim() && (
              <div className="search-dropdown">
                {searchResults.length === 0 ? (
                  <div className="search-dropdown-empty">No results for &ldquo;{searchQuery}&rdquo;</div>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      className="search-dropdown-item"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        navigate(`/app/${item.path}`)
                        setShowSearch(false)
                        setSearchQuery('')
                      }}
                    >
                      <div className="sdi-icon">
                        <SvgIcon d={item.icon} size="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="sdi-label">{item.label}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div
            className="tnum hidden rounded-md px-2 py-1 text-xs md:block"
            style={{ background: 'var(--app-surface-soft)', color: 'var(--app-text-muted)', border: '1px solid var(--app-border)', letterSpacing: '0.04em' }}
          >
            {clock.toLocaleTimeString('en-GB', { hour12: false })}
          </div>

          <div className="hidden items-baseline gap-1.5 lg:flex">
            <span className="label">health</span>
            <span
              className="tnum text-[13px] font-semibold"
              style={{ color: health >= 90 ? 'var(--app-success)' : health >= 75 ? 'var(--app-warning)' : 'var(--app-danger)' }}
            >
              {health.toFixed(0)}%
            </span>
          </div>

          <button onClick={toggle} className="icon-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? (
              <SvgIcon d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" strokeWidth={2} />
            ) : (
              <SvgIcon d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1012 21a8.962 8.962 0 008.354-5.646z" strokeWidth={2} />
            )}
          </button>

          <button onClick={() => setShowSia((s) => !s)} className={`app-advisory-btn ${showSia ? 'active' : ''}`} title="Sia">
            <SvgIcon
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              strokeWidth={2}
            />
            <span>Sia</span>
          </button>

          <button onClick={() => setShowAlerts((s) => !s)} className={`icon-btn relative ${showAlerts ? 'active' : ''}`} title="Alerts">
            <SvgIcon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeWidth={2} />
            {notifications > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold ${criticalCount > 0 ? 'animate-pulse' : ''}`}
                style={{ background: criticalCount > 0 ? 'var(--app-danger)' : 'var(--app-warning)', color: 'var(--app-on-color)' }}
              >
                {notifications}
              </span>
            )}
          </button>

          <div className="relative" ref={profileRef}>
            <button type="button" className="profile-trigger" onClick={() => setShowProfile((s) => !s)} title={user?.name}>
              {user?.initials}
            </button>
            {showProfile && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-header">
                  <div className="avatar">{user?.initials}</div>
                  <div className="min-w-0">
                    <div className="name truncate">{user?.name}</div>
                    <div className="status">Online</div>
                  </div>
                </div>
                <div className="profile-menu-section">
                  <button className="profile-menu-item" onClick={() => setShowProfile(false)}>
                    <SvgIcon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth={1.7} />
                    Profile
                  </button>
                </div>
                <div className="profile-menu-section">
                  <button
                    className="profile-menu-item danger"
                    onClick={() => {
                      signOut()
                      navigate('/login', { replace: true })
                    }}
                  >
                    <SvgIcon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={1.7} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <ScenarioAlertBanner />

        {/* -------------------------------------------------------- content -- */}
        <div className="flex-1 overflow-hidden">
          <main className="h-full overflow-auto p-4">
            <Outlet />
          </main>
        </div>
      </div>

      <ToastStack />

      {showAlerts && (
        <div
          className="animate-slide-up w-80 overflow-hidden"
          style={{
            position: 'fixed',
            top: 'var(--app-header-h)',
            right: 0,
            bottom: 0,
            zIndex: 200,
            background: 'var(--app-panel)',
            borderLeft: '1px solid var(--app-border)',
          }}
        >
          <AlertsPanel onClose={() => setShowAlerts(false)} />
        </div>
      )}

      {showSia && (
        <div
          className="animate-slide-up w-[400px] overflow-hidden"
          style={{
            position: 'fixed',
            top: 'var(--app-header-h)',
            right: 0,
            bottom: 0,
            zIndex: 200,
            background: 'var(--app-panel)',
            borderLeft: '1px solid var(--app-border)',
          }}
        >
          <SiaChatPanel onClose={() => setShowSia(false)} />
        </div>
      )}
    </div>
  )
}
