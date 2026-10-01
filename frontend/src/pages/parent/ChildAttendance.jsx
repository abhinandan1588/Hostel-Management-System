import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarCheck, CalendarDays, TrendingUp } from 'lucide-react'

import {
  Avatar,
  Card,
  DataState,
  Loader,
  MonthPicker,
  PageHeader,
  Pagination,
  Section,
  StatusBadge,
} from '../../components/common'
import {
  AttendanceCalendar,
  AttendanceSummaryGrid,
} from '../../components/attendance/AttendanceCalendar'
import { MonthlyAttendanceChart } from '../../components/dashboard/Charts'
import { useApi, useMonthSelection, usePagination } from '../../hooks'
import { parentPortalService } from '../../services'
import {
  endOfMonthISO,
  formatDate,
  formatPercent,
  formatTime,
  monthLabel,
  startOfMonthISO,
} from '../../utils/format'

function ChildSwitcher({ items, value, onChange, id = 'attendance-child' }) {
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

export default function ParentChildAttendance() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { year, month, goPrevious, goNext } = useMonthSelection()
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)

  // A new month always starts on page one.
  useEffect(() => {
    reset()
  }, [year, month, reset])

  const query = useMemo(
    () => ({
      year,
      month,
      start_date: startOfMonthISO(year, month),
      end_date: endOfMonthISO(year, month),
      page,
      per_page: perPage,
    }),
    [year, month, page, perPage],
  )

  const fetcher = useCallback(() => parentPortalService.attendance(id, query), [id, query])
  const { data, meta, loading, error, reload } = useApi(fetcher)

  const siblingsFetcher = useCallback(() => parentPortalService.children(), [])
  const { data: siblings } = useApi(siblingsFetcher)
  const child = siblings?.find((item) => String(item.id) === String(id))

  const calendar = meta?.calendar
  const summary = calendar?.summary
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${child?.full_name ? `${child.full_name} · ` : ''}${monthLabel(year, month)}`}
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
        onChange={(nextId) => navigate(`/parent/children/${nextId}/attendance`)}
      />

      <Card className="card-pad mb-4">
        <p className="label">Choose a month</p>
        <MonthPicker year={year} month={month} onPrevious={goPrevious} onNext={goNext} />
      </Card>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<Loader label="Loading attendance…" />}
      >
        {(records) => (
          <div className="space-y-4">
            <Section
              title="Month summary"
              subtitle={
                summary
                  ? `${formatPercent(summary.attendance_percentage)} present across ${summary.recorded_days} recorded days`
                  : 'No attendance recorded for this month yet'
              }
              icon={CalendarCheck}
            >
              <AttendanceSummaryGrid summary={summary} />
            </Section>

            <Section title="Calendar" subtitle={monthLabel(year, month)} icon={CalendarDays}>
              {calendar?.days?.length ? (
                <AttendanceCalendar calendar={calendar} />
              ) : (
                <p className="muted">No attendance has been marked for this month.</p>
              )}
            </Section>

            <Section title="Six-month trend" subtitle="Attendance percentage" icon={TrendingUp}>
              <MonthlyAttendanceChart data={meta?.monthly_trend} />
            </Section>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                <h2 className="section-title">Attendance records</h2>
                <button
                  type="button"
                  onClick={() => setExpanded((current) => !current)}
                  className="min-h-9 text-sm font-semibold text-brand-700 hover:underline sm:hidden"
                  aria-expanded={expanded}
                >
                  {expanded ? 'Hide details' : 'Show remarks'}
                </button>
              </div>

              {records?.length ? (
                <>
                  {/* Stacked cards on phones */}
                  <ul className="divide-y divide-slate-100 sm:hidden">
                    {records.map((record) => (
                      <li key={record.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatDate(record.date)}
                          </span>
                          <StatusBadge kind="attendance" value={record.status} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {record.session ? record.session.replace(/_/g, ' ') : 'Full day'} ·{' '}
                          {formatTime(record.marked_at)}
                        </p>
                        {expanded && (
                          <p className="mt-1 text-xs text-slate-500">
                            Marked by {record.marked_by || 'hostel staff'}
                            {record.remarks ? ` · ${record.remarks}` : ''}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Table from sm upwards */}
                  <div className="table-wrap hidden sm:block">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Session</th>
                          <th scope="col">Status</th>
                          <th scope="col">Marked at</th>
                          <th scope="col">Marked by</th>
                          <th scope="col">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td className="whitespace-nowrap">{formatDate(record.date)}</td>
                            <td className="whitespace-nowrap capitalize">
                              {record.session ? record.session.replace(/_/g, ' ').toLowerCase() : 'Full day'}
                            </td>
                            <td>
                              <StatusBadge kind="attendance" value={record.status} />
                            </td>
                            <td className="whitespace-nowrap">{formatTime(record.marked_at)}</td>
                            <td>{record.marked_by || '—'}</td>
                            <td className="max-w-56">{record.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4">
                    <Pagination
                      meta={meta}
                      page={page}
                      onPageChange={setPage}
                      perPage={perPage}
                      onPerPageChange={(size) => {
                        setPerPage(size)
                        reset()
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="muted px-4 py-6 sm:px-5">
                  No attendance records were marked in {monthLabel(year, month)}.
                </p>
              )}
            </Card>

            <p className="muted">
              Attendance is official hostel data recorded by wardens. If a record looks wrong, send
              a suggestion and the office will check it.
            </p>
          </div>
        )}
      </DataState>
    </>
  )
}
