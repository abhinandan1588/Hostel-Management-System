import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Bell,
  CalendarCheck,
  ClipboardList,
  HeartPulse,
  ImageOff,
  Megaphone,
  Salad,
  TrendingUp,
} from 'lucide-react'

import {
  Avatar,
  Card,
  CardBody,
  CardHeader,
  DataState,
  EmptyState,
  ProgressBar,
  Section,
  SkeletonCards,
  StatusBadge,
} from '../../components/common'
import { ActivityChecklist } from '../../components/dashboard/ActivityTimeline'
import { MiniStat } from '../../components/dashboard/StatCard'
import { NotificationFeed } from '../../components/notifications/NotificationPanel'
import { useApi } from '../../hooks'
import { studentPortalService } from '../../services'
import {
  formatDate,
  formatLongDate,
  formatPercent,
  greeting,
  monthLabel,
  timeAgo,
} from '../../utils/format'
import { labelOf } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

/**
 * Student home screen.
 *
 * Everything here is read-only apart from confirming a routine entry, which
 * happens on the routine page. No control on this page edits an official
 * record - attendance, health, school and progress are maintained by staff.
 */
export default function StudentDashboard() {
  const fetcher = useCallback(() => studentPortalService.dashboard(), [])
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <DataState
      loading={loading}
      error={error}
      onRetry={reload}
      data={data}
      isEmpty={(value) => !value}
      loadingLabel="Loading your dashboard…"
      skeleton={<SkeletonCards count={4} />}
      emptyTitle="Nothing to show yet"
      emptyMessage="Your dashboard will fill up once the hostel office records your first entries."
    >
      {(dashboard) => {
        const student = dashboard.student
        const today = dashboard.today
        const month = dashboard.attendance_month
        const progress = dashboard.progress
        const timeline = today?.timeline
        const meals = today?.meals

        return (
          <div className="space-y-4 sm:space-y-5">
            {/* Greeting ------------------------------------------------- */}
            <Card className="card-pad">
              <div className="flex items-start gap-3 sm:gap-4">
                <Avatar src={student.profile_photo} name={student.full_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="muted">
                    {greeting()} · {formatLongDate(new Date())}
                  </p>
                  <h1 className="mt-0.5 truncate text-xl font-bold text-slate-900 sm:text-2xl">
                    {student.full_name}
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {student.student_class}
                    {student.section ? ` · Section ${student.section}` : ''}
                    {student.school_name ? ` · ${student.school_name}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge kind="studentStatus" value={student.current_status} />
                    <span className="badge-neutral">ID {student.student_code}</span>
                    {student.room_number && (
                      <span className="badge-neutral">
                        Room {student.room_number}
                        {student.bed_number ? ` · Bed ${student.bed_number}` : ''}
                      </span>
                    )}
                  </div>
                  {today?.status?.updated_at && (
                    <p className="mt-2 text-xs text-slate-400">
                      Status updated {timeAgo(today.status.updated_at)}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Key numbers --------------------------------------------- */}
            <section aria-label="My summary">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MiniStat
                  label="Attendance this month"
                  value={formatPercent(month?.attendance_percentage)}
                  icon={CalendarCheck}
                  tone="success"
                />
                <MiniStat
                  label="Overall progress"
                  value={formatPercent(progress?.overall)}
                  icon={TrendingUp}
                  tone="brand"
                />
                <MiniStat
                  label="Attendance today"
                  value={labelOf('attendance', today?.attendance?.status)}
                  icon={Activity}
                  tone="info"
                />
                <MiniStat
                  label="Health"
                  value={labelOf('health', today?.health?.status)}
                  icon={HeartPulse}
                  tone={today?.health?.status === 'HEALTHY' ? 'success' : 'warning'}
                />
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Today's routine ------------------------------------- */}
              <Section
                title="Today's routine"
                subtitle={
                  timeline
                    ? `${timeline.completed} of ${timeline.total} activities recorded`
                    : 'Nothing recorded yet'
                }
                icon={Activity}
                action={
                  <Link to="/student/activity" className="btn-secondary btn-sm">
                    Open routine
                  </Link>
                }
              >
                <ActivityChecklist items={timeline?.items} limit={8} />
                <p className="hint mt-3">
                  Hostel staff record these entries. You can acknowledge a completed entry on the
                  routine page.
                </p>
              </Section>

              {/* Today's meals --------------------------------------- */}
              <Section
                title="Today's meals"
                subtitle={meals?.date ? formatDate(meals.date) : 'Today'}
                icon={Salad}
                action={
                  <Link to="/student/meals" className="btn-secondary btn-sm">
                    All meals
                  </Link>
                }
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(meals?.slots || []).map((slot) => {
                    const photo = slot.meal?.photos?.[0]
                    return (
                      <Link
                        key={slot.meal_type}
                        to="/student/meals"
                        className="block overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        <span className="flex aspect-square items-center justify-center overflow-hidden bg-slate-50">
                          {photo ? (
                            <img
                              src={mediaUrl(photo.file_path)}
                              alt={photo.caption || `${slot.label} photo`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageOff className="h-5 w-5 text-slate-300" aria-hidden="true" />
                          )}
                        </span>
                        <span className="block px-2.5 py-2">
                          <span className="block truncate text-xs font-semibold text-slate-800">
                            {slot.label}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {slot.recorded
                              ? slot.meal?.food_items?.join(', ') || 'Recorded'
                              : 'Not recorded'}
                          </span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </Section>

              {/* Progress -------------------------------------------- */}
              <Section
                title="My progress"
                subtitle={
                  progress?.period
                    ? `${monthLabel(progress.period.year, progress.period.month)} scores`
                    : 'Latest scores'
                }
                icon={TrendingUp}
                action={
                  <Link to="/student/progress" className="btn-secondary btn-sm">
                    Details
                  </Link>
                }
              >
                {progress?.items?.length ? (
                  <div className="space-y-3.5">
                    {progress.items.map((item) => (
                      <ProgressBar
                        key={item.category_id ?? item.slug}
                        label={item.category}
                        value={item.score}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={TrendingUp}
                    title="No scores yet"
                    message="Your warden records progress scores each month. They will appear here."
                  />
                )}
              </Section>

              {/* Notifications --------------------------------------- */}
              <Card>
                <CardHeader
                  title="Recent notifications"
                  subtitle={
                    dashboard.unread_notifications
                      ? `${dashboard.unread_notifications} unread`
                      : 'You are up to date'
                  }
                  icon={Bell}
                  action={
                    <Link to="/student/notifications" className="btn-secondary btn-sm">
                      View all
                    </Link>
                  }
                />
                <CardBody>
                  <NotificationFeed notifications={dashboard.notifications} limit={6} />
                </CardBody>
              </Card>
            </div>

            {/* Announcements -------------------------------------------- */}
            <Card>
              <CardHeader
                title="Announcements"
                subtitle="From the hostel office"
                icon={Megaphone}
                action={
                  <Link to="/student/announcements" className="btn-secondary btn-sm">
                    View all
                  </Link>
                }
              />
              <CardBody>
                {dashboard.announcements?.length ? (
                  <ul className="divide-y divide-slate-100">
                    {dashboard.announcements.map((announcement) => (
                      <li key={announcement.id} className="py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {announcement.title}
                          </p>
                          <span className="badge-neutral text-[10px]">
                            {labelOf('audience', announcement.audience)}
                          </span>
                        </div>
                        {announcement.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                            {announcement.description}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatDate(announcement.start_date)}
                          {announcement.end_date ? ` – ${formatDate(announcement.end_date)}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={Megaphone}
                    title="No announcements"
                    message="Notices from the hostel office will show up here."
                  />
                )}
              </CardBody>
            </Card>

            {/* Something wrong? ---------------------------------------- */}
            <Card className="card-pad">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="section-title">Something not right?</h2>
                  <p className="muted mt-0.5">
                    Tell the warden about a problem with food, your room, study time or how you are
                    feeling. Your records stay unchanged - this only sends a report.
                  </p>
                </div>
                <Link to="/student/report-issue" className="btn-primary">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Report an issue
                </Link>
              </div>
            </Card>
          </div>
        )
      }}
    </DataState>
  )
}
