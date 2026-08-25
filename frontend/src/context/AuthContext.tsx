import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout } from '../api/auth'
import { getProfile } from '../api/profile'
import { ApiError, clearToken, hasToken, setToken, setUnauthorizedHandler } from '../api/client'
import type { UserProfile } from '../types/user'

interface AuthContextValue {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: UserProfile) => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const handleUnauthorized = useCallback(() => {
    clearToken()
    setUserState(null)
  }, [])

  // Register a global 401 handler so any expired/invalid token clears local
  // auth state immediately, not just the boot-time profile fetch below.
  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized)
    return () => setUnauthorizedHandler(null)
  }, [handleUnauthorized])

  // Hydrate the current user from a stored token on boot.
  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      try {
        const profile = await getProfile()
        if (!cancelled) setUserState(profile)
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.statusCode === 401) {
          clearToken()
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (hasToken()) {
      hydrate()
    } else {
      setIsLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password)
    setToken(result.token)
    setUserState(result.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // Best-effort - clear local state regardless of the network outcome.
    } finally {
      clearToken()
      setUserState(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const profile = await getProfile()
    setUserState(profile)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
      setUser: setUserState,
      refreshProfile,
    }),
    [user, isLoading, login, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return ctx
}
