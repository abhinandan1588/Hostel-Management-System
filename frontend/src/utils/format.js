/** Date, time and number formatting helpers. */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Parse an API date ("2026-09-18") or timestamp ("...Z") into a Date. */
export function parseApiDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const text = String(value)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toISODate(value = new Date()) {
  const date = value instanceof Date ? value : parseApiDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const todayISO = () => toISODate(new Date())

export function formatDate(value, { withYear = true } = {}) {
  const date = parseApiDate(value)
  if (!date) return '—'
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function formatLongDate(value) {
  const date = parseApiDate(value)
  if (!date) return '—'
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateTime(value) {
  const date = parseApiDate(value)
  if (!date) return '—'
  return `${formatDate(date)}, ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })}`
}

/** Format an API time string ("14:15:00") as "02:15 PM". */
export function formatTime(value) {
  if (!value) return '—'
  const text = String(value)
  const match = text.match(/^(\d{1,2}):(\d{2})/)
  if (!match) {
    const date = parseApiDate(text)
    if (!date) return '—'
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  let hours = Number(match[1])
  const minutes = match[2]
  const suffix = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${String(hours).padStart(2, '0')}:${minutes} ${suffix}`
}

/** "3 minutes ago", "Yesterday", "12 Mar 2026". */
export function timeAgo(value) {
  const date = parseApiDate(value)
  if (!date) return '—'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 0) return formatDateTime(date)
  if (seconds < 60) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(date)
}

export function monthName(month) {
  return MONTHS[Math.max(0, Math.min(11, Number(month) - 1))]
}

export function monthLabel(year, month) {
  return `${monthName(month)} ${year}`
}

export function formatPercent(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '—'
  return `${Number(value).toFixed(digits)}%`
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString('en-IN')
}

export function initials(name) {
  if (!name) return '?'
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** "WENT_TO_SCHOOL" -> "Went To School". */
export function humanize(value) {
  if (!value) return ''
  return String(value)
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`
}

/** Shift an ISO date string by a number of days. */
export function shiftDate(isoDate, days) {
  const date = parseApiDate(isoDate) || new Date()
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function startOfMonthISO(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function endOfMonthISO(year, month) {
  return toISODate(new Date(year, month, 0))
}
