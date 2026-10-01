import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'

import { onSessionExpired, tokenStore } from '../services/apiClient'
import { authService } from '../services/authService'
import { AuthContext, ROLES, homePathFor } from './auth'

/**
 * Holds the authenticated session.
 *
 * The server is the source of truth: on mount (and after any profile change)
 * the provider re-reads `/api/auth/me` rather than trusting what is cached in
 * localStorage.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStore.getUser())
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(Boolean(tokenStore.getAccess()))
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const applySession = useCallback((session) => {
    if (!session) return
    setUser(session.user || null)
    setProfile(session.profile || null)
    setPermissions(session.permissions || {})
    if (session.user) tokenStore.setUser(session.user)
  }, [])

  const clearSession = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setProfile(null)
    setPermissions({})
  }, [])

  /** Read the session from the API. Nothing is set before the first await. */
  const loadSession = useCallback(async () => {
    try {
      const session = await authService.me()
      if (mounted.current) applySession(session)
      return session
    } catch (error) {
      if (error.status === 401 || error.status === 403) clearSession()
      return null
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [applySession, clearSession])

  const refreshSession = useCallback(
    () => (tokenStore.getAccess() ? loadSession() : Promise.resolve(null)),
    [loadSession],
  )

  useEffect(() => {
    // Bootstrapping the session is a fetch against an external system, and
    // `loading` already starts as false when there is no token, so the
    // anonymous case needs no state update at all.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tokenStore.getAccess()) loadSession()
  }, [loadSession])

  // The axios layer tells us when a refresh token is no longer usable.
  useEffect(
    () =>
      onSessionExpired(() => {
        clearSession()
        setLoading(false)
      }),
    [clearSession],
  )

  const login = useCallback(
    async (identifier, password) => {
      const session = await authService.login(identifier, password)
      tokenStore.set({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        user: session.user,
      })
      applySession(session)
      setLoading(false)
      return session
    },
    [applySession],
  )

  const logout = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (tokenStore.getAccess()) await authService.logout()
      } catch {
        /* the token is being discarded anyway */
      }
      clearSession()
      if (!silent) toast.success('You have been signed out.')
    },
    [clearSession],
  )

  const value = useMemo(
    () => ({
      user,
      profile,
      permissions,
      loading,
      isAuthenticated: Boolean(user),
      role: user?.role || null,
      isAdmin: user?.role === ROLES.ADMIN,
      isParent: user?.role === ROLES.PARENT,
      isStudent: user?.role === ROLES.STUDENT,
      isVerifiedParent:
        user?.role === ROLES.PARENT && profile?.verification_status === 'VERIFIED',
      login,
      logout,
      refreshSession,
      applySession,
      homePath: homePathFor(user, profile),
    }),
    [user, profile, permissions, loading, login, logout, refreshSession, applySession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
