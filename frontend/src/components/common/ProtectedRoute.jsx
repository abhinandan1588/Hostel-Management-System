import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/auth'
import { Loader } from './States'

/**
 * Frontend route guard.
 *
 * This is a UX convenience only - the backend independently authorises every
 * request. Never treat this as a security boundary.
 */
export function ProtectedRoute({ roles, requireVerifiedParent = false, children }) {
  const { isAuthenticated, loading, user, profile, homePath } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader label="Checking your session…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePath} replace />
  }

  if (requireVerifiedParent && profile?.verification_status !== 'VERIFIED') {
    return <Navigate to="/pending-verification" replace />
  }

  return children || <Outlet />
}

/** Bounce already-authenticated users away from login/register. */
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, homePath } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader label="Loading…" />
      </div>
    )
  }
  if (isAuthenticated) return <Navigate to={homePath} replace />
  return children || <Outlet />
}

export default ProtectedRoute
