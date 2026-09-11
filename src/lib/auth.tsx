import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * Demo-only mock session. No real secret is at stake here — this gates a
 * client-side simulation demo, not production data — but the surface
 * mirrors what a real OIDC/SSO hook would expose (user, ready, signIn,
 * signOut) so swapping in a real identity provider later is a one-file
 * change, not a rewrite of every screen that reads `useAuth()`.
 */

export type Role = 'Administrator'

export type User = {
  username: string
  name: string
  initials: string
  role: Role
}

const DEMO_USERNAME = 'admin'
const DEMO_PASSWORD = 'Astrikos2026'

type AuthValue = {
  user: User | null
  ready: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)
const STORAGE_KEY = 'opsconsole.session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setUser(JSON.parse(raw) as User)
    } catch {
      /* private mode or cleared storage — start signed out */
    }
    setReady(true)
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    await new Promise((r) => setTimeout(r, 550)) // simulated round-trip
    const validUser = username.trim().toLowerCase() === DEMO_USERNAME
    const validPass = password.trim() === DEMO_PASSWORD
    if (!validUser || !validPass) {
      throw new Error('Those credentials were not recognised. Check the username and password and try again.')
    }
    const session: User = { username: DEMO_USERNAME, name: 'Administrator', initials: 'A', role: 'Administrator' }
    setUser(session)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      /* session stays in memory only */
    }
  }, [])

  const signOut = useCallback(() => {
    setUser(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* nothing to clear */
    }
  }, [])

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
