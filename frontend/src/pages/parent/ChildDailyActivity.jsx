import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarCheck,
  HeartPulse,
  ListChecks,
  School,
  Utensils,
} from 'lucide-react'

import {
  Avatar,
  Card,
  DataState,
  DateStepper,
  InfoList,
  Loader,
  PageHeader,
  Section,
  StatusBadge,
} from '../../components/common'
import { ActivityTimeline } from '../../components/dashboard/ActivityTimeline'
import { HealthHistoryItem } from '../../components/dashboard/HealthCard'
import { MealCard, PhotoLightbox } from '../../components/meals/MealCard'
import { useApi } from '../../hooks'
import { parentPortalService } from '../../services'
import { formatLongDate, formatTime, todayISO } from '../../utils/format'

function ChildSwitcher({ items, value, onChange, id = 'daily-child' }) {
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

export default function ParentChildDailyActivity() {
  const { id } = useParams()
  const navigate = useNavigate()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [lightbox, setLightbox] = useState(null)

  const fetcher = useCallback(
    () => parentPortalService.dailyActivity(id, { date }),
    [id, date],
  )
  const { data, loading, error, reload } = useApi(fetcher)

  const siblingsFetcher = useCallback(() => parentPortalService.children(), [])
  const { data: siblings } = useApi(siblingsFetcher)
  const child = siblings?.find((item) => String(item.id) === String(id))

  return (
    <>
      <PageHeader
        title="Today's activity"
        subtitle={`${child?.full_name ? `${child.full_name} · ` : ''}${formatLongDate(date)}`}
        actions={
          <Link to={`/parent/children/${id}`} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Profile
          </Link>
        }
      />

      <ChildSwitcher
        items={siblings}
        value={id}
        onChange={(nextId) => navigate(`/parent/children/${nextId}/daily-activity`)}
      />

      <Card className="card-pad mb-4">
        <p className="label">Choose a day</p>
        <DateStepper value={date} onChange={setDate} max={today} />
      </Card>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<Loader label="Loading the day…" />}
      >
        {(day) => {
          const attendance = day.attendance || []
          const mealSlots = day.meals?.slots || []
          const health = day.health || []

          return (
            <div className="space-y-4">
              {/* ------------------------------------------------- attendance */}
              <Section title="Hostel attendance" subtitle="Marked by hostel staff" icon={CalendarCheck}>
                {attendance.length ? (
                  <ul className="space-y-2">
                    {attendance.map((record) => (
                      <li
                        key={record.id}
                        className="rounded-xl border border-slate-200 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge kind="attendance" value={record.status} />
                          <span className="text-xs font-medium text-slate-600">
                            {record.session ? record.session.replace(/_/g, ' ') : 'Full day'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatTime(record.marked_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Marked by {record.marked_by || 'hostel staff'}
                          {record.remarks ? ` · ${record.remarks}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Attendance has not been marked for this day.</p>
                )}
              </Section>

              {/* ----------------------------------------------- the timeline */}
              <Section
                title="Daily timeline"
                subtitle={
                  day.timeline
                    ? `${day.timeline.completed} of ${day.timeline.total} activities completed`
                    : 'Routine recorded by hostel staff'
                }
                icon={ListChecks}
              >
                {day.timeline?.total ? (
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Completed</span>
                      <span className="font-semibold text-slate-900">
                        {Math.round((day.timeline.completed / day.timeline.total) * 100)}%
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                      aria-label="Routine completion"
                      aria-valuenow={Math.round(
                        (day.timeline.completed / day.timeline.total) * 100,
                      )}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{
                          width: `${(day.timeline.completed / day.timeline.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
                <ActivityTimeline
                  items={day.timeline?.items}
                  emptyMessage="No activities were recorded for this day."
                />
              </Section>

              {/* --------------------------------------------------- school */}
              <Section title="School" subtitle="Departure and return" icon={School}>
                {day.school ? (
                  <>
                    <StatusBadge kind="school" value={day.school.status} />
                    <InfoList
                      className="mt-3"
                      columns={3}
                      items={[
                        { label: 'Departed', value: formatTime(day.school.departure_time) },
                        {
                          label: 'Expected back',
                          value: formatTime(day.school.expected_return_time),
                        },
                        {
                          label: 'Actually returned',
                          value: formatTime(day.school.actual_return_time),
                        },
                      ]}
                    />
                    {day.school.remarks && (
                      <p className="mt-2 text-xs text-slate-500">{day.school.remarks}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                      Recorded by {day.school.recorded_by || 'hostel staff'}
                    </p>
                  </>
                ) : (
                  <p className="muted">No school movement was recorded for this day.</p>
                )}
              </Section>

              {/* ---------------------------------------------------- meals */}
              <Section title="Meals" subtitle="What was served" icon={Utensils}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {mealSlots.map((slot) => (
                    <MealCard
                      key={slot.meal_type}
                      slot={slot}
                      onPhotoClick={(photo, meal) => setLightbox({ photo, meal })}
                    />
                  ))}
                </div>
              </Section>

              {/* --------------------------------------------------- health */}
              <Section
                title="Health records for this day"
                subtitle="Maintained by hostel staff"
                icon={HeartPulse}
              >
                {health.length ? (
                  <ul>
                    {health.map((record) => (
                      <HealthHistoryItem key={record.id} record={record} />
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No health records were logged on this day.</p>
                )}
              </Section>
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
