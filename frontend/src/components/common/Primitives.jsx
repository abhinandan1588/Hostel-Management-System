import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

import { initials } from '../../utils/format'
import { describe } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

/* ------------------------------------------------------------------ Button */
const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
}

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size,
    loading = false,
    icon: Icon,
    className = '',
    type = 'button',
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${VARIANTS[variant] || VARIANTS.primary} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      )}
      {children}
    </button>
  )
})

/* ------------------------------------------------------------------- Badge */
const TONES = {
  neutral: 'badge-neutral',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
}

export function Badge({ tone = 'neutral', children, className = '', icon: Icon }) {
  return (
    <span className={`${TONES[tone] || TONES.neutral} ${className}`}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  )
}

/**
 * Enum-aware badge. Always renders the text label so meaning never depends on
 * colour alone.
 */
export function StatusBadge({ kind, value, className = '', fallback }) {
  const meta = describe(kind, value)
  return (
    <Badge tone={meta.tone} className={className}>
      {value ? meta.label : fallback || meta.label}
    </Badge>
  )
}

/* -------------------------------------------------------------------- Card */
export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, subtitle, action, icon: Icon, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="section-title flex items-center gap-2">
          {Icon && <Icon className="h-4.5 w-4.5 text-brand-700" aria-hidden="true" />}
          {title}
        </h2>
        {subtitle && <p className="muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`card-pad ${className}`}>{children}</div>
}

/* ------------------------------------------------------------------ Avatar */
export function Avatar({ src, name, size = 'md', className = '' }) {
  const sizes = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-lg',
    xl: 'h-24 w-24 text-2xl',
  }
  const url = mediaUrl(src)
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-800 ${sizes[size]} ${className}`
  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name}'s photo` : 'Profile photo'}
        className={`${base} object-cover`}
        loading="lazy"
      />
    )
  }
  return (
    <span className={base} role="img" aria-label={name ? `${name} initials` : 'No photo'}>
      {initials(name)}
    </span>
  )
}

/* ------------------------------------------------------------- ProgressBar */
export function ProgressBar({ value, label, tone, showValue = true, className = '' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const color =
    tone ||
    (pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-brand-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500')
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
          {label && <span className="font-medium text-slate-700">{label}</span>}
          {showValue && <span className="font-semibold text-slate-900">{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- PageHeader */
export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/* ----------------------------------------------------------------- Section */
export function Section({ title, subtitle, action, icon, children, className = '', bodyClassName = '' }) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} action={action} icon={icon} />
      <CardBody className={bodyClassName}>{children}</CardBody>
    </Card>
  )
}

/* --------------------------------------------------------------- InfoList */
export function InfoList({ items, columns = 2, className = '' }) {
  const grid = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${grid} ${className}`}>
      {items
        .filter((item) => item)
        .map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm break-words text-slate-800">
              {item.value === null || item.value === undefined || item.value === '' ? (
                <span className="text-slate-400">Not recorded</span>
              ) : (
                item.value
              )}
            </dd>
          </div>
        ))}
    </dl>
  )
}
