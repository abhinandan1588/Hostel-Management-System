import { useCallback, useState } from 'react'
import { Activity, Info, Salad, School } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Card,
  CardBody,
  CardHeader,
  DataState,
  DateStepper,
  InfoList,
  PageHeader,
  Section,
  SkeletonRows,
  StatusBadge,
} from '../../components/common'
import { ActivityTimeline } from '../../components/dashboard/ActivityTimeline'
import { useApi } from '../../hooks'
import { activityService, studentPortalService } from '../../services'
import { formatLongDate, formatTime, todayISO } from '../../utils/format'
import { mediaUrl } from '../../utils/media'

/**
 * The student's daily routine.
 *
 * Staff record and complete each entry. A student may only *acknowledge* a
 * completed entry - the record itself, its time and its remarks never change.
 */
export default function StudentActivity() {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [confirmingId, setConfirmingId] = useState(null)

  const fetcher = useCallback(() => studentPortalService.routine({ date }), [date])
  const { data, loading, error, reload, refresh } = useApi(fetcher)

  const confirmActivity = async (activity) => {
    if (confirmingId) return
    setConfirmingId(activity.id)
    try {
      await activityService.confirm(activity.id)
      toast.success('Thanks - your acknowledgement has been saved.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Today's routine"
        subtitle={formatLongDate(date)}
        actions={<DateStepper value={date} onChange={setDate} max={today} />}
      />

      <div
        className="mb-4 flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3"
        role="note"
      >
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-700" aria-hidden="true" />
        <p className="text-sm text-brand-900">
          Hostel staff record this routine. Choosing <strong>Confirm this</strong> only tells them
          you have seen a completed entry - it does not change the record, its time or its remarks.
        </p>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        data={data}
        isEmpty={(value) => !value}
        emptyTitle="Nothing recorded"
        emptyMessage="No routine has been recorded for this day."
        loadingLabel="Loading your routine…"
        skeleton={
          <Card className="card-pad">
            <SkeletonRows rows={6} />
          </Card>
        }
      >
        {(routine) => {
          const timeline = routine.timeline
          const school = routine.school
          const meals = routine.meals

          return (
            <div className="space-y-4">
              <Card>
                <CardHeader
                  title="My day"
                  subtitle={
                    timeline
                      ? `${timeline.completed} of ${timeline.total} activities recorded`
                      : 'Nothing recorded yet'
                  }
                  icon={Activity}
                />
                <CardBody>
                  <ActivityTimeline
                    items={timeline?.items}
                    showConfirm
                    onConfirm={confirmActivity}
                    emptyMessage="No activities have been recorded for this day yet."
                  />
                </CardBody>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="School status" subtitle="Recorded by hostel staff" icon={School}>
                  {school ? (
                    <div className="space-y-3">
                      <StatusBadge kind="school" value={school.status} />
                      <InfoList
                        columns={2}
                        items={[
                          { label: 'Left hostel', value: formatTime(school.departure_time) },
                          {
                            label: 'Expected back',
                            value: formatTime(school.expected_return_time),
                          },
                          {
                            label: 'Returned at',
                            value: school.actual_return_time
                              ? formatTime(school.actual_return_time)
                              : null,
                          },
                          { label: 'Recorded by', value: school.recorded_by },
                          school.remarks ? { label: 'Remarks', value: school.remarks } : null,
                        ]}
                      />
                    </div>
                  ) : (
                    <p className="muted">No school status recorded for this day.</p>
                  )}
                </Section>

                <Section
                  title="Meals on this day"
                  subtitle={meals?.date ? `Menu for ${meals.date}` : 'Menu'}
                  icon={Salad}
                >
                  <ul className="space-y-2.5">
                    {(meals?.slots || []).map((slot) => (
                      <li
                        key={slot.meal_type}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5"
                      >
                        <span className="min-w-24 text-sm font-semibold text-slate-800">
                          {slot.label}
                        </span>
                        {slot.recorded ? (
                          <>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                              {slot.meal?.food_items?.join(', ') || 'No items listed'}
                            </span>
                            {slot.meal?.photos?.[0] && (
                              <img
                                src={mediaUrl(slot.meal.photos[0].file_path)}
                                alt={`${slot.label} photo`}
                                loading="lazy"
                                className="h-9 w-9 shrink-0 rounded-lg object-cover"
                              />
                            )}
                          </>
                        ) : (
                          <span className="badge-neutral">Not recorded</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
            </div>
          )
        }}
      </DataState>
    </>
  )
}
