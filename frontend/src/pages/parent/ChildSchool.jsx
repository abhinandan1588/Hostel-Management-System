import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, History, School } from 'lucide-react'

import {
  Avatar,
  Card,
  DataState,
  Loader,
  PageHeader,
  Pagination,
  Section,
  StatusBadge,
} from '../../components/common'
import { useApi, usePagination } from '../../hooks'
import { parentPortalService } from '../../services'
import { formatDate, formatLongDate, formatTime, shiftDate, todayISO } from '../../utils/format'

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
]

function ChildSwitcher({ items, value, onChange, id = 'school-child' }) {
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

export default function ParentChildSchool() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [days, setDays] = useState('30')

  const query = useMemo(() => {
    const end = todayISO()
    return {
      start_date: shiftDate(end, -(Number(days) - 1)),
      end_date: end,
      page,
      per_page: perPage,
    }
  }, [days, page, perPage])

  const fetcher = useCallback(() => parentPortalService.school(id, query), [id, query])
  const { data, meta, loading, error, reload } = useApi(fetcher)

  const siblingsFetcher = useCallback(() => parentPortalService.children(), [])
  const { data: siblings } = useApi(siblingsFetcher)
  const child = siblings?.find((item) => String(item.id) === String(id))

  const todayRecord = meta?.today

  return (
    <>
      <PageHeader
        title="School tracking"
        subtitle={child?.full_name ? `${child.full_name} · departures and returns` : 'Departures and returns'}
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
        onChange={(nextId) => navigate(`/parent/children/${nextId}/school`)}
      />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<Loader label="Loading school records…" />}
      >
        {(records) => (
          <div className="space-y-4">
            {/* --------------------------------------------------- hero card */}
            <Card className="card-pad">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <School className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Today · {formatLongDate(todayISO())}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge
                      kind="school"
                      value={todayRecord?.status}
                      fallback="Not marked yet"
                    />
                  </div>
                  {todayRecord?.remarks && (
                    <p className="mt-2 text-sm text-slate-600">{todayRecord.remarks}</p>
                  )}
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                {[
                  { label: 'Departed', value: todayRecord?.departure_time },
                  { label: 'Expected back', value: todayRecord?.expected_return_time },
                  { label: 'Actually returned', value: todayRecord?.actual_return_time },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      {cell.label}
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      {formatTime(cell.value)}
                    </dd>
                  </div>
                ))}
              </dl>

              {todayRecord?.recorded_by && (
                <p className="mt-3 text-xs text-slate-400">
                  Recorded by {todayRecord.recorded_by}
                </p>
              )}
            </Card>

            {/* ----------------------------------------------------- history */}
            <Section
              title="History"
              subtitle={meta ? `${meta.total} record${meta.total === 1 ? '' : 's'}` : undefined}
              icon={History}
              action={
                <select
                  className="input w-auto py-2 text-sm"
                  value={days}
                  onChange={(event) => {
                    setDays(event.target.value)
                    reset()
                  }}
                  aria-label="Choose a date range"
                >
                  {RANGES.map((range) => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
              }
              bodyClassName="px-0 sm:px-0"
            >
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
                          <StatusBadge kind="school" value={record.status} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Left {formatTime(record.departure_time)} · expected{' '}
                          {formatTime(record.expected_return_time)} · returned{' '}
                          {formatTime(record.actual_return_time)}
                        </p>
                        {record.remarks && (
                          <p className="mt-1 text-xs text-slate-500">{record.remarks}</p>
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
                          <th scope="col">Status</th>
                          <th scope="col">Departed</th>
                          <th scope="col">Expected back</th>
                          <th scope="col">Returned</th>
                          <th scope="col">Recorded by</th>
                          <th scope="col">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td className="whitespace-nowrap">{formatDate(record.date)}</td>
                            <td>
                              <StatusBadge kind="school" value={record.status} />
                            </td>
                            <td className="whitespace-nowrap">
                              {formatTime(record.departure_time)}
                            </td>
                            <td className="whitespace-nowrap">
                              {formatTime(record.expected_return_time)}
                            </td>
                            <td className="whitespace-nowrap">
                              {formatTime(record.actual_return_time)}
                            </td>
                            <td>{record.recorded_by || '—'}</td>
                            <td className="max-w-56">{record.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 sm:px-5">
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
                  No school movement was recorded in this period.
                </p>
              )}
            </Section>
          </div>
        )}
      </DataState>
    </>
  )
}
