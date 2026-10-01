import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
  Eye,
  Filter,
  GraduationCap,
  Pencil,
  RotateCcw,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SelectField,
  SkeletonRows,
  StatusBadge,
} from '../../components/common'
import { StudentForm } from '../../components/students/StudentForm'
import { useApi, usePagination } from '../../hooks'
import { parentService, roomService, studentService } from '../../services'
import { formatDate } from '../../utils/format'
import { ATTENDANCE, HEALTH, VERIFICATION, optionsFrom } from '../../utils/labels'

const SORTS = [
  { value: 'full_name', label: 'Name (A–Z)' },
  { value: 'student_code', label: 'Student ID' },
  { value: 'student_class', label: 'Class' },
  { value: 'created_at', label: 'Recently added' },
]

export default function AdminStudents() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)

  const [filters, setFilters] = useState(() => ({
    q: searchParams.get('q') || '',
    student_class: searchParams.get('student_class') || '',
    school: searchParams.get('school') || '',
    room_id: searchParams.get('room_id') || '',
    verification_status: searchParams.get('verification_status') || '',
    attendance: searchParams.get('attendance') || '',
    health: searchParams.get('health') || '',
    is_active: searchParams.get('is_active') || '',
    sort_by: 'full_name',
    sort_dir: 'asc',
  }))
  const [showFilters, setShowFilters] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  const query = useMemo(() => {
    const cleaned = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== null),
    )
    return { ...cleaned, page, per_page: perPage }
  }, [filters, page, perPage])

  const listFetcher = useCallback(() => studentService.list(query), [query])
  const { data: students, meta, loading, error, reload, refresh } = useApi(listFetcher)

  const optionsFetcher = useCallback(() => studentService.filterOptions(), [])
  const { data: options } = useApi(optionsFetcher)

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    reset()
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => {
    setFilters({
      q: '',
      student_class: '',
      school: '',
      room_id: '',
      verification_status: '',
      attendance: '',
      health: '',
      is_active: '',
      sort_by: 'full_name',
      sort_dir: 'asc',
    })
    setSearchParams({}, { replace: true })
    reset()
  }

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && !['q', 'sort_by', 'sort_dir'].includes(key),
  ).length

  /* --- lookups needed by the create form --- */
  const bedsFetcher = useCallback(() => roomService.availableBeds(), [])
  const { data: beds } = useApi(bedsFetcher, { immediate: formOpen })
  const parentsFetcher = useCallback(
    () => parentService.lookup({ verification_status: 'VERIFIED' }),
    [],
  )
  const { data: parentOptions } = useApi(parentsFetcher, { immediate: formOpen })

  /* --- mutations --- */
  const handleSubmit = async (payload) => {
    setSubmitting(true)
    try {
      if (editing) {
        await studentService.update(editing.id, payload)
        toast.success('Student updated.')
      } else {
        await studentService.create(payload)
        toast.success('Student added.')
      }
      setFormOpen(false)
      setEditing(null)
      refresh()
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setSubmitting(false)
    }
  }

  const runAction = async (fn, message) => {
    setActionBusy(true)
    try {
      await fn()
      toast.success(message)
      setConfirm(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={meta ? `${meta.total} student${meta.total === 1 ? '' : 's'}` : 'Manage hostel students'}
        actions={
          <Button
            icon={UserPlus}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Add student
          </Button>
        }
      />

      {/* Search + filter bar */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={filters.q}
            onChange={(value) => setFilter('q', value)}
            placeholder="Search name, ID, school, parent, phone or room…"
            className="min-w-0 flex-1 sm:min-w-64"
          />
          <Button
            variant="secondary"
            icon={Filter}
            onClick={() => setShowFilters((current) => !current)}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-brand-700 px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <select
            className="input w-auto py-2.5 text-sm"
            value={filters.sort_by}
            onChange={(event) => setFilter('sort_by', event.target.value)}
            aria-label="Sort students"
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Class"
              placeholder="All classes"
              options={(options?.classes || []).map((value) => ({ value, label: value }))}
              value={filters.student_class}
              onChange={(event) => setFilter('student_class', event.target.value)}
            />
            <SelectField
              label="School"
              placeholder="All schools"
              options={(options?.schools || []).map((value) => ({ value, label: value }))}
              value={filters.school}
              onChange={(event) => setFilter('school', event.target.value)}
            />
            <SelectField
              label="Room"
              placeholder="All rooms"
              options={(options?.rooms || []).map((room) => ({ value: room.id, label: room.label }))}
              value={filters.room_id}
              onChange={(event) => setFilter('room_id', event.target.value)}
            />
            <SelectField
              label="Verification"
              placeholder="Any status"
              options={optionsFrom(VERIFICATION)}
              value={filters.verification_status}
              onChange={(event) => setFilter('verification_status', event.target.value)}
            />
            <SelectField
              label="Today's attendance"
              placeholder="Any"
              options={optionsFrom(ATTENDANCE)}
              value={filters.attendance}
              onChange={(event) => setFilter('attendance', event.target.value)}
            />
            <SelectField
              label="Health"
              placeholder="Any"
              options={optionsFrom(HEALTH)}
              value={filters.health}
              onChange={(event) => setFilter('health', event.target.value)}
            />
            <SelectField
              label="Record state"
              placeholder="Active only"
              options={[
                { value: 'true', label: 'Active only' },
                { value: 'false', label: 'Archived only' },
              ]}
              value={filters.is_active}
              onChange={(event) => setFilter('is_active', event.target.value)}
            />
            <div className="flex items-end">
              <Button variant="ghost" icon={X} onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <DataState
          loading={loading}
          error={error}
          data={students}
          onRetry={reload}
          skeleton={<div className="card-pad"><SkeletonRows rows={6} /></div>}
          loadingLabel="Loading students…"
          emptyIcon={GraduationCap}
          emptyTitle="No students found"
          emptyMessage={
            activeFilterCount || filters.q
              ? 'No students match the current search or filters.'
              : 'Add your first student to get started.'
          }
          emptyAction={
            activeFilterCount || filters.q ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button icon={UserPlus} onClick={() => setFormOpen(true)}>
                Add student
              </Button>
            )
          }
        >
          {(rows) => (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Class</th>
                      <th scope="col">School</th>
                      <th scope="col">Room</th>
                      <th scope="col">Parent</th>
                      <th scope="col">Status</th>
                      <th scope="col">Health</th>
                      <th scope="col">Today</th>
                      <th scope="col" className="text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((student) => {
                      const primaryParent =
                        student.parents?.find((parent) => parent.is_primary) || student.parents?.[0]
                      return (
                        <tr key={student.id}>
                          <td>
                            <Link
                              to={`/admin/students/${student.id}`}
                              className="flex items-center gap-2.5 hover:text-brand-700"
                            >
                              <Avatar src={student.profile_photo} name={student.full_name} size="sm" />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-slate-900">
                                  {student.full_name}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  {student.student_code}
                                  {student.has_login && ' · has login'}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap">
                            {student.student_class || '—'}
                            {student.section ? ` · ${student.section}` : ''}
                          </td>
                          <td className="max-w-40 truncate">{student.school_name || '—'}</td>
                          <td className="whitespace-nowrap">
                            {student.room_number
                              ? `${student.room_number}${student.bed_number ? ` / Bed ${student.bed_number}` : ''}`
                              : '—'}
                          </td>
                          <td className="max-w-40">
                            {primaryParent ? (
                              <span className="block truncate">
                                {primaryParent.full_name}
                                <span className="block text-xs text-slate-400">
                                  {primaryParent.relationship_type || 'Guardian'}
                                </span>
                              </span>
                            ) : (
                              <span className="text-amber-600">Not linked</span>
                            )}
                          </td>
                          <td>
                            <div className="flex flex-col gap-1">
                              <StatusBadge kind="verification" value={student.verification_status} />
                              {!student.is_active && <span className="badge-neutral">Archived</span>}
                              {student.account?.account_status === 'BLOCKED' && (
                                <span className="badge-danger">Blocked</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <StatusBadge kind="health" value={student.health_status} />
                          </td>
                          <td>
                            <StatusBadge
                              kind="attendance"
                              value={student.today_attendance}
                              fallback="Not marked"
                            />
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                to={`/admin/students/${student.id}`}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                                aria-label={`View ${student.full_name}`}
                                title="View profile"
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(student)
                                  setFormOpen(true)
                                }}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                                aria-label={`Edit ${student.full_name}`}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              {student.verification_status !== 'VERIFIED' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAction(
                                      () => studentService.verify(student.id),
                                      `${student.full_name} verified.`,
                                    )
                                  }
                                  className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                                  aria-label={`Verify ${student.full_name}`}
                                  title="Verify"
                                >
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {student.has_login && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirm({
                                      kind:
                                        student.account?.account_status === 'BLOCKED'
                                          ? 'unblock'
                                          : 'block',
                                      student,
                                    })
                                  }
                                  className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                                  aria-label={`Block or unblock ${student.full_name}`}
                                  title="Block / unblock login"
                                >
                                  <Ban className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {student.is_active ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirm({ kind: 'archive', student })}
                                  className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                                  aria-label={`Remove ${student.full_name}`}
                                  title="Remove student"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAction(
                                      () => studentService.restore(student.id),
                                      `${student.full_name} restored.`,
                                    )
                                  }
                                  className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                                  aria-label={`Restore ${student.full_name}`}
                                  title="Restore"
                                >
                                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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

      {/* Create / edit */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        title={editing ? `Edit ${editing.full_name}` : 'Add a new student'}
        description={
          editing
            ? 'Update the student record. Room, parent and login changes are on the profile page.'
            : 'Create the student record. You can assign a room, link a parent and add a login now or later.'
        }
        size="lg"
      >
        <StudentForm
          key={editing?.id || 'new'}
          student={editing}
          beds={beds || []}
          parents={parentOptions || []}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      </Modal>

      {/* Block / unblock */}
      <ConfirmDialog
        open={confirm?.kind === 'block' || confirm?.kind === 'unblock'}
        onClose={() => setConfirm(null)}
        loading={actionBusy}
        variant={confirm?.kind === 'block' ? 'danger' : 'success'}
        title={confirm?.kind === 'block' ? 'Block student login?' : 'Unblock student login?'}
        message={
          confirm?.kind === 'block'
            ? `${confirm?.student?.full_name} will no longer be able to sign in. Their records stay intact and wardens can keep updating them.`
            : `${confirm?.student?.full_name} will be able to sign in again.`
        }
        confirmLabel={confirm?.kind === 'block' ? 'Block student' : 'Unblock student'}
        onConfirm={() =>
          runAction(
            () =>
              confirm.kind === 'block'
                ? studentService.block(confirm.student.id, 'Blocked by administrator')
                : studentService.unblock(confirm.student.id),
            confirm.kind === 'block' ? 'Student login blocked.' : 'Student login restored.',
          )
        }
      />

      {/* Archive (soft delete) */}
      <ConfirmDialog
        open={confirm?.kind === 'archive'}
        onClose={() => setConfirm(null)}
        loading={actionBusy}
        title="Remove student?"
        message={`${confirm?.student?.full_name} will be archived: their bed is released and their login is disabled. Attendance, health and progress history is preserved for accountability and can be restored.`}
        confirmLabel="Remove student"
        requireTyped="DELETE"
        onConfirm={() =>
          runAction(
            () => studentService.archive(confirm.student.id, 'Removed by administrator'),
            'Student archived. Records preserved.',
          )
        }
      />

      <p className="muted mt-4">
        {formatDate(new Date())} · Student records are official data. Every change here is written to
        the audit log.
      </p>
    </>
  )
}
