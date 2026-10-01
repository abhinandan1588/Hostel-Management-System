import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BedDouble,
  CalendarCheck,
  CalendarX,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  Lightbulb,
  School,
  ShieldQuestion,
  Siren,
  UserCheck,
  Users,
} from 'lucide-react'

import {
  Card,
  CardBody,
  CardHeader,
  DataState,
  EmptyState,
  PageHeader,
  Section,
  SkeletonCards,
  StatusBadge,
} from '../../components/common'
import {
  AttendanceTrendChart,
  HealthDonutChart,
  OccupancyChart,
  SchoolAttendanceChart,
} from '../../components/dashboard/Charts'
import { StatCard } from '../../components/dashboard/StatCard'
import { useApi } from '../../hooks'
import { adminService } from '../../services'
import { formatLongDate, formatTime, timeAgo } from '../../utils/format'

export default function AdminDashboard() {
  const fetcher = useCallback(() => adminService.dashboard(), [])
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={formatLongDate(new Date())}
        actions={
          <>
            <Link to="/admin/attendance" className="btn-primary">
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              Mark attendance
            </Link>
            <Link to="/admin/meals" className="btn-secondary">
              Upload meals
            </Link>
          </>
        }
      />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={(value) => !value?.summary}
        skeleton={<SkeletonCards count={8} />}
        loadingLabel="Loading the dashboard…"
      >
        {(dashboard) => {
          const s = dashboard.summary
          return (
            <div className="space-y-5">
              {/* Summary cards */}
              <section aria-label="Summary">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  <StatCard
                    label="Total students"
                    value={s.total_students}
                    icon={GraduationCap}
                    tone="brand"
                    to="/admin/students"
                  />
                  <StatCard
                    label="Total parents"
                    value={s.total_parents}
                    icon={Users}
                    tone="info"
                    to="/admin/parents"
                  />
                  <StatCard
                    label="Pending parent verification"
                    value={s.pending_parent_verification}
                    icon={UserCheck}
                    tone="warning"
                    to="/admin/parents?verification_status=PENDING"
                    highlight
                  />
                  <StatCard
                    label="Pending student verification"
                    value={s.pending_student_verification}
                    icon={ShieldQuestion}
                    tone="warning"
                    to="/admin/students?verification_status=PENDING"
                  />
                  <StatCard
                    label="Students present"
                    value={s.students_present}
                    icon={CalendarCheck}
                    tone="success"
                    hint={`${s.attendance_not_marked} not marked yet`}
                    to="/admin/attendance"
                  />
                  <StatCard
                    label="Students absent"
                    value={s.students_absent}
                    icon={CalendarX}
                    tone="danger"
                    to="/admin/attendance"
                    highlight
                  />
                  <StatCard
                    label="Students sick"
                    value={s.students_sick}
                    icon={HeartPulse}
                    tone="danger"
                    to="/admin/health"
                    highlight
                  />
                  <StatCard
                    label="Students at school"
                    value={s.students_at_school}
                    icon={School}
                    tone="info"
                    to="/admin/school-attendance"
                  />
                  <StatCard
                    label="Inside hostel"
                    value={s.students_inside_hostel}
                    icon={Home}
                    tone="success"
                  />
                  <StatCard
                    label="Active alerts"
                    value={s.active_alerts}
                    icon={Siren}
                    tone="danger"
                    to="/admin/emergency"
                    highlight
                  />
                  <StatCard
                    label="Pending suggestions"
                    value={s.pending_suggestions}
                    icon={Lightbulb}
                    tone="warning"
                    to="/admin/suggestions"
                  />
                  <StatCard
                    label="Beds occupied"
                    value={`${dashboard.occupancy.occupied_beds}/${dashboard.occupancy.total_beds}`}
                    icon={BedDouble}
                    tone="neutral"
                    hint={`${dashboard.occupancy.occupancy_rate}% occupancy`}
                    to="/admin/rooms"
                  />
                </div>
              </section>

              {/* Charts */}
              <div className="grid gap-4 xl:grid-cols-3">
                <Section
                  title="Student attendance"
                  subtitle="Last 14 days"
                  className="xl:col-span-2"
                >
                  <AttendanceTrendChart data={dashboard.charts.attendance_trend} />
                </Section>

                <Section title="Health status" subtitle="Current distribution">
                  <HealthDonutChart data={dashboard.charts.health_distribution} />
                </Section>

                <Section title="School attendance" subtitle="This week">
                  <SchoolAttendanceChart data={dashboard.charts.school_attendance_weekly} />
                </Section>

                <Section title="Hostel occupancy" subtitle="Beds per building">
                  <OccupancyChart data={dashboard.charts.occupancy_by_building} />
                </Section>

                <Section
                  title="Today's routine"
                  subtitle={`${dashboard.activity_stats.completed} of ${dashboard.activity_stats.total} activities completed`}
                  icon={Activity}
                  action={
                    <Link to="/admin/activities" className="btn-secondary btn-sm">
                      Manage
                    </Link>
                  }
                >
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Completion</span>
                      <span className="font-semibold text-slate-900">
                        {dashboard.activity_stats.completion_rate}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${dashboard.activity_stats.completion_rate}%` }}
                      />
                    </div>
                  </div>
                  {dashboard.recent_activity?.length ? (
                    <ul className="divide-y divide-slate-100">
                      {dashboard.recent_activity.slice(0, 6).map((row) => (
                        <li key={row.id} className="flex items-center gap-2 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-slate-700">
                            <span className="font-medium">{row.student?.full_name}</span> ·{' '}
                            {row.title}
                          </span>
                          <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                            {formatTime(row.activity_time || row.scheduled_time)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No activities completed yet today.</p>
                  )}
                </Section>
              </div>

              {/* Health cases + meals */}
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader
                    title="Students needing attention"
                    subtitle="Latest non-healthy records"
                    icon={Heart}
                    action={
                      <Link to="/admin/health" className="btn-secondary btn-sm">
                        Health board
                      </Link>
                    }
                  />
                  <CardBody>
                    {dashboard.health_cases?.length ? (
                      <ul className="divide-y divide-slate-100">
                        {dashboard.health_cases.map((record) => (
                          <li key={record.id} className="flex flex-wrap items-center gap-2 py-2.5">
                            <Link
                              to={`/admin/students/${record.student_id}`}
                              className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-700"
                            >
                              {record.student?.full_name}
                              <span className="ml-1.5 text-xs text-slate-400">
                                {record.student?.student_code}
                              </span>
                            </Link>
                            <StatusBadge kind="health" value={record.status} />
                            <StatusBadge kind="severity" value={record.severity} />
                            <span className="w-full text-xs text-slate-500 sm:w-auto">
                              {timeAgo(record.recorded_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState
                        icon={HeartPulse}
                        title="Everyone is healthy"
                        message="No students currently need medical attention."
                      />
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Today's meals"
                    subtitle="What has been recorded so far"
                    action={
                      <Link to="/admin/meals" className="btn-secondary btn-sm">
                        Manage meals
                      </Link>
                    }
                  />
                  <CardBody className="space-y-3">
                    {dashboard.today_meals.slots.map((slot) => (
                      <div
                        key={slot.meal_type}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5"
                      >
                        <span className="min-w-24 text-sm font-semibold text-slate-800">
                          {slot.label}
                        </span>
                        {slot.recorded ? (
                          <>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                              {slot.meal.food_items.join(', ') || 'No items listed'}
                            </span>
                            <span className="badge-success">
                              {slot.meal.photos.length} photo
                              {slot.meal.photos.length === 1 ? '' : 's'}
                            </span>
                          </>
                        ) : (
                          <span className="badge-neutral">Not recorded</span>
                        )}
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>

              {/* Suggestions + audit */}
              <div className="grid gap-4 xl:grid-cols-2">
                <Section
                  title="Parent suggestions"
                  subtitle={`${dashboard.suggestion_stats.OPEN} open · ${dashboard.suggestion_stats.TOTAL} total`}
                  icon={Lightbulb}
                  action={
                    <Link to="/admin/suggestions" className="btn-secondary btn-sm">
                      Review
                    </Link>
                  }
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { key: 'NEW', label: 'New', tone: 'bg-sky-50 text-sky-700' },
                      { key: 'UNDER_REVIEW', label: 'Under review', tone: 'bg-amber-50 text-amber-700' },
                      { key: 'IN_PROGRESS', label: 'In progress', tone: 'bg-amber-50 text-amber-700' },
                      { key: 'RESOLVED', label: 'Resolved', tone: 'bg-emerald-50 text-emerald-700' },
                    ].map((cell) => (
                      <div key={cell.key} className={`rounded-xl px-3 py-2.5 text-center ${cell.tone}`}>
                        <p className="text-lg font-bold tabular-nums">
                          {dashboard.suggestion_stats[cell.key] ?? 0}
                        </p>
                        <p className="text-[11px] font-semibold">{cell.label}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="Recent admin activity" subtitle="Audit trail">
                  {dashboard.recent_audit?.length ? (
                    <ul className="divide-y divide-slate-100">
                      {dashboard.recent_audit.map((entry) => (
                        <li key={entry.id} className="py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-800">
                              {entry.action.replace(/_/g, ' ').toLowerCase()}
                            </p>
                            <p className="text-[11px] text-slate-400">{timeAgo(entry.created_at)}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {entry.description || '—'} · by {entry.admin_name || 'System'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No administrative actions recorded yet.</p>
                  )}
                </Section>
              </div>
            </div>
          )
        }}
      </DataState>
    </>
  )
}
