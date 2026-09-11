import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { useAuth } from './lib/auth'
import { useTheme } from './lib/theme'
import { LEGACY_REDIRECTS, NAV_ITEMS } from './data/navigation'
import AppShell from './components/AppShell'
import Login from './routes/Login'
import ExecutiveOverview from './routes/ExecutiveOverview'
import Operations from './routes/Operations'
import BMS from './routes/BMS'
import SafetySecurity from './routes/SafetySecurity'
import Simulation from './routes/Simulation'
import Maintenance from './routes/Maintenance'
import Quality from './routes/Quality'
import Materials from './routes/Materials'
import WorkAllocation from './routes/WorkAllocation'
import Copilot from './routes/Copilot'
import PlaceholderModule from './routes/PlaceholderModule'

// Three.js/R3F/drei are a heavy dependency graph — code-split so every
// other route's initial load stays light and only pays for the twin when
// the twin is actually visited.
const DigitalTwin = lazy(() => import('./routes/DigitalTwin'))

const PHASE3_ROUTES: Record<string, React.ComponentType> = {
  operations: Operations,
  bms: BMS,
  'safety-security': SafetySecurity,
  simulation: Simulation,
  maintenance: Maintenance,
  quality: Quality,
  materials: Materials,
  'work-allocation': WorkAllocation,
  copilot: Copilot,
}

/**
 * Sends an old module path to its replacement, carrying any query the
 * original link had — a Digital Twin deep link like
 * `/app/security?attn=CAM-01` has to keep its `attn` when it lands on the
 * merged module, or the redirect silently drops what the user clicked.
 */
function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation()
  const [path, redirectQuery] = to.split('?')
  const params = new URLSearchParams(location.search)
  for (const [k, v] of new URLSearchParams(redirectQuery ?? '')) params.set(k, v)
  return <Navigate to={`/app/${path}?${params.toString()}`} replace />
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <div className="grid h-full place-items-center label">restoring session…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export default function App() {
  useTheme() // applies data-theme to <html> on first paint

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<ExecutiveOverview />} />
        <Route
          path="digital-twin"
          element={
            <Suspense fallback={<div className="grid h-full place-items-center label">loading digital twin…</div>}>
              <DigitalTwin />
            </Suspense>
          }
        />
        {NAV_ITEMS.filter((n) => n.id !== 'overview' && n.id !== 'digital-twin').map((n) => {
          const Real = PHASE3_ROUTES[n.id]
          return <Route key={n.id} path={n.path} element={Real ? <Real /> : <PlaceholderModule />} />
        })}
        {/* Paths that predate the Safety+Security merge. Deep links from the
            twin, the attention feed and Sia still use them, so they resolve
            into the merged module on the matching tab rather than 404ing. */}
        {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
          <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
        ))}
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
