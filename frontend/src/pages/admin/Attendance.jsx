import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CheckCheck, ClipboardList, History, Save, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataState,
  DateStepper,
  PageHeader,
  Pagination,
  RadioGroup,
  Section,
  SelectField,
  SkeletonRows,
  StatusBadge,
  Tabs,
} from '../../components/common'
import { AttendanceTrendChart } from '../../components/dashboard/Charts'
import { useApi, usePagination } from '../../hooks'
import { attendanceService, studentService } from '../../services'
import { formatDate, formatDateTime, humanize, shiftDate, todayISO } from '../../utils/format'
import { ATTENDANCE, labelOf, optionsFrom } from '../../utils/labels'

/** The four statuses a warden can set from the roll-call sheet. */
const QUICK_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE']
const TILE_ORDER = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE', 'NOT_MARKED']
const TILE_TONES = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  ABSENT: 'bg-red-50 text-red-700',
  LEAVE: 'bg-sky-50 text-sky-700',
  LATE: 'bg-amber-50 text-amber-700',
  NOT_MARKED: 'bg-slate-100 text-slate-600',
}

const SESSIONS = optionsFrom(['MORNING', 'EVENING', 'NIGHT'])

const TABS = [
  { id: 'mark', label: 'Mark attendance', icon: ClipboardList },
  { id: 'history', label: 'History', icon: History },
]

function CountTiles({ counts }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {TILE_ORDER.map((status) => (
        <div key={status} className={`rounded-xl px-3 py-2.5 text-center ${TILE_TONES[status]}`}>
          <p className="text-xl font-bold tabular-nums">{counts?.[status] ?? 0}</p>
          <p className="text-[11px] font-semibold">{labelOf('attendance', status)}</p>
        </div>
      ))}
    </div>
  )
}

