import {
  BedDouble,
  Check,
  Circle,
  Clock,
  CookingPot,
  Dumbbell,
  GraduationCap,
  Home,
  Moon,
  Sun,
  Utensils,
} from 'lucide-react'

import { formatTime } from '../../utils/format'
import { EmptyState } from '../common/States'

const ICONS = {
  WAKE_UP: Sun,
  BREAKFAST: CookingPot,
  LEFT_FOR_SCHOOL: GraduationCap,
  RETURNED_FROM_SCHOOL: Home,
  LUNCH: Utensils,
  STUDY: GraduationCap,
  OUTDOOR_ACTIVITY: Dumbbell,
  EVENING_SNACK: CookingPot,
  DINNER: Utensils,
  PRAYER: Circle,
  LIGHTS_OUT: Moon,
  OTHER: BedDouble,
}

/**
 * Vertical daily timeline.
 *
 * Completed entries show a tick and the recorded time; pending entries show the
 * scheduled time in muted styling so parents can see what is still to come.
 */
export function ActivityTimeline({
  items,
  emptyMessage = 'No activities have been recorded for this day yet.',
  onConfirm,
  showConfirm = false,
  actions,
}) {
  if (!items?.length) {
    return <EmptyState title="No timeline yet" message={emptyMessage} icon={Clock} />
  }

  return (
    <ol className="relative space-y-1">
      {items.map((item, index) => {
        const Icon = ICONS[item.activity_type] || Circle
        const done = item.is_completed
        const time = formatTime(item.activity_time || item.scheduled_time)
        const isLast = index === items.length - 1

        return (
          <li key={item.id} className="relative flex gap-3 pb-3">
            {!isLast && (
              <span
                className="absolute top-9 left-[15px] h-full w-0.5 bg-slate-200"
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                done
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {done ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p
                  className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-500'}`}
                >
                  {item.title || item.label}
                </p>
                <p
                  className={`text-xs font-medium tabular-nums ${
                    done ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {time}
                  {!done && item.scheduled_time ? ' (scheduled)' : ''}
                </p>
              </div>
              {item.remarks && <p className="mt-0.5 text-xs text-slate-500">{item.remarks}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {item.confirmed_by_student && (
                  <span className="badge-info text-[10px]">Confirmed by student</span>
                )}
                {showConfirm && done && !item.confirmed_by_student && onConfirm && (
                  <button
                    type="button"
                    onClick={() => onConfirm(item)}
                    className="rounded-lg border border-brand-300 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Confirm this
                  </button>
                )}
                {actions?.(item)}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Compact checklist used on the parent mobile dashboard. */
export function ActivityChecklist({ items, limit = 8 }) {
  if (!items?.length) {
    return <p className="muted py-2">No activities recorded yet today.</p>
  }
  return (
    <ul className="space-y-2">
      {items.slice(0, limit).map((item) => (
        <li key={item.id} className="flex items-center gap-2.5">
          <span
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              item.is_completed ? 'bg-emerald-500 text-white' : 'border border-slate-300 bg-white'
            }`}
          >
            {item.is_completed && <Check className="h-3 w-3" aria-hidden="true" />}
          </span>
          <span
            className={`flex-1 truncate text-sm ${
              item.is_completed ? 'font-medium text-slate-800' : 'text-slate-400'
            }`}
          >
            {item.title || item.label}
          </span>
          <span className="shrink-0 text-xs text-slate-400 tabular-nums">
            {formatTime(item.activity_time || item.scheduled_time)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Status-change history (consent-based activity tracking). */
export function StatusTimeline({ items }) {
  if (!items?.length) {
    return <EmptyState title="No status changes" message="No movement has been recorded yet." />
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              {(item.status || '').replace(/_/g, ' ').toLowerCase()}
            </p>
            <p className="text-xs text-slate-500">
              {formatTime(item.changed_at)} · {item.date} · by {item.updated_by}
            </p>
            {item.remarks && <p className="mt-0.5 text-xs text-slate-500">{item.remarks}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default ActivityTimeline
