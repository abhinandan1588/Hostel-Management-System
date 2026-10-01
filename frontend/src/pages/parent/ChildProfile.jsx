import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CalendarCheck,
  ClipboardList,
  HeartPulse,
  Info,
  ListChecks,
  School,
  TrendingUp,
  User,
  Utensils,
} from 'lucide-react'

import {
  Avatar,
  Card,
  DataState,
  InfoList,
  Loader,
  ProgressBar,
  Section,
  StatusBadge,
  Tabs,
} from '../../components/common'
import { AttendanceSummaryGrid } from '../../components/attendance/AttendanceCalendar'
import { ActivityTimeline, StatusTimeline } from '../../components/dashboard/ActivityTimeline'
import { HealthCard } from '../../components/dashboard/HealthCard'
import { useApi } from '../../hooks'
import { parentPortalService } from '../../services'
import { formatDate, formatPercent, formatTime } from '../../utils/format'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'routine', label: 'Daily routine', icon: ListChecks },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
]

const DETAIL_LINKS = [
  { key: 'daily-activity', label: 'Daily activity', icon: ListChecks },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'meals', label: 'Meals', icon: Utensils },
  { key: 'health', label: 'Health', icon: HeartPulse },
  { key: 'school', label: 'School', icon: School },
  { key: 'progress', label: 'Progress', icon: TrendingUp },
]

