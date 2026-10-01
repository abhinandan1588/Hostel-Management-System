import { useCallback, useMemo } from 'react'
import { CalendarCheck, Info } from 'lucide-react'

import {
  Card,
  CardBody,
  CardHeader,
  DataState,
  EmptyState,
  MonthPicker,
  PageHeader,
  Pagination,
  Section,
  SkeletonRows,
  StatusBadge,
} from '../../components/common'
import {
  AttendanceCalendar,
  AttendanceSummaryGrid,
} from '../../components/attendance/AttendanceCalendar'
import { useApi, useMonthSelection, usePagination } from '../../hooks'
import { studentPortalService } from '../../services'
import {
  endOfMonthISO,
  formatDate,
  formatDateTime,
  formatPercent,
  humanize,
  monthLabel,
  startOfMonthISO,
} from '../../utils/format'

/**
 * Read-only view of the student's own hostel attendance. Only hostel staff can
 * record or change an attendance entry, so this page offers no edit controls.
 */
export default function StudentAttendance() {
  const { year, month, goPrevious, goNext } = useMonthSelection()
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)

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

  const fetcher = useCallback(() => studentPortalService.attendance(query), [query])
  const { data: records, meta, loading, error, reload } = useApi(fetcher)

  const showPreviousMonth = () => {
    goPrevious()
    reset()
  }

  const showNextMonth = () => {
    goNext()
    reset()
  }

  const summary = meta?.summary
  const calendar = meta?.calendar

  return (
    <>
      <PageHeader
        title="My attendance"
        subtitle={
          summary
            ? `${formatPercent(summary.attendance_percentage)} present across ${summary.recorded_days} recorded day${
                summary.recorded_days === 1 ? '' : 's'
              } in ${monthLabel(year, month)}`
            : monthLabel(year, month)
        }
        actions={
          <MonthPicker
            year={year}
            month={month}
            onPrevious={showPreviousMonth}
            onNext={showNextMonth}
          />
        }
      />

      <div
        className="mb-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
        role="note"
      >
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          Attendance is marked by hostel staff. If something looks wrong, speak to your warden or
          send a report from <strong>Report an Issue</strong> - it cannot be changed here.
        </p>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={false}
        loadingLabel="Loading your attendance…"
        skeleton={
          <Card className="card-pad">
            <SkeletonRows rows={6} />
          </Card>
        }
      >
        <div className="space-y-4">
          {summary && (
            <section aria-label="Month summary">
              <AttendanceSummaryGrid summary={summary} />
            </section>
          )}

          <Section
            title={`Calendar · ${monthLabel(year, month)}`}
            subtitle="Each day shows a letter code as well as a colour"
            icon={CalendarCheck}
          >
            {calendar?.days?.length ? (
              <AttendanceCalendar calendar={calendar} />
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="Nothing marked yet"
                message={`No attendance has been recorded for ${monthLabel(year, month)}.`}
              />
            )}
          </Section>

          <Card>
            <CardHeader
              title="Attendance records"
              subtitle={meta ? `${meta.total} record${meta.total === 1 ? '' : 's'}` : undefined}
            />
            <CardBody className="pt-0">
              {records?.length ? (
                <>
                  <div className="table-wrap">
                    <table className="data-table">
                      <caption className="sr-only">
                        My attendance records for {monthLabel(year, month)}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Session</th>
                          <th scope="col">Status</th>
                          <th scope="col">Marked by</th>
                          <th scope="col">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td className="font-medium whitespace-nowrap text-slate-800">
                              {formatDate(record.date)}
                            </td>
                            <td className="whitespace-nowrap">
                              {record.session ? humanize(record.session) : '—'}
                            </td>
                            <td>
                              <StatusBadge kind="attendance" value={record.status} />
                            </td>
                            <td className="whitespace-nowrap">
                              <span className="block">{record.marked_by || '—'}</span>
                              {record.marked_at && (
                                <span className="text-xs text-slate-400">
                                  {formatDateTime(record.marked_at)}
                                </span>
                              )}
                            </td>
                            <td className="max-w-64 text-slate-600">{record.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    meta={meta}
                    page={page}
                    onPageChange={setPage}
                    perPage={perPage}
                    onPerPageChange={(value) => {
                      setPerPage(value)
                      reset()
                    }}
                  />
                </>
              ) : (
                <EmptyState
                  icon={CalendarCheck}
                  title="No records in this month"
                  message="Pick another month to see earlier attendance."
                />
              )}
            </CardBody>
          </Card>
        </div>
      </DataState>
    </>
  )
}
