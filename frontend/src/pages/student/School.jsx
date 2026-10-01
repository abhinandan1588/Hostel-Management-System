import { useCallback, useMemo } from 'react'
import { Info, School } from 'lucide-react'

import {
  Card,
  CardBody,
  CardHeader,
  DataState,
  EmptyState,
  InfoList,
  MonthPicker,
  PageHeader,
  Pagination,
  SkeletonRows,
  StatusBadge,
} from '../../components/common'
import { useApi, useMonthSelection, usePagination } from '../../hooks'
import { studentPortalService } from '../../services'
import {
  endOfMonthISO,
  formatDate,
  formatLongDate,
  formatTime,
  monthLabel,
  startOfMonthISO,
} from '../../utils/format'
import { labelOf } from '../../utils/labels'

/**
 * The student's own school-going record. Read-only: only hostel staff record
 * departures and returns.
 */
export default function StudentSchool() {
  const { year, month, goPrevious, goNext } = useMonthSelection()
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)

  const query = useMemo(
    () => ({
      start_date: startOfMonthISO(year, month),
      end_date: endOfMonthISO(year, month),
      page,
      per_page: perPage,
    }),
    [year, month, page, perPage],
  )

  const fetcher = useCallback(() => studentPortalService.school(query), [query])
  const { data: records, meta, loading, error, reload } = useApi(fetcher)

  const showPreviousMonth = () => {
    goPrevious()
    reset()
  }

  const showNextMonth = () => {
    goNext()
    reset()
  }

  const today = meta?.today

  return (
    <>
      <PageHeader
        title="School status"
        subtitle={formatLongDate(new Date())}
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
          Hostel staff record when you leave for school and when you return. This page is for
          viewing only.
        </p>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={false}
        loadingLabel="Loading your school record…"
        skeleton={
          <Card className="card-pad">
            <SkeletonRows rows={5} />
          </Card>
        }
      >
        <div className="space-y-4">
          {/* Today ---------------------------------------------------- */}
          <Card className="card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Today
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {today ? labelOf('school', today.status) : 'Not recorded yet'}
                </h2>
                <p className="muted mt-0.5">
                  {today
                    ? `Recorded by ${today.recorded_by || 'hostel staff'}`
                    : 'Your warden has not marked your school status for today.'}
                </p>
              </div>
              <StatusBadge kind="school" value={today?.status} />
            </div>

            {today && (
              <InfoList
                className="mt-4"
                columns={3}
                items={[
                  { label: 'Left hostel', value: formatTime(today.departure_time) },
                  { label: 'Expected back', value: formatTime(today.expected_return_time) },
                  {
                    label: 'Returned at',
                    value: today.actual_return_time ? formatTime(today.actual_return_time) : null,
                  },
                  today.remarks ? { label: 'Remarks', value: today.remarks } : null,
                ]}
              />
            )}
          </Card>

          {/* History -------------------------------------------------- */}
          <Card>
            <CardHeader
              title={`History · ${monthLabel(year, month)}`}
              subtitle={meta ? `${meta.total} record${meta.total === 1 ? '' : 's'}` : undefined}
              icon={School}
            />
            <CardBody className="pt-0">
              {records?.length ? (
                <>
                  <div className="table-wrap">
                    <table className="data-table">
                      <caption className="sr-only">
                        My school status history for {monthLabel(year, month)}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Status</th>
                          <th scope="col">Left</th>
                          <th scope="col">Expected back</th>
                          <th scope="col">Returned</th>
                          <th scope="col">Recorded by</th>
                          <th scope="col">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td className="font-medium whitespace-nowrap text-slate-800">
                              {formatDate(record.date)}
                            </td>
                            <td>
                              <StatusBadge kind="school" value={record.status} />
                            </td>
                            <td className="whitespace-nowrap tabular-nums">
                              {formatTime(record.departure_time)}
                            </td>
                            <td className="whitespace-nowrap tabular-nums">
                              {formatTime(record.expected_return_time)}
                            </td>
                            <td className="whitespace-nowrap tabular-nums">
                              {formatTime(record.actual_return_time)}
                            </td>
                            <td className="whitespace-nowrap">{record.recorded_by || '—'}</td>
                            <td className="max-w-56 text-slate-600">{record.remarks || '—'}</td>
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
                  icon={School}
                  title="Nothing recorded"
                  message={`No school status was recorded in ${monthLabel(year, month)}.`}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </DataState>
    </>
  )
}
