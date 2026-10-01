import { Link } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'

import { useAuth } from '../context/auth'

export default function NotFound() {
  const { isAuthenticated, homePath } = useAuth()
  const target = isAuthenticated ? homePath : '/login'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="card card-pad w-full max-w-md text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="muted mt-1.5">
          The page you are looking for does not exist, or you may not have access to it.
        </p>
        <Link to={target} className="btn-primary mt-6 inline-flex">
          <Home className="h-4 w-4" aria-hidden="true" />
          {isAuthenticated ? 'Back to dashboard' : 'Go to sign in'}
        </Link>
      </div>
    </div>
  )
}
