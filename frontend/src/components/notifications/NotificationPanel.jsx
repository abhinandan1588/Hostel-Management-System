import {
  Bell,
  CalendarCheck,
  CheckCheck,
  HeartPulse,
  Megaphone,
  MessageSquare,
  School,
  Siren,
  Trash2,
  TrendingUp,
  Utensils,
  UserCheck,
} from 'lucide-react'

import { timeAgo } from '../../utils/format'
import { describe } from '../../utils/labels'
import { Button } from '../common/Primitives'
import { EmptyState } from '../common/States'

const TYPE_ICONS = {
  HEALTH_ALERT: HeartPulse,
  ATTENDANCE_ALERT: CalendarCheck,
  SCHOOL_STATUS: School,
  PROGRESS_UPDATE: TrendingUp,
  MEAL_UPDATE: Utensils,
  ANNOUNCEMENT: Megaphone,
  SUGGESTION_REPLY: MessageSquare,
  ACCOUNT_VERIFICATION: UserCheck,
  EMERGENCY_ALERT: Siren,
  ACTIVITY_UPDATE: CalendarCheck,
  GENERAL: Bell,
}

const PRIORITY_SHELL = {
  URGENT: 'border-red-300 bg-red-50',
  HIGH: 'border-amber-200 bg-amber-50/60',
  NORMAL: 'border-slate-200 bg-white',
  LOW: 'border-slate-200 bg-white',
}

const PRIORITY_ICON = {
  URGENT: 'bg-red-600 text-white',
  HIGH: 'bg-amber-500 text-white',
  NORMAL: 'bg-brand-100 text-brand-700',
  LOW: 'bg-slate-100 text-slate-500',
}

export function NotificationItem({ notification, onMarkRead, onDelete }) {
  const Icon = TYPE_ICONS[notification.type] || Bell
  const priority = notification.priority || 'NORMAL'
  const typeMeta = describe('priority', priority)

  return (
    <li
      className={`flex gap-3 rounded-2xl border px-4 py-3.5 ${PRIORITY_SHELL[priority]} ${
        notification.is_read ? 'opacity-75' : ''
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${PRIORITY_ICON[priority]}`}
      >
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-slate-900">
            {notification.title}
            {!notification.is_read && (
              <span
                className="ml-2 inline-block h-2 w-2 rounded-full bg-brand-600 align-middle"
                aria-label="Unread"
              />
            )}
          </p>
          <p className="text-[11px] whitespace-nowrap text-slate-400">
            {timeAgo(notification.created_at)}
          </p>
        </div>
        <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{notification.message}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {priority !== 'NORMAL' && priority !== 'LOW' && (
            <span className={`badge-${typeMeta.tone === 'danger' ? 'danger' : 'warning'} text-[10px]`}>
              {typeMeta.label} priority
            </span>
          )}
          {notification.student_name && (
            <span className="badge-neutral text-[10px]">{notification.student_name}</span>
          )}
          {!notification.is_read && onMarkRead && (
            <button
              type="button"
              onClick={() => onMarkRead(notification)}
              className="text-[11px] font-semibold text-brand-700 hover:underline"
            >
              Mark as read
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(notification)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

export function NotificationList({
  notifications,
  onMarkRead,
  onDelete,
  onMarkAllRead,
  unreadCount = 0,
}) {
  if (!notifications?.length) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications"
        message="Updates about attendance, health, meals and progress will appear here."
      />
    )
  }
  return (
    <div className="space-y-3">
      {unreadCount > 0 && onMarkAllRead && (
        <div className="flex items-center justify-between gap-3">
          <p className="muted">
            {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
          </p>
          <Button variant="secondary" size="sm" icon={CheckCheck} onClick={onMarkAllRead}>
            Mark all read
          </Button>
        </div>
      )}
      <ul className="space-y-2.5">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={onMarkRead}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  )
}

/** Condensed recent-activity feed for dashboards. */
export function NotificationFeed({ notifications, limit = 6, emptyMessage }) {
  if (!notifications?.length) {
    return <p className="muted py-3">{emptyMessage || 'No recent updates.'}</p>
  }
  return (
    <ul className="divide-y divide-slate-100">
      {notifications.slice(0, limit).map((notification) => {
        const Icon = TYPE_ICONS[notification.type] || Bell
        return (
          <li key={notification.id} className="flex gap-3 py-2.5">
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                PRIORITY_ICON[notification.priority] || PRIORITY_ICON.NORMAL
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{notification.title}</p>
              <p className="line-clamp-2 text-xs text-slate-500">{notification.message}</p>
            </div>
            <span className="shrink-0 text-[11px] text-slate-400">
              {timeAgo(notification.created_at)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default NotificationList
