import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Home, Save, School } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataState,
  DateStepper,
  PageHeader,
  Section,
  SelectField,
  SkeletonRows,
  StatusBadge,
} from '../../components/common'
import { SchoolAttendanceChart } from '../../components/dashboard/Charts'
import { useApi } from '../../hooks'
import { schoolService, studentService } from '../../services'
import { formatDate, formatTime, shiftDate, todayISO } from '../../utils/format'
import { SCHOOL_STATUS, labelOf, optionsFrom } from '../../utils/labels'

/** NOT_MARKED is a display-only bucket, never a value the API accepts. */
const STATUS_OPTIONS = optionsFrom(SCHOOL_STATUS).filter((option) => option.value !== 'NOT_MARKED')

const TILE_ORDER = [
  'WENT_TO_SCHOOL',
  'RETURNED_FROM_SCHOOL',
  'DID_NOT_GO',
  'ON_LEAVE',
  'SCHOOL_HOLIDAY',
  'NOT_MARKED',
]

const TILE_TONES = {
  WENT_TO_SCHOOL: 'bg-emerald-50 text-emerald-700',
  RETURNED_FROM_SCHOOL: 'bg-sky-50 text-sky-700',
  DID_NOT_GO: 'bg-red-50 text-red-700',
  ON_LEAVE: 'bg-amber-50 text-amber-700',
  SCHOOL_HOLIDAY: 'bg-slate-100 text-slate-600',
  NOT_MARKED: 'bg-slate-100 text-slate-600',
}

/** "14:30:00" -> "14:30" for <input type="time">. */
const toTimeInput = (value) => (value ? String(value).slice(0, 5) : '')