/** Inline child switcher that keeps the current sub-page. */
function ChildSwitcher({ items, value, onChange, id = 'child-switcher' }) {
  if (!items?.length || items.length < 2) return null
  return (
    <Card className="card-pad mb-4">
      <label htmlFor={id} className="label">
        Viewing records for
      </label>
      <select
        id={id}
        className="input sm:hidden"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
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
          const active = String(child.id) === String(value)
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onChange(String(child.id))}
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

export default function ParentChildProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  const fetcher = useCallback(() => parentPortalService.child(id), [id])
  const { data, loading, error, reload } = useApi(fetcher)

  const siblingsFetcher = useCallback(() => parentPortalService.children(), [])
  const { data: siblings } = useApi(siblingsFetcher)

  return (
    <>
      <ChildSwitcher
        items={siblings}
        value={id}
        onChange={(nextId) => navigate(`/parent/children/${nextId}`)}
      />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<Loader label="Loading profile…" />}
      >
        {(payload) => {
          const student = payload.student
          const attendance = payload.attendance_month
          const progress = payload.progress

          return (
            <div className="space-y-4">
              {/* ------------------------------------------------- header card */}
              <Card className="card-pad">
                <div className="flex items-start gap-3">
                  <Avatar src={student.profile_photo} name={student.full_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                      {student.full_name}
                    </h1>
                    <p className="muted truncate">
                      {student.student_code}
                      {student.student_class ? ` · Class ${student.student_class}` : ''}
                      {student.section ? ` ${student.section}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge kind="studentStatus" value={student.current_status} />
                      <StatusBadge kind="health" value={payload.health?.status} />
                      <StatusBadge
                        kind="school"
                        value={payload.school_today?.status}
                        fallback="School not marked"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3 lg:grid-cols-6">
                  {DETAIL_LINKS.map((link) => (
                    <Link
                      key={link.key}
                      to={`/parent/children/${student.id}/${link.key}`}
                      className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 px-2 py-2.5 text-center text-xs font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-800"
                    >
                      <link.icon className="h-4 w-4" aria-hidden="true" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </Card>

              <Tabs tabs={TABS} active={tab} onChange={setTab} />

              {/* ---------------------------------------------------- overview */}
              {tab === 'overview' && (
                <div className="space-y-4">
                  <Section
                    title="This month's attendance"
                    subtitle={
                      attendance
                        ? `${formatPercent(attendance.attendance_percentage)} across ${attendance.recorded_days} recorded days`
                        : undefined
                    }
                    icon={CalendarCheck}
                  >
                    <AttendanceSummaryGrid summary={attendance} />
                    <Link
                      to={`/parent/children/${student.id}/attendance`}
                      className="mt-3 inline-flex min-h-9 items-center text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Open attendance calendar
                    </Link>
                  </Section>

                  <Section title="Health status" icon={HeartPulse}>
                    <HealthCard health={payload.health} />
                  </Section>

                  <Section title="School today" icon={School}>
                    {payload.school_today ? (
                      <>
                        <StatusBadge kind="school" value={payload.school_today.status} />
                        <InfoList
                          className="mt-3"
                          columns={3}
                          items={[
                            {
                              label: 'Departed',
                              value: formatTime(payload.school_today.departure_time),
                            },
                            {
                              label: 'Expected back',
                              value: formatTime(payload.school_today.expected_return_time),
                            },
                            {
                              label: 'Returned',
                              value: formatTime(payload.school_today.actual_return_time),
                            },
                          ]}
                        />
                      </>
                    ) : (
                      <p className="muted">No school movement recorded for today.</p>
                    )}
                  </Section>

                  <Section
                    title="Movement history"
                    subtitle="Recorded by hostel staff"
                    icon={ClipboardList}
                  >
                    <StatusTimeline items={payload.status_history} />
                  </Section>
                </div>
              )}

              {/* ----------------------------------------------------- profile */}
              {tab === 'profile' && (
                <div className="space-y-4">
                  <Section title="Student information" icon={User}>
                    <InfoList
                      items={[
                        { label: 'Full name', value: student.full_name },
                        { label: 'Student ID', value: student.student_code },
                        { label: 'Class', value: student.student_class },
                        { label: 'Section', value: student.section },
                        { label: 'School', value: student.school_name },
                        { label: 'Date of birth', value: formatDate(student.date_of_birth) },
                        {
                          label: 'Age',
                          value: student.age ? `${student.age} years` : null,
                        },
                        { label: 'Gender', value: student.gender },
                        { label: 'Blood group', value: student.blood_group },
                        { label: 'Admitted on', value: formatDate(student.admission_date) },
                        { label: 'Phone', value: student.phone },
                        { label: 'Email', value: student.email },
                      ]}
                    />
                  </Section>

                  <Section title="Hostel details" icon={ClipboardList}>
                    <InfoList
                      items={[
                        { label: 'Room', value: student.hostel?.room_number },
                        { label: 'Bed', value: student.hostel?.bed_number },
                        { label: 'Floor', value: student.hostel?.floor },
                        { label: 'Building', value: student.hostel?.building },
                      ]}
                    />
                  </Section>

                  <Section title="Emergency contact" icon={HeartPulse}>
                    <InfoList
                      items={[
                        { label: 'Name', value: student.emergency_contact?.name },
                        { label: 'Phone', value: student.emergency_contact?.phone },
                        { label: 'Relation', value: student.emergency_contact?.relation },
                      ]}
                    />
                  </Section>

                  <Section title="Guardians on record" icon={User}>
                    {student.parents?.length ? (
                      <ul className="divide-y divide-slate-100">
                        {student.parents.map((parent) => (
                          <li
                            key={parent.student_parent_id}
                            className="flex flex-wrap items-center gap-2 py-2.5"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">
                                {parent.full_name}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {parent.relationship_type || 'Guardian'}
                                {parent.phone ? ` · ${parent.phone}` : ''}
                              </span>
                            </span>
                            {parent.is_primary && (
                              <span className="badge-info text-[10px]">Primary</span>
                            )}
                            <StatusBadge kind="verification" value={parent.verification_status} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No guardians linked to this record yet.</p>
                    )}
                  </Section>

                  <p className="muted">
                    These details are official hostel records. Contact the hostel office if anything
                    needs correcting.
                  </p>
                </div>
              )}

              {/* ----------------------------------------------------- routine */}
              {tab === 'routine' && (
                <Section
                  title="Today's routine"
                  subtitle={
                    payload.timeline
                      ? `${payload.timeline.completed} of ${payload.timeline.total} completed · ${formatDate(payload.timeline.date)}`
                      : undefined
                  }
                  icon={ListChecks}
                  action={
                    <Link
                      to={`/parent/children/${student.id}/daily-activity`}
                      className="btn-secondary btn-sm"
                    >
                      Any date
                    </Link>
                  }
                >
                  <ActivityTimeline items={payload.timeline?.items} />
                </Section>
              )}

              {/* ---------------------------------------------------- progress */}
              {tab === 'progress' && (
                <Section
                  title="Progress by category"
                  subtitle={
                    progress?.overall === null || progress?.overall === undefined
                      ? 'Latest assessment'
                      : `Overall ${formatPercent(progress.overall)}`
                  }
                  icon={TrendingUp}
                  action={
                    <Link
                      to={`/parent/children/${student.id}/progress`}
                      className="btn-secondary btn-sm"
                    >
                      Full report
                    </Link>
                  }
                >
                  {progress?.items?.length ? (
                    <div className="space-y-4">
                      {progress.items.map((item) => (
                        <div key={item.category_id}>
                          <ProgressBar
                            label={item.category}
                            value={item.score ?? 0}
                            showValue={item.score !== null && item.score !== undefined}
                          />
                          {item.remarks && (
                            <p className="mt-1 text-xs text-slate-500">{item.remarks}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No progress scores have been recorded yet.</p>
                  )}
                </Section>
              )}
            </div>
          )
        }}
      </DataState>
    </>
  )
}
