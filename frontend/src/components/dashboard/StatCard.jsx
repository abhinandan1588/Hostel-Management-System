import { Link } from 'react-router-dom'

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
  neutral: 'bg-slate-100 text-slate-600',
}

/**
 * Summary card for dashboards. Renders as a link when `to` is supplied so the
 * whole card is a single keyboard-accessible target.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  hint,
  to,
  highlight = false,
  className = '',
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone]}`}>
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
        )}
        {highlight && value > 0 && (
          <span className="badge-danger text-[10px]">Needs attention</span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
        {value === null || value === undefined ? '—' : value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-slate-600 sm:text-sm">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </>
  )

  const shell = `card card-pad transition-shadow ${to ? 'hover:shadow-[var(--shadow-float)]' : ''} ${className}`

  if (to) {
    return (
      <Link to={to} className={`${shell} block`}>
        {body}
      </Link>
    )
  }
  return <div className={shell}>{body}</div>
}

/** Compact two-up metric used on the mobile parent dashboard. */
export function MiniStat({ label, value, tone = 'brand', icon: Icon }) {
  return (
    <div className="card card-pad text-center">
      {Icon && (
        <span
          className={`mx-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl ${TONES[tone]}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <p className="text-xl font-bold text-slate-900 tabular-nums">{value ?? '—'}</p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  )
}

export default StatCard
