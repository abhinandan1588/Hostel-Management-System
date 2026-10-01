import { createContext, useContext } from 'react'

/**
 * Auth context object, role constants and the `useAuth` hook.
 *
 * Kept separate from AuthProvider.jsx so that file only exports a component
 * (a React Fast Refresh requirement).
 */

export const AuthContext = createContext(null)

export const ROLES = {
  ADMIN: 'ADMIN',
  PARENT: 'PARENT',
  STUDENT: 'STUDENT',
}

/** Where each role lands after signing in. */
export function homePathFor(user, profile) {
  if (!user) return '/login'
  if (user.role === ROLES.ADMIN) return '/admin/dashboard'
  if (user.role === ROLES.PARENT) {
    const verified = profile?.verification_status === 'VERIFIED'
    return verified ? '/parent/dashboard' : '/pending-verification'
  }
  if (user.role === ROLES.STUDENT) return '/student/dashboard'
  return '/login'
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