export default function AdminAttendance() {
  const [tab, setTab] = useState('mark')
  const [date, setDate] = useState(todayISO())
  const [session, setSession] = useState('MORNING')
  const [studentClass, setStudentClass] = useState('')

  /** Optimistic status/remark edits, keyed by student id, cleared after a refresh. */
  const [statusDrafts, setStatusDrafts] = useState({})
  const [remarkDrafts, setRemarkDrafts] = useState({})
  const [busyCell, setBusyCell] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const optionsFetcher = useCallback(() => studentService.filterOptions(), [])
  const { data: filterOptions } = useApi(optionsFetcher)
  const classOptions = (filterOptions?.classes || []).map((value) => ({ value, label: value }))

  /* ------------------------------------------------------------- roll call */
  const sheetFetcher = useCallback(
    () =>
      attendanceService.sheet({
        date,
        session,
        ...(studentClass ? { student_class: studentClass } : {}),
      }),
    [date, session, studentClass],
  )
  const { data: sheet, loading, error, reload, refresh } = useApi(sheetFetcher)

  const trendFetcher = useCallback(
    () => attendanceService.trend({ start_date: shiftDate(date, -13), end_date: date }),
    [date],
  )
  const {
    data: trend,
    loading: trendLoading,
    error: trendError,
    reload: reloadTrend,
  } = useApi(trendFetcher)

  const resetDrafts = () => {
    setStatusDrafts({})
    setRemarkDrafts({})
  }

  const statusOf = (row) => statusDrafts[row.id] ?? row.status ?? null
  const remarkOf = (row) => remarkDrafts[row.id] ?? row.remarks ?? ''

  const remaining = (sheet?.rows || []).filter((row) => !statusOf(row))

  const markOne = async (row, status) => {
    const previous = statusDrafts[row.id]
    setStatusDrafts((current) => ({ ...current, [row.id]: status }))
    setBusyCell(`${row.id}:${status}`)
    try {
      await attendanceService.record({
        student_id: row.id,
        status,
        date,
        session,
        remarks: remarkOf(row) || null,
      })
      toast.success(`${row.full_name}: ${labelOf('attendance', status)}.`)
      await refresh()
      setStatusDrafts((current) => {
        const next = { ...current }
        delete next[row.id]
        return next
      })
      setRemarkDrafts((current) => {
        const next = { ...current }
        delete next[row.id]
        return next
      })
    } catch (err) {
      toast.error(err.message)
      setStatusDrafts((current) => {
        const next = { ...current }
        if (previous === undefined) delete next[row.id]
        else next[row.id] = previous
        return next
      })
    } finally {
      setBusyCell(null)
    }
  }

  const saveRemark = async (row) => {
    if (!row.record_id) {
      toast.error('Set a status for this student first, then the remark can be saved with it.')
      return
    }
    setBusyCell(`${row.id}:remark`)
    try {
      await attendanceService.update(row.record_id, { remarks: remarkOf(row) || null })
      toast.success(`Remark saved for ${row.full_name}.`)
      await refresh()
      setRemarkDrafts((current) => {
        const next = { ...current }
        delete next[row.id]
        return next
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyCell(null)
    }
  }

  const markRemainingPresent = async () => {
    setBulkBusy(true)
    try {
      await attendanceService.bulkRecord({
        date,
        session,
        records: remaining.map((row) => ({ student_id: row.id, status: 'PRESENT' })),
      })
      toast.success(`${remaining.length} student(s) marked present.`)
      setBulkOpen(false)
      resetDrafts()
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBulkBusy(false)
    }
  }

  /* --------------------------------------------------------------- history */
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [historyFilters, setHistoryFilters] = useState(() => ({
    start_date: shiftDate(todayISO(), -6),
    end_date: todayISO(),
    status: '',
    student_class: '',
  }))

  const setHistoryFilter = (key, value) => {
    setHistoryFilters((current) => ({ ...current, [key]: value }))
    reset()
  }

  const historyQuery = useMemo(() => {
    const cleaned = Object.fromEntries(
      Object.entries(historyFilters).filter(([, value]) => value !== '' && value !== null),
    )
    return { ...cleaned, page, per_page: perPage }
  }, [historyFilters, page, perPage])

  const historyFetcher = useCallback(() => attendanceService.list(historyQuery), [historyQuery])
  const {
    data: historyRows,
    meta,
    loading: historyLoading,
    error: historyError,
    reload: reloadHistory,
    refresh: refreshHistory,
  } = useApi(historyFetcher)

  const deleteRecord = async () => {
    setDeleteBusy(true)
    try {
      await attendanceService.remove(toDelete.id)
      toast.success('Attendance record deleted.')
      setToDelete(null)
      await refreshHistory()
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Daily roll call for every active student. Only administrators can change these records."
        actions={
          <Button
            icon={CheckCheck}
            onClick={() => setBulkOpen(true)}
            disabled={tab !== 'mark' || remaining.length === 0}
          >
            Mark all remaining present
          </Button>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-end">
          <div>
            <p className="label">Date</p>
            <DateStepper
              value={date}
              max={todayISO()}
              onChange={(value) => {
                setDate(value)
                resetDrafts()
              }}
            />
          </div>
          <RadioGroup
            label="Session"
            name="attendance-session"
            value={session}
            options={SESSIONS}
            onChange={(value) => {
              setSession(value)
              resetDrafts()
            }}
          />
          <SelectField
            label="Class"
            placeholder="All classes"
            options={classOptions}
            value={studentClass}
            onChange={(event) => {
              setStudentClass(event.target.value)
              resetDrafts()
            }}
            className="lg:w-48"
          />
        </div>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'mark' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`Roll call · ${formatDate(date)}`}
              subtitle={
                sheet
                  ? `${sheet.marked} of ${sheet.total_students} marked · ${sheet.pending} pending`
                  : 'Loading the sheet…'
              }
              icon={CalendarCheck}
            />
            <DataState
              loading={loading}
              error={error}
              data={sheet}
              onRetry={reload}
              loadingLabel="Loading the roll-call sheet…"
              skeleton={
                <div className="card-pad">
                  <SkeletonRows rows={8} />
                </div>
              }
              isEmpty={(value) => !value?.rows?.length}
              emptyIcon={ClipboardList}
              emptyTitle="No students to mark"
              emptyMessage={
                studentClass
                  ? `No active students are in ${studentClass}.`
                  : 'Add active students before marking attendance.'
              }
            >
              {(data) => (
                <>
                  <CardBody className="pb-0">
                    <CountTiles counts={data.counts} />
                  </CardBody>
                  <div className="table-wrap mt-4">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Student</th>
                          <th scope="col">Class</th>
                          <th scope="col">Room</th>
                          <th scope="col">Status</th>
                          <th scope="col">Set status</th>
                          <th scope="col">Remarks</th>
                          <th scope="col">Marked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row) => {
                          const current = statusOf(row)
                          const remarkChanged = remarkDrafts[row.id] !== undefined
                          return (
                            <tr key={row.id}>
                              <td>
                                <Link
                                  to={`/admin/students/${row.id}`}
                                  className="flex items-center gap-2.5 hover:text-brand-700"
                                >
                                  <Avatar src={row.profile_photo} name={row.full_name} size="sm" />
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold text-slate-900">
                                      {row.full_name}
                                    </span>
                                    <span className="block truncate text-xs text-slate-500">
                                      {row.student_code}
                                    </span>
                                  </span>
                                </Link>
                              </td>
                              <td className="whitespace-nowrap">
                                {row.student_class || '—'}
                                {row.section ? ` · ${row.section}` : ''}
                              </td>
                              <td className="whitespace-nowrap">
                                {row.room_number
                                  ? `${row.room_number}${row.bed_number ? ` / Bed ${row.bed_number}` : ''}`
                                  : '—'}
                              </td>
                              <td>
                                <StatusBadge
                                  kind="attendance"
                                  value={current}
                                  fallback="Not marked"
                                />
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1.5">
                                  {QUICK_STATUSES.map((status) => {
                                    const active = current === status
                                    return (
                                      <Button
                                        key={status}
                                        size="sm"
                                        variant={active ? 'primary' : 'secondary'}
                                        className="min-h-9"
                                        aria-pressed={active}
                                        loading={busyCell === `${row.id}:${status}`}
                                        onClick={() => markOne(row, status)}
                                      >
                                        {labelOf('attendance', status)}
                                      </Button>
                                    )
                                  })}
                                </div>
                              </td>
                              <td className="min-w-52">
                                <div className="flex items-center gap-1.5">
                                  <label className="sr-only" htmlFor={`remark-${row.id}`}>
                                    Remarks for {row.full_name}
                                  </label>
                                  <input
                                    id={`remark-${row.id}`}
                                    className="input min-h-9 py-1.5 text-xs"
                                    value={remarkOf(row)}
                                    placeholder="Optional remark"
                                    onChange={(event) =>
                                      setRemarkDrafts((cur) => ({
                                        ...cur,
                                        [row.id]: event.target.value,
                                      }))
                                    }
                                  />
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={Save}
                                    className="min-h-9"
                                    disabled={!remarkChanged}
                                    loading={busyCell === `${row.id}:remark`}
                                    onClick={() => saveRemark(row)}
                                    aria-label={`Save remark for ${row.full_name}`}
                                  />
                                </div>
                              </td>
                              <td className="text-xs whitespace-nowrap text-slate-500">
                                {row.marked_at ? (
                                  <>
                                    {formatDateTime(row.marked_at)}
                                    <span className="block text-slate-400">
                                      by {row.marked_by || 'System'}
                                    </span>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </DataState>
          </Card>

          <Section title="Attendance trend" subtitle="Last 14 days · morning session">
            <DataState
              loading={trendLoading}
              error={trendError}
              data={trend}
              onRetry={reloadTrend}
              loadingLabel="Loading the trend…"
              isEmpty={false}
            >
              {(rows) => <AttendanceTrendChart data={rows} />}
            </DataState>
          </Section>
        </div>
      ) : (
        <Card>
          <CardHeader
            title="Attendance history"
            subtitle="Every recorded entry, newest first"
            icon={History}
          />
          <CardBody className="border-b border-slate-100">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="label">From</span>
                <input
                  type="date"
                  className="input"
                  value={historyFilters.start_date}
                  max={historyFilters.end_date || todayISO()}
                  onChange={(event) => setHistoryFilter('start_date', event.target.value)}
                />
              </label>
              <label className="block">
                <span className="label">To</span>
                <input
                  type="date"
                  className="input"
                  value={historyFilters.end_date}
                  max={todayISO()}
                  onChange={(event) => setHistoryFilter('end_date', event.target.value)}
                />
              </label>
              <SelectField
                label="Status"
                placeholder="Any status"
                options={optionsFrom(ATTENDANCE).filter((option) => option.value !== 'NOT_MARKED')}
                value={historyFilters.status}
                onChange={(event) => setHistoryFilter('status', event.target.value)}
              />
              <SelectField
                label="Class"
                placeholder="All classes"
                options={classOptions}
                value={historyFilters.student_class}
                onChange={(event) => setHistoryFilter('student_class', event.target.value)}
              />
            </div>
          </CardBody>

          <DataState
            loading={historyLoading}
            error={historyError}
            data={historyRows}
            onRetry={reloadHistory}
            loadingLabel="Loading attendance history…"
            skeleton={
              <div className="card-pad">
                <SkeletonRows rows={6} />
              </div>
            }
            emptyIcon={History}
            emptyTitle="No attendance records"
            emptyMessage="No entries match the selected period and filters."
          >
            {(rows) => (
              <>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Student</th>
                        <th scope="col">Date</th>
                        <th scope="col">Session</th>
                        <th scope="col">Status</th>
                        <th scope="col">Remarks</th>
                        <th scope="col">Marked by</th>
                        <th scope="col" className="text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <Link
                              to={`/admin/students/${record.student_id}`}
                              className="font-medium text-slate-800 hover:text-brand-700"
                            >
                              {record.student?.full_name || `Student #${record.student_id}`}
                              <span className="block text-xs text-slate-400">
                                {record.student?.student_code}
                              </span>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap">{formatDate(record.date)}</td>
                          <td className="whitespace-nowrap">{humanize(record.session)}</td>
                          <td>
                            <StatusBadge kind="attendance" value={record.status} />
                          </td>
                          <td className="max-w-52 truncate">{record.remarks || '—'}</td>
                          <td className="text-xs whitespace-nowrap text-slate-500">
                            {record.marked_by || 'System'}
                            <span className="block text-slate-400">
                              {formatDateTime(record.marked_at)}
                            </span>
                          </td>
                          <td>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setToDelete(record)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                                aria-label={`Delete attendance record for ${
                                  record.student?.full_name || 'this student'
                                } on ${formatDate(record.date)}`}
                                title="Delete record"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
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
            )}
          </DataState>
        </Card>
      )}

      <ConfirmDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        loading={bulkBusy}
        variant="success"
        title="Mark everyone else present?"
        message={`${remaining.length} student(s) have no status for the ${humanize(
          session,
        ).toLowerCase()} session on ${formatDate(date)}. They will all be recorded as present. Existing entries are left untouched.`}
        confirmLabel={`Mark ${remaining.length} present`}
        onConfirm={markRemainingPresent}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        loading={deleteBusy}
        title="Delete this attendance record?"
        message={`The ${labelOf('attendance', toDelete?.status).toLowerCase()} entry for ${
          toDelete?.student?.full_name || 'this student'
        } on ${formatDate(toDelete?.date)} will be removed. Attendance is an official record, so deletions are written to the audit log.`}
        confirmLabel="Delete record"
        onConfirm={deleteRecord}
      />
    </>
  )
}