const nowTimeInput = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function AdminSchoolTracking() {
  const [date, setDate] = useState(todayISO())
  const [studentClass, setStudentClass] = useState('')
  /** Per-row edits, keyed by student id, cleared once the sheet is re-fetched. */
  const [drafts, setDrafts] = useState({})
  const [busyRow, setBusyRow] = useState(null)

  const optionsFetcher = useCallback(() => studentService.filterOptions(), [])
  const { data: filterOptions } = useApi(optionsFetcher)
  const classOptions = (filterOptions?.classes || []).map((value) => ({ value, label: value }))

  const sheetFetcher = useCallback(
    () =>
      schoolService.sheet({
        date,
        ...(studentClass ? { student_class: studentClass } : {}),
      }),
    [date, studentClass],
  )
  const { data: sheet, loading, error, reload, refresh } = useApi(sheetFetcher)

  const weeklyFetcher = useCallback(
    () => schoolService.weekly({ start_date: shiftDate(date, -6), end_date: date }),
    [date],
  )
  const {
    data: weekly,
    loading: weeklyLoading,
    error: weeklyError,
    reload: reloadWeekly,
  } = useApi(weeklyFetcher)

  const draftFor = (row) => ({
    status: row.status || '',
    departure_time: toTimeInput(row.departure_time),
    expected_return_time: toTimeInput(row.expected_return_time),
    actual_return_time: toTimeInput(row.actual_return_time),
    remarks: row.remarks || '',
    ...(drafts[row.id] || {}),
  })

  const setDraft = (row, key, value) => {
    setDrafts((current) => ({
      ...current,
      [row.id]: { ...draftFor(row), [key]: value },
    }))
  }

  const clearDraft = (studentId) => {
    setDrafts((current) => {
      const next = { ...current }
      delete next[studentId]
      return next
    })
  }

  const saveRow = async (row) => {
    const draft = draftFor(row)
    if (!draft.status) {
      toast.error('Choose a school status for this student first.')
      return
    }
    setBusyRow(`${row.id}:save`)
    try {
      await schoolService.record({
        student_id: row.id,
        date,
        status: draft.status,
        departure_time: draft.departure_time || null,
        expected_return_time: draft.expected_return_time || null,
        actual_return_time: draft.actual_return_time || null,
        remarks: draft.remarks || null,
      })
      toast.success(`${row.full_name}: ${labelOf('school', draft.status)}.`)
      clearDraft(row.id)
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyRow(null)
    }
  }

  const markReturned = async (row) => {
    setBusyRow(`${row.id}:returned`)
    try {
      await schoolService.markReturned(row.record_id, nowTimeInput())
      toast.success(`${row.full_name} marked as returned from school.`)
      clearDraft(row.id)
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyRow(null)
    }
  }

  return (
    <>
      <PageHeader
        title="School tracking"
        subtitle="Who left for school, when they are expected back and who has returned."
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
          <div>
            <p className="label">Date</p>
            <DateStepper
              value={date}
              max={todayISO()}
              onChange={(value) => {
                setDate(value)
                setDrafts({})
              }}
            />
          </div>
          <SelectField
            label="Class"
            placeholder="All classes"
            options={classOptions}
            value={studentClass}
            onChange={(event) => {
              setStudentClass(event.target.value)
              setDrafts({})
            }}
            className="sm:w-48"
          />
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader
            title={`School day · ${formatDate(date)}`}
            subtitle={sheet ? `${sheet.total_students} active student(s)` : 'Loading the sheet…'}
            icon={School}
          />
          <DataState
            loading={loading}
            error={error}
            data={sheet}
            onRetry={reload}
            loadingLabel="Loading the school sheet…"
            skeleton={
              <div className="card-pad">
                <SkeletonRows rows={8} />
              </div>
            }
            isEmpty={(value) => !value?.rows?.length}
            emptyIcon={School}
            emptyTitle="No students to track"
            emptyMessage={
              studentClass
                ? `No active students are in ${studentClass}.`
                : 'Add active students before tracking school attendance.'
            }
          >
            {(data) => (
              <>
                <CardBody className="pb-0">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {TILE_ORDER.map((status) => (
                      <div
                        key={status}
                        className={`rounded-xl px-3 py-2.5 text-center ${TILE_TONES[status]}`}
                      >
                        <p className="text-xl font-bold tabular-nums">
                          {data.counts?.[status] ?? 0}
                        </p>
                        <p className="text-[11px] font-semibold">{labelOf('school', status)}</p>
                      </div>
                    ))}
                  </div>
                </CardBody>

                <div className="table-wrap mt-4">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Student</th>
                        <th scope="col">Recorded</th>
                        <th scope="col">Status</th>
                        <th scope="col">Left at</th>
                        <th scope="col">Expected back</th>
                        <th scope="col">Returned at</th>
                        <th scope="col">Remarks</th>
                        <th scope="col" className="text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => {
                        const draft = draftFor(row)
                        const canMarkReturned =
                          Boolean(row.record_id) && row.status === 'WENT_TO_SCHOOL'
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
                                    {row.student_class ? ` · ${row.student_class}` : ''}
                                  </span>
                                </span>
                              </Link>
                            </td>
                            <td>
                              <StatusBadge
                                kind="school"
                                value={row.status}
                                fallback="Not marked"
                              />
                            </td>
                            <td className="min-w-44">
                              <label className="sr-only" htmlFor={`status-${row.id}`}>
                                School status for {row.full_name}
                              </label>
                              <select
                                id={`status-${row.id}`}
                                className="input min-h-9 py-1.5 text-xs"
                                value={draft.status}
                                onChange={(event) => setDraft(row, 'status', event.target.value)}
                              >
                                <option value="">Not marked</option>
                                {STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <label className="sr-only" htmlFor={`departure-${row.id}`}>
                                Departure time for {row.full_name}
                              </label>
                              <input
                                id={`departure-${row.id}`}
                                type="time"
                                className="input min-h-9 w-32 py-1.5 text-xs"
                                value={draft.departure_time}
                                onChange={(event) =>
                                  setDraft(row, 'departure_time', event.target.value)
                                }
                              />
                            </td>
                            <td>
                              <label className="sr-only" htmlFor={`expected-${row.id}`}>
                                Expected return time for {row.full_name}
                              </label>
                              <input
                                id={`expected-${row.id}`}
                                type="time"
                                className="input min-h-9 w-32 py-1.5 text-xs"
                                value={draft.expected_return_time}
                                onChange={(event) =>
                                  setDraft(row, 'expected_return_time', event.target.value)
                                }
                              />
                            </td>
                            <td>
                              <label className="sr-only" htmlFor={`actual-${row.id}`}>
                                Actual return time for {row.full_name}
                              </label>
                              <input
                                id={`actual-${row.id}`}
                                type="time"
                                className="input min-h-9 w-32 py-1.5 text-xs"
                                value={draft.actual_return_time}
                                onChange={(event) =>
                                  setDraft(row, 'actual_return_time', event.target.value)
                                }
                              />
                              {row.actual_return_time && (
                                <span className="mt-1 block text-[11px] text-slate-400">
                                  Saved: {formatTime(row.actual_return_time)}
                                </span>
                              )}
                            </td>
                            <td className="min-w-48">
                              <label className="sr-only" htmlFor={`remarks-${row.id}`}>
                                Remarks for {row.full_name}
                              </label>
                              <input
                                id={`remarks-${row.id}`}
                                className="input min-h-9 py-1.5 text-xs"
                                value={draft.remarks}
                                placeholder="Optional remark"
                                onChange={(event) => setDraft(row, 'remarks', event.target.value)}
                              />
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {canMarkReturned && (
                                  <Button
                                    size="sm"
                                    variant="success"
                                    icon={Home}
                                    className="min-h-9"
                                    loading={busyRow === `${row.id}:returned`}
                                    onClick={() => markReturned(row)}
                                  >
                                    Returned
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  icon={Save}
                                  className="min-h-9"
                                  loading={busyRow === `${row.id}:save`}
                                  onClick={() => saveRow(row)}
                                >
                                  Save
                                </Button>
                              </div>
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

        <Section title="School attendance this week" subtitle="Last 7 days">
          <DataState
            loading={weeklyLoading}
            error={weeklyError}
            data={weekly}
            onRetry={reloadWeekly}
            loadingLabel="Loading the weekly chart…"
            isEmpty={false}
          >
            {(rows) => <SchoolAttendanceChart data={rows} />}
          </DataState>
        </Section>
      </div>
    </>
  )
}
