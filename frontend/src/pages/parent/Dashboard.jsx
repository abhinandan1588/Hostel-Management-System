import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BedDouble,
  Bell,
  CalendarCheck,
  ChevronRight,
  HeartPulse,
  ImageOff,
  ListChecks,
  Megaphone,
  School,
  TrendingUp,
  UserRoundX,
  Utensils,
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
import { MonthlyAttendanceChart } from '../../components/dashboard/Charts'
import { HealthCard } from '../../components/dashboard/HealthCard'
import { MiniStat } from '../../components/dashboard/StatCard'
import { PhotoLightbox } from '../../components/meals/MealCard'
import { NotificationFeed } from '../../components/notifications/NotificationPanel'
import { useAuth } from '../../context/auth'
import { useApi } from '../../hooks'
import { parentPortalService } from '../../services'
import {
  formatDate,
  formatLongDate,
  formatPercent,
  formatTime,
  greeting,
} from '../../utils/format'
import { labelOf } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

/** Inline child selector: a native select on phones, segmented buttons above sm. */
function ChildSelector({ items, value, onChange }) {
  if (!items?.length || items.length < 2) return null
  return (
    <Card className="card-pad mb-4">
      <label htmlFor="dashboard-child" className="label">
        Viewing records for
      </label>
      <select
        id="dashboard-child"
        className="input sm:hidden"
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {items.map((child) => (
          <option key={child.id} value={child.id}>
            {child.full_name}
            {child.student_class ? ` · Class ${child.student_class}` : ''}
          </option>
        ))}
      </select>
      <div className="hidden flex-wrap gap-2 sm:flex" role="group" aria-label="Choose a child">
        {items.map((child) => {
          const active = child.id === value
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onChange(child.id)}
              aria-pressed={active}
              className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Avatar src={child.profile_photo} name={child.full_name} size="xs" />
              {child.full_name}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/** Section footer link to the matching detail page. */
function MoreLink({ to, children }) {
  return (
    <Link
      to={to}
      className="mt-3 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  )
}

export default function ParentDashboard() {
  const { user, profile } = useAuth()
  const [selectedId, setSelectedId] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  const fetcher = useCallback(() => parentPortalService.dashboard(selectedId), [selectedId])
  const { data, loading, error, reload } = useApi(fetcher)

  const fullName = user?.full_name || profile?.full_name || ''
  const firstName = fullName.trim().split(/\s+/)[0] || 'there'

  return (
    <>
      <header className="mb-4">
        <p className="text-sm font-medium text-slate-500">{formatLongDate(new Date())}</p>
        <h1 className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl">
          {greeting()}, {firstName}
        </h1>
      </header>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<SkeletonCards count={4} />}
        loadingLabel="Loading your dashboard…"
      >
        {(dashboard) => {
          if (!dashboard.children?.length) {
            return (
              <Card>
                <EmptyState
                  icon={UserRoundX}
                  title="No child linked to your account yet"
                  message="Your account is verified, but the hostel office has not linked a child to it yet. Once a warden links your child's record, their daily activity, attendance, meals, health and progress will appear here."
                />
              </Card>
            )
          }

          const activeId = selectedId ?? dashboard.selected_child_id
          const snapshot = dashboard.selected_child
          const student = snapshot?.student
          const timeline = snapshot?.timeline
          const mealSlots = snapshot?.meals?.slots || []
          const progress = dashboard.progress
          const month = dashboard.attendance_month
          const photoStrip = mealSlots.flatMap((slot) =>
            (slot.meal?.photos || []).map((photo) => ({ photo, meal: slot.meal, label: slot.label })),
          )

          return (
            <div className="space-y-4">
              <ChildSelector
                items={dashboard.children}
                value={activeId}
                onChange={(id) => setSelectedId(id)}
              />

              {/* ---------------------------------------------- child status */}
              <Card className="card-pad">
                <div className="flex items-start gap-3">
                  <Avatar src={student?.profile_photo} name={student?.full_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold text-slate-900">
                      {student?.full_name}
                    </h2>
                    <p className="muted truncate">
                      {student?.student_code}
                      {student?.student_class ? ` · Class ${student.student_class}` : ''}
                      {student?.section ? ` ${student.section}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge kind="studentStatus" value={snapshot?.status?.current} />
                      {student?.room_number && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                          <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
                          Room {student.room_number}
                          {student.bed_number ? ` · Bed ${student.bed_number}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  to={`/parent/children/${activeId}`}
                  className="btn-secondary mt-4 w-full"
                >
                  Open full profile
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Card>

              {/* ------------------------------------------------ mini stats */}
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Overall progress"
                  value={
                    progress?.overall === null || progress?.overall === undefined
                      ? '—'
                      : formatPercent(progress.overall)
                  }
                  icon={TrendingUp}
                  tone="brand"
                />
                <MiniStat
                  label="Attendance today"
                  value={labelOf('attendance', snapshot?.attendance?.status)}
                  icon={CalendarCheck}
                  tone={snapshot?.attendance?.status === 'PRESENT' ? 'success' : 'warning'}
                />
              </div>

              {/* -------------------------------------------- today's activity */}
              <Section
                title="Today's activity"
                subtitle={
                  timeline
                    ? `${timeline.completed} of ${timeline.total} activities completed`
                    : 'Daily routine'
                }
                icon={ListChecks}
              >
                <ActivityChecklist items={timeline?.items} limit={6} />
                <MoreLink to={`/parent/children/${activeId}/daily-activity`}>
                  See the full day
                </MoreLink>
              </Section>

              {/* --------------------------------------------- today's meals */}
              <Section
                title="Today's meals"
                subtitle={formatDate(snapshot?.meals?.date)}
                icon={Utensils}
              >
                <ul className="space-y-2">
                  {mealSlots.map((slot) => (
                    <li
                      key={slot.meal_type}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <span className="min-w-24 text-sm font-semibold text-slate-800">
                        {slot.label}
                      </span>
                      {slot.recorded && slot.meal ? (
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                          {slot.meal.food_items?.join(', ') || 'No items listed'}
                        </span>
                      ) : (
                        <span className="badge-neutral">Not recorded</span>
                      )}
                    </li>
                  ))}
                </ul>

                {photoStrip.length > 0 ? (
                  <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-1">
                    {photoStrip.map(({ photo, meal, label }) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightbox({ photo, meal })}
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200"
                        aria-label={`View ${label} photo`}
                      >
                        <img
                          src={mediaUrl(photo.file_path)}
                          alt={photo.caption || `${label} photo`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                    <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
                    No meal photos uploaded yet today
                  </p>
                )}

                <MoreLink to={`/parent/children/${activeId}/meals`}>All meals and photos</MoreLink>
              </Section>

              {/* -------------------------------------------------- progress */}
              <Section
                title="Progress"
                subtitle={
                  progress?.period
                    ? `${progress.period.year}-${String(progress.period.month).padStart(2, '0')} assessment`
                    : 'Latest assessment'
                }
                icon={TrendingUp}
              >
                {progress?.items?.length ? (
                  <div className="space-y-3.5">
                    {progress.items.map((item) => (
                      <ProgressBar
                        key={item.category_id}
                        label={item.category}
                        value={item.score ?? 0}
                        showValue={item.score !== null && item.score !== undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="muted">No progress scores have been recorded yet.</p>
                )}
                <MoreLink to={`/parent/children/${activeId}/progress`}>
                  Progress and exam results
                </MoreLink>
              </Section>

              {/* ---------------------------------------- monthly attendance */}
              <Section
                title="Monthly attendance"
                subtitle={
                  month
                    ? `${formatPercent(month.attendance_percentage)} across ${month.recorded_days} recorded days`
                    : 'Last six months'
                }
                icon={CalendarCheck}
              >
                <MonthlyAttendanceChart data={dashboard.attendance_trend} />
                <MoreLink to={`/parent/children/${activeId}/attendance`}>
                  Attendance calendar
                </MoreLink>
              </Section>

              {/* ---------------------------------------------------- health */}
              <Section title="Health status" icon={HeartPulse}>
                <HealthCard health={snapshot?.health} />
                <MoreLink to={`/parent/children/${activeId}/health`}>Health history</MoreLink>
              </Section>

              {/* ---------------------------------------------------- school */}
              <Section title="School status" subtitle="Today" icon={School}>
                {snapshot?.school ? (
                  <>
                    <StatusBadge kind="school" value={snapshot.school.status} />
                    <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs font-semibold text-slate-500 uppercase">Departed</dt>
                        <dd className="text-sm font-medium text-slate-800">
                          {formatTime(snapshot.school.departure_time)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500 uppercase">
                          Expected back
                        </dt>
                        <dd className="text-sm font-medium text-slate-800">
                          {formatTime(snapshot.school.expected_return_time)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500 uppercase">
                          Returned
                        </dt>
                        <dd className="text-sm font-medium text-slate-800">
                          {formatTime(snapshot.school.actual_return_time)}
                        </dd>
                      </div>
                    </dl>
                    {snapshot.school.remarks && (
                      <p className="mt-2 text-xs text-slate-500">{snapshot.school.remarks}</p>
                    )}
                  </>
                ) : (
                  <p className="muted">School movement has not been recorded for today yet.</p>
                )}
                <MoreLink to={`/parent/children/${activeId}/school`}>School history</MoreLink>
              </Section>

              {/* --------------------------------------------- notifications */}
              <Card>
                <CardHeader
                  title="Recent notifications"
                  subtitle={
                    dashboard.unread_notifications
                      ? `${dashboard.unread_notifications} unread`
                      : 'All caught up'
                  }
                  icon={Bell}
                  action={
                    <Link to="/parent/notifications" className="btn-secondary btn-sm">
                      View all
                    </Link>
                  }
                />
                <CardBody>
                  <NotificationFeed notifications={dashboard.notifications} limit={5} />
                </CardBody>
              </Card>

              {/* -------------------------------------------- announcements */}
              <Card>
                <CardHeader
                  title="Announcements"
                  subtitle="From the hostel office"
                  icon={Megaphone}
                  action={
                    <Link to="/parent/announcements" className="btn-secondary btn-sm">
                      View all
                    </Link>
                  }
                />
                <CardBody>
                  {dashboard.announcements?.length ? (
                    <ul className="divide-y divide-slate-100">
                      {dashboard.announcements.slice(0, 4).map((announcement) => (
                        <li key={announcement.id} className="py-2.5">
                          <p className="text-sm font-semibold text-slate-900">
                            {announcement.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                            {announcement.description}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {labelOf('audience', announcement.audience)} ·{' '}
                            {formatDate(announcement.start_date || announcement.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No announcements at the moment.</p>
                  )}
                </CardBody>
              </Card>
            </div>
          )
        }}
      </DataState>

      <PhotoLightbox
        photo={lightbox?.photo}
        meal={lightbox?.meal}
        onClose={() => setLightbox(null)}
      />
    </>
  )
}
