import { AlertTriangle, Inbox, Loader2, RefreshCw, WifiOff } from 'lucide-react'

import { Button } from './Primitives'

/** Inline spinner with a message. Never leaves a blank screen. */
export function Loader({ label = 'Loading…', className = '', compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${compact ? 'py-6' : 'py-12'} ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-hidden="true" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

/** Skeleton rows for tables and lists. */
export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 4, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card card-pad space-y-3">
          <div className="skeleton h-8 w-8 rounded-lg" />
          <div className="skeleton h-6 w-16" />
          <div className="skeleton h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  title = 'Nothing here yet',
  message,
  icon: Icon = Inbox,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {message && <p className="muted mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title, className = '' }) {
  const isNetwork = error?.isNetwork
  const Icon = isNetwork ? WifiOff : AlertTriangle
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}
      role="alert"
    >
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
        <Icon className="h-6 w-6 text-red-600" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">
        {title || (isNetwork ? 'Connection problem' : 'Could not load this data')}
      </h3>
      <p className="muted mt-1 max-w-sm">
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} className="mt-4" onClick={() => onRetry()}>
          Retry
        </Button>
      )}
    </div>
  )
}

/**
 * The single wrapper every page uses to render loading / error / empty /
 * content states consistently.
 */
export function DataState({
  loading,
  error,
  data,
  onRetry,
  loadingLabel,
  skeleton,
  emptyTitle,
  emptyMessage,
  emptyIcon,
  emptyAction,
  isEmpty,
  children,
}) {
  if (loading) return skeleton || <Loader label={loadingLabel} />
  if (error) return <ErrorState error={error} onRetry={onRetry} />

  const empty =
    typeof isEmpty === 'function'
      ? isEmpty(data)
      : isEmpty !== undefined
        ? isEmpty
        : data === null || data === undefined || (Array.isArray(data) && data.length === 0)

  if (empty) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        icon={emptyIcon}
        action={emptyAction}
      />
    )
  }
  return typeof children === 'function' ? children(data) : children
}

export default DataState
