import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Activity,
  ArrowLeft,
  Ban,
  BedDouble,
  CalendarCheck,
  Camera,
  CheckCircle2,
  FileText,
  GraduationCap,
  HeartPulse,
  KeyRound,
  Link2,
  Pencil,
  RotateCcw,
  Save,
  School,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Unlink,
  Upload,
  User,
  Users,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
  ConfirmDialog,
  DataState,
  DateStepper,
  EmptyState,
  FormErrors,
  ImagePicker,
  InfoList,
  Modal,
  MonthPicker,
  Pagination,
  ProgressBar,
  SelectField,
  Section,
  SkeletonRows,
  StatusBadge,
  Tabs,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { AttendanceCalendar, AttendanceSummaryGrid } from '../../components/attendance/AttendanceCalendar'
import { ActivityTimeline, StatusTimeline } from '../../components/dashboard/ActivityTimeline'
import {
  AcademicTrendChart,
  MonthlyAttendanceChart,
  SubjectChart,
} from '../../components/dashboard/Charts'
import { HealthCard, HealthHistoryItem } from '../../components/dashboard/HealthCard'
import { StudentForm } from '../../components/students/StudentForm'
import { useApi, useMonthSelection, usePagination } from '../../hooks'
import {
  activityService,
  attendanceService,
  healthService,
  parentService,
  progressService,
  roomService,
  schoolService,
  studentService,
} from '../../services'
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatTime,
  humanize,
  shiftDate,
  todayISO,
} from '../../utils/format'
import { STUDENT_STATUS, optionsFrom } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'parents', label: 'Parents', icon: Users },
  { id: 'hostel', label: 'Hostel', icon: BedDouble },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'health', label: 'Health', icon: HeartPulse },
  { id: 'school', label: 'School', icon: School },
  { id: 'activities', label: 'Activities', icon: Activity },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
]

/** Shared mutation runner: toast on both outcomes, then refresh the page data. */
function useAction(refresh) {
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async (fn, message, done) => {
      setBusy(true)
      try {
        await fn()
        toast.success(message)
        done?.()
        await refresh?.()
        return true
      } catch (error) {
        toast.error(error.message)
        return false
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )
  return { busy, run }
}

/* ======================================================== profile tab ==== */

function CreateLoginForm({ studentId, onDone, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { email: '', password: '' } })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await studentService.createAccount(studentId, {
        email: values.email.trim(),
        password: values.password,
      })
      toast.success('Login account created.')
      await onDone()
    } catch (error) {
      toast.error(error.message)
      if (!applyServerErrors(error, setError, ['email', 'password'])) setServerError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={['email', 'password']} />
      <TextField
        label="Login email"
        type="email"
        required
        autoComplete="off"
        hint="The student signs in with this address."
        error={errors.email?.message}
        {...register('email', { required: 'Enter a login email.' })}
      />
      <TextField
        label="Temporary password"
        type="text"
        required
        autoComplete="off"
        hint="At least 8 characters. Ask the student to change it after the first sign-in."
        error={errors.password?.message}
        {...register('password', {
          required: 'Set a temporary password.',
          minLength: { value: 8, message: 'Use at least 8 characters.' },
        })}
      />
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={KeyRound} loading={submitting}>
          Create account
        </Button>
      </div>
    </form>
  )
}

function ProfileTab({ student, refresh }) {
  const { busy, run } = useAction(refresh)
  const [loginOpen, setLoginOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const account = student.account

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Section title="Personal information" icon={User}>
          <InfoList
            items={[
              { label: 'Full name', value: student.full_name },
              { label: 'Student ID', value: student.student_code },
              { label: 'Date of birth', value: student.date_of_birth ? formatDate(student.date_of_birth) : null },
              { label: 'Age', value: student.age ? `${student.age} years` : null },
              { label: 'Gender', value: student.gender ? humanize(student.gender) : null },
              { label: 'Blood group', value: student.blood_group },
              { label: 'Class', value: [student.student_class, student.section].filter(Boolean).join(' · ') },
              { label: 'School', value: student.school_name },
              { label: 'Phone', value: student.phone },
              { label: 'Email', value: student.email },
            ]}
          />
        </Section>

        <Section title="Emergency contact" icon={HeartPulse}>
          <InfoList
            columns={3}
            items={[
              { label: 'Contact name', value: student.emergency_contact?.name },
              { label: 'Contact phone', value: student.emergency_contact?.phone },
              { label: 'Relation', value: student.emergency_contact?.relation },
            ]}
          />
        </Section>

        <Section title="Admission & record" icon={FileText}>
          <InfoList
            items={[
              { label: 'Admission date', value: student.admission_date ? formatDate(student.admission_date) : null },
              { label: 'Record created', value: formatDateTime(student.created_at) },
              { label: 'Last updated', value: formatDateTime(student.updated_at) },
              {
                label: 'Verified at',
                value: student.verified_at ? formatDateTime(student.verified_at) : null,
              },
              {
                label: 'Status updated',
                value: student.status_updated_at ? formatDateTime(student.status_updated_at) : null,
              },
              {
                label: 'Archived at',
                value: student.archived_at ? formatDateTime(student.archived_at) : null,
              },
            ]}
          />
        </Section>

        <Section title="Internal notes" subtitle="Visible to administrators only" icon={FileText}>
          {student.notes ? (
            <p className="text-sm whitespace-pre-line text-slate-700">{student.notes}</p>
          ) : (
            <p className="muted">No notes recorded for this student.</p>
          )}
        </Section>
      </div>

      <Card className="h-fit">
        <CardHeader title="Login account" subtitle="Optional student sign-in" icon={KeyRound} />
        <CardBody className="space-y-4">
          {account ? (
            <>
              <InfoList
                columns={1}
                items={[
                  { label: 'Email', value: account.email },
                  { label: 'Username', value: account.username },
                  {
                    label: 'Account status',
                    value: <StatusBadge kind="account" value={account.account_status} />,
                  },
                ]}
              />
              <p className="hint">
                Students can view their own records and confirm activities. They can never edit
                official records.
              </p>
              <Button variant="danger" icon={Trash2} onClick={() => setRevokeOpen(true)}>
                Remove login
              </Button>
            </>
          ) : (
            <>
              <p className="muted">
                This student has no login account. Create one only if the student owns a phone.
              </p>
              <Button icon={KeyRound} onClick={() => setLoginOpen(true)}>
                Create login account
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        title="Create a login account"
        description={`${student.full_name} will be able to sign in and view their own records.`}
      >
        <CreateLoginForm
          studentId={student.id}
          onDone={async () => {
            setLoginOpen(false)
            await refresh()
          }}
          onCancel={() => setLoginOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        loading={busy}
        title="Remove this login account?"
        message={`${student.full_name} will no longer be able to sign in. All hostel records are preserved and a new login can be created later.`}
        confirmLabel="Remove login"
        onConfirm={() =>
          run(() => studentService.revokeAccount(student.id), 'Login account removed.', () =>
            setRevokeOpen(false),
          )
        }
      />
    </div>
  )
}

/* ======================================================== parents tab ==== */

function LinkParentForm({ studentId, linkedIds, onDone, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fetcher = useCallback(() => parentService.lookup({ verification_status: 'VERIFIED' }), [])
  const { data: parents, loading, error, reload } = useApi(fetcher)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { parent_id: '', relationship_type: '', is_primary: false } })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await studentService.linkParent(studentId, {
        parent_id: Number(values.parent_id),
        relationship_type: values.relationship_type?.trim() || null,
        is_primary: Boolean(values.is_primary),
      })
      toast.success('Parent linked to this student.')
      await onDone()
    } catch (err) {
      toast.error(err.message)
      if (!applyServerErrors(err, setError, ['parent_id', 'relationship_type', 'is_primary'])) {
        setServerError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const available = (parents || []).filter((parent) => !linkedIds.includes(parent.id))

  return (
    <DataState
      loading={loading}
      error={error}
      data={available}
      onRetry={reload}
      loadingLabel="Loading verified parents…"
      emptyIcon={Users}
      emptyTitle="No verified parents available"
      emptyMessage="Every verified parent is already linked to this student. Verify a parent registration first."
      emptyAction={
        <Link to="/admin/parents?verification_status=PENDING" className="btn-secondary">
          Review pending parents
        </Link>
      }
    >
      {(rows) => (
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <FormErrors error={serverError} ignoreFields={['parent_id', 'relationship_type', 'is_primary']} />
          <SelectField
            label="Verified parent"
            required
            placeholder="Select a parent"
            options={rows.map((parent) => ({
              value: parent.id,
              label: `${parent.full_name}${parent.phone ? ` · ${parent.phone}` : ''}`,
            }))}
            hint="Only verified parents can be linked to a student."
            error={errors.parent_id?.message}
            {...register('parent_id', { required: 'Choose a parent to link.' })}
          />
          <TextField
            label="Relationship"
            placeholder="Father, Mother, Guardian…"
            error={errors.relationship_type?.message}
            {...register('relationship_type')}
          />
          <CheckboxField
            label="Set as the primary guardian"
            hint="The primary guardian is contacted first for alerts."
            {...register('is_primary')}
          />
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" icon={Link2} loading={submitting}>
              Link parent
            </Button>
          </div>
        </form>
      )}
    </DataState>
  )
}

function ParentsTab({ student, refresh }) {
  const { busy, run } = useAction(refresh)
  const [linkOpen, setLinkOpen] = useState(false)
  const [unlink, setUnlink] = useState(null)
  const parents = student.parents || []

  return (
    <Card>
      <CardHeader
        title="Linked parents"
        subtitle={`${parents.length} parent${parents.length === 1 ? '' : 's'} linked to ${student.full_name}`}
        icon={Users}
        action={
          <Button icon={Link2} size="sm" onClick={() => setLinkOpen(true)}>
            Link a parent
          </Button>
        }
      />

      {parents.length === 0 ? (
        <CardBody>
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            role="alert"
          >
            <p className="font-semibold">No parent is linked to this student.</p>
            <p className="mt-0.5">
              Without a linked parent nobody receives attendance, health or emergency updates for{' '}
              {student.full_name}. Link a verified parent to enable notifications.
            </p>
          </div>
        </CardBody>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Parent name</th>
                <th scope="col">Phone</th>
                <th scope="col">Email</th>
                <th scope="col">Relationship</th>
                <th scope="col">Primary</th>
                <th scope="col">Verification</th>
                <th scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {parents.map((parent) => (
                <tr key={parent.student_parent_id || parent.parent_id}>
                  <td>
                    <Link
                      to={`/admin/parents/${parent.parent_id}`}
                      className="font-semibold text-slate-900 hover:text-brand-700"
                    >
                      {parent.full_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{parent.phone || '—'}</td>
                  <td className="max-w-48 truncate">{parent.email || '—'}</td>
                  <td className="whitespace-nowrap">{parent.relationship_type || 'Guardian'}</td>
                  <td>
                    {parent.is_primary ? (
                      <span className="badge-info">Primary</span>
                    ) : (
                      <span className="badge-neutral">Secondary</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge kind="verification" value={parent.verification_status} />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/admin/parents/${parent.parent_id}`}
                        className="btn-secondary btn-sm"
                        aria-label={`View ${parent.full_name}`}
                      >
                        View
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Unlink}
                        onClick={() => setUnlink(parent)}
                        aria-label={`Unlink ${parent.full_name}`}
                      >
                        Unlink
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Link a parent"
        description={`Give a verified parent access to ${student.full_name}'s records.`}
      >
        <LinkParentForm
          studentId={student.id}
          linkedIds={parents.map((parent) => parent.parent_id)}
          onDone={async () => {
            setLinkOpen(false)
            await refresh()
          }}
          onCancel={() => setLinkOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(unlink)}
        onClose={() => setUnlink(null)}
        loading={busy}
        title="Unlink this parent?"
        message={`${unlink?.full_name} will lose access to ${student.full_name}'s records and will stop receiving updates. The parent account itself is not deleted.`}
        confirmLabel="Unlink parent"
        onConfirm={() =>
          run(
            () => studentService.unlinkParent(student.id, unlink.parent_id),
            'Parent unlinked.',
            () => setUnlink(null),
          )
        }
      />
    </Card>
  )
}

/* ========================================================= hostel tab ==== */

function AssignBedForm({ studentId, onDone, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fetcher = useCallback(() => roomService.availableBeds(), [])
  const { data: beds, loading, error, reload } = useApi(fetcher)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { bed_id: '' } })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await studentService.assignBed(studentId, Number(values.bed_id))
      toast.success('Bed assigned.')
      await onDone()
    } catch (err) {
      toast.error(err.message)
      if (!applyServerErrors(err, setError, ['bed_id'])) setServerError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DataState
      loading={loading}
      error={error}
      data={beds}
      onRetry={reload}
      loadingLabel="Loading available beds…"
      emptyIcon={BedDouble}
      emptyTitle="No free beds"
      emptyMessage="Every bed is currently occupied. Add a room or release a bed first."
      emptyAction={
        <Link to="/admin/rooms" className="btn-secondary">
          Manage rooms
        </Link>
      }
    >
      {(rows) => (
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <FormErrors error={serverError} ignoreFields={['bed_id']} />
          <SelectField
            label="Available bed"
            required
            placeholder="Select a bed"
            options={rows.map((bed) => ({
              value: bed.id,
              label: `${bed.room?.label || `Room ${bed.room?.room_number || ''}`} · Bed ${bed.bed_number}`,
            }))}
            error={errors.bed_id?.message}
            {...register('bed_id', { required: 'Choose a bed.' })}
          />
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" icon={BedDouble} loading={submitting}>
              Assign bed
            </Button>
          </div>
        </form>
      )}
    </DataState>
  )
}

function HostelTab({ student, refresh }) {
  const { busy, run } = useAction(refresh)
  const [assignOpen, setAssignOpen] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const hostel = student.hostel || {}
  const hasBed = Boolean(hostel.bed_id)

  return (
    <Card>
      <CardHeader
        title="Hostel allocation"
        subtitle={hasBed ? hostel.room_label || 'Current bed' : 'No bed assigned'}
        icon={BedDouble}
        action={
          <>
            <Button size="sm" icon={BedDouble} onClick={() => setAssignOpen(true)}>
              {hasBed ? 'Change bed' : 'Assign bed'}
            </Button>
            {hasBed && (
              <Button variant="secondary" size="sm" onClick={() => setReleaseOpen(true)}>
                Release bed
              </Button>
            )}
          </>
        }
      />
      <CardBody className="space-y-4">
        {!hasBed && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            role="status"
          >
            {student.full_name} has no bed assigned yet.
          </div>
        )}
        <InfoList
          columns={3}
          items={[
            { label: 'Building', value: hostel.building },
            { label: 'Floor', value: hostel.floor === null || hostel.floor === undefined ? null : `Floor ${hostel.floor}` },
            { label: 'Room number', value: hostel.room_number || student.room_number },
            { label: 'Bed number', value: hostel.bed_number || student.bed_number },
            { label: 'Room label', value: hostel.room_label },
            {
              label: 'Room page',
              value: hostel.room_id ? (
                <Link to="/admin/rooms" className="font-medium text-brand-700 hover:underline">
                  Open room manager
                </Link>
              ) : null,
            },
          ]}
        />
      </CardBody>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={hasBed ? 'Change bed' : 'Assign a bed'}
        description={`Pick a free bed for ${student.full_name}. The previous bed is released automatically.`}
      >
        <AssignBedForm
          studentId={student.id}
          onDone={async () => {
            setAssignOpen(false)
            await refresh()
          }}
          onCancel={() => setAssignOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        loading={busy}
        variant="danger"
        title="Release this bed?"
        message={`${hostel.room_label || 'The bed'} becomes available for another student. ${student.full_name} will show as unassigned until you allocate a new bed.`}
        confirmLabel="Release bed"
        onConfirm={() =>
          run(() => studentService.assignBed(student.id, null), 'Bed released.', () =>
            setReleaseOpen(false),
          )
        }
      />
    </Card>
  )
}

/* ===================================================== attendance tab ==== */

function AttendanceTab({ studentId, trend }) {
  const { year, month, goPrevious, goNext } = useMonthSelection()
  const fetcher = useCallback(
    () => attendanceService.calendar(studentId, { year, month }),
    [studentId, year, month],
  )
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Monthly attendance"
          subtitle="Official record — only administrators can change it"
          icon={CalendarCheck}
          action={<MonthPicker year={year} month={month} onPrevious={goPrevious} onNext={goNext} />}
        />
        <CardBody>
          <DataState
            loading={loading}
            error={error}
            data={data}
            onRetry={reload}
            isEmpty={false}
            loadingLabel="Loading attendance…"
          >
            {(calendar) => (
              <div className="space-y-4">
                <AttendanceSummaryGrid summary={calendar.summary} />
                <p className="muted">
                  {formatPercent(calendar.summary?.attendance_percentage)} attendance across{' '}
                  {calendar.summary?.recorded_days || 0} recorded day
                  {calendar.summary?.recorded_days === 1 ? '' : 's'}.
                </p>
                <AttendanceCalendar calendar={calendar} />
              </div>
            )}
          </DataState>
        </CardBody>
      </Card>

      <Section title="Attendance trend" subtitle="Last 6 months" icon={TrendingUp}>
        <MonthlyAttendanceChart data={trend} />
      </Section>
    </div>
  )
}

/* ========================================================= health tab ==== */

function HealthTab({ studentId, fallbackHealth }) {
  const fetcher = useCallback(() => healthService.forStudent(studentId), [studentId])
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <div className="space-y-4">
      <Section title="Current health status" icon={HeartPulse}>
        <HealthCard health={data?.current || fallbackHealth} />
      </Section>

      <Card>
        <CardHeader title="Health history" subtitle="Every recorded health entry" icon={HeartPulse} />
        <CardBody>
          <DataState
            loading={loading}
            error={error}
            data={data?.timeline}
            onRetry={reload}
            loadingLabel="Loading health history…"
            emptyIcon={HeartPulse}
            emptyTitle="No health records"
            emptyMessage="No health entries have been recorded for this student yet."
          >
            {(rows) => (
              <ul>
                {rows.map((record) => (
                  <HealthHistoryItem key={record.id} record={record} />
                ))}
              </ul>
            )}
          </DataState>
        </CardBody>
      </Card>
    </div>
  )
}

/* ========================================================= school tab ==== */

function SchoolTab({ studentId }) {
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [range, setRange] = useState(() => ({
    start_date: shiftDate(todayISO(), -30),
    end_date: todayISO(),
  }))

  const fetcher = useCallback(
    () =>
      schoolService.forStudent(studentId, {
        start_date: range.start_date,
        end_date: range.end_date,
        page,
        per_page: perPage,
      }),
    [studentId, range.start_date, range.end_date, page, perPage],
  )
  const { data, meta, loading, error, reload } = useApi(fetcher)

  const setBound = (key, value) => {
    setRange((current) => ({ ...current, [key]: value }))
    reset()
  }

  return (
    <Card>
      <CardHeader
        title="School attendance"
        subtitle="Departures, returns and leave"
        icon={School}
        action={
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">
              <span className="mb-1 block">From</span>
              <input
                type="date"
                className="input w-auto py-1.5 text-sm"
                value={range.start_date}
                max={range.end_date}
                onChange={(event) => setBound('start_date', event.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              <span className="mb-1 block">To</span>
              <input
                type="date"
                className="input w-auto py-1.5 text-sm"
                value={range.end_date}
                min={range.start_date}
                max={todayISO()}
                onChange={(event) => setBound('end_date', event.target.value)}
              />
            </label>
          </div>
        }
      />
      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        skeleton={
          <div className="card-pad">
            <SkeletonRows rows={5} />
          </div>
        }
        loadingLabel="Loading school records…"
        emptyIcon={School}
        emptyTitle="No school records"
        emptyMessage="Nothing was recorded between the selected dates."
      >
        {(rows) => (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Status</th>
                    <th scope="col">Departure</th>
                    <th scope="col">Expected return</th>
                    <th scope="col">Actual return</th>
                    <th scope="col">Remarks</th>
                    <th scope="col">Recorded by</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record) => (
                    <tr key={record.id || record.date}>
                      <td className="whitespace-nowrap font-medium text-slate-900">
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
                      <td className="max-w-56 truncate">{record.remarks || '—'}</td>
                      <td className="whitespace-nowrap">{record.recorded_by || 'System'}</td>
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
  )
}

/* ===================================================== activities tab ==== */

function ActivitiesTab({ studentId, statusHistory }) {
  const [date, setDate] = useState(todayISO())
  const fetcher = useCallback(
    () => activityService.timeline(studentId, { date }),
    [studentId, date],
  )
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Daily routine"
          subtitle={data ? `${data.completed} of ${data.total} activities completed` : 'Timeline'}
          icon={Activity}
          action={<DateStepper value={date} onChange={setDate} max={todayISO()} />}
        />
        <CardBody>
          <DataState
            loading={loading}
            error={error}
            data={data}
            onRetry={reload}
            isEmpty={(value) => !value?.items?.length}
            loadingLabel="Loading timeline…"
            emptyIcon={Activity}
            emptyTitle="No activities for this day"
            emptyMessage="No routine has been generated or recorded for the selected date."
          >
            {(timeline) => <ActivityTimeline items={timeline.items} />}
          </DataState>
        </CardBody>
      </Card>

      <Section
        title="Movement history"
        subtitle="Consent-based status changes"
        icon={ShieldCheck}
        className="h-fit"
      >
        <StatusTimeline items={statusHistory} />
      </Section>
    </div>
  )
}

/* ======================================================= progress tab ==== */

function AcademicResults({ studentId }) {
  const { page, perPage, setPage, setPerPage, reset } = usePagination(10)
  const fetcher = useCallback(
    () => progressService.academic({ student_id: studentId, page, per_page: perPage }),
    [studentId, page, perPage],
  )
  const { data, meta, loading, error, reload } = useApi(fetcher)

  return (
    <Card>
      <CardHeader title="Academic results" subtitle="Exam-by-exam record" icon={GraduationCap} />
      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        skeleton={
          <div className="card-pad">
            <SkeletonRows rows={4} />
          </div>
        }
        loadingLabel="Loading results…"
        emptyIcon={GraduationCap}
        emptyTitle="No exam results"
        emptyMessage="No academic results have been recorded for this student yet."
      >
        {(rows) => (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Exam</th>
                    <th scope="col">Subject</th>
                    <th scope="col">Marks</th>
                    <th scope="col">Percentage</th>
                    <th scope="col">Grade</th>
                    <th scope="col">Exam date</th>
                    <th scope="col">Teacher remark</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record) => (
                    <tr key={record.id}>
                      <td className="font-medium text-slate-900">
                        {record.exam_name}
                        {record.exam_type && (
                          <span className="block text-xs text-slate-400">{record.exam_type}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{record.subject}</td>
                      <td className="whitespace-nowrap tabular-nums">
                        {record.marks_obtained} / {record.max_marks}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">
                        {formatPercent(record.percentage, 1)}
                      </td>
                      <td>
                        <span className="badge-neutral">{record.grade || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(record.exam_date)}</td>
                      <td className="max-w-56 truncate">{record.teacher_remark || '—'}</td>
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
  )
}

function ProgressTab({ studentId }) {
  const fetcher = useCallback(() => progressService.overview(studentId), [studentId])
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <div className="space-y-4">
      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        loadingLabel="Loading progress…"
      >
        {(overview) => {
          const categories = overview.categories || {}
          const items = categories.items || []
          return (
            <div className="space-y-4">
              <Card>
                <CardHeader
                  title="Progress scores"
                  subtitle={
                    categories.period
                      ? `Period ${categories.period.year}-${String(categories.period.month).padStart(2, '0')} · overall ${formatPercent(categories.overall)}`
                      : 'Category scores'
                  }
                  icon={TrendingUp}
                />
                <CardBody>
                  {items.length ? (
                    <ul className="space-y-4">
                      {items.map((item) => (
                        <li key={item.category_id}>
                          <ProgressBar
                            label={item.category}
                            value={item.score ?? 0}
                            showValue={item.score !== null && item.score !== undefined}
                          />
                          {item.description && <p className="hint">{item.description}</p>}
                          {item.remarks && (
                            <p className="mt-1 text-xs text-slate-600">{item.remarks}</p>
                          )}
                          {(item.score === null || item.score === undefined) && (
                            <p className="hint">Not scored for this period yet.</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      icon={TrendingUp}
                      title="No progress scores"
                      message="No category scores have been recorded for this student yet."
                    />
                  )}
                </CardBody>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Subject averages" subtitle="Across all recorded exams" icon={GraduationCap}>
                  <SubjectChart data={overview.subjects} />
                </Section>
                <Section title="Academic trend" subtitle="Percentage per exam" icon={TrendingUp}>
                  <AcademicTrendChart data={overview.academic_trend} />
                </Section>
              </div>

              <Section title="Attendance context" subtitle="Lifetime attendance record" icon={CalendarCheck}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    { label: 'Attendance', value: formatPercent(overview.attendance?.percentage) },
                    { label: 'Present', value: overview.attendance?.PRESENT ?? 0 },
                    { label: 'Absent', value: overview.attendance?.ABSENT ?? 0 },
                    { label: 'Leave', value: overview.attendance?.LEAVE ?? 0 },
                    { label: 'Late', value: overview.attendance?.LATE ?? 0 },
                  ].map((cell) => (
                    <div key={cell.label} className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{cell.value}</p>
                      <p className="text-[11px] font-semibold text-slate-500">{cell.label}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )
        }}
      </DataState>

      <AcademicResults studentId={studentId} />
    </div>
  )
}

/* ===================================================== status + photo ==== */

function StatusForm({ studentId, current, onDone, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { status: current || 'IN_HOSTEL', remarks: '' } })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await studentService.changeStatus(studentId, {
        status: values.status,
        remarks: values.remarks?.trim() || null,
      })
      toast.success('Activity status updated.')
      await onDone()
    } catch (error) {
      toast.error(error.message)
      if (!applyServerErrors(error, setError, ['status', 'remarks'])) setServerError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={['status', 'remarks']} />
      <SelectField
        label="Where is the student now?"
        required
        options={optionsFrom(STUDENT_STATUS)}
        error={errors.status?.message}
        {...register('status', { required: 'Choose a status.' })}
      />
      <TextArea
        label="Remarks"
        rows={3}
        hint="Recorded in the movement history and visible to the parent."
        error={errors.remarks?.message}
        {...register('remarks')}
      />
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          Update status
        </Button>
      </div>
    </form>
  )
}

function PhotoForm({ studentId, currentPhoto, onDone, onCancel }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const upload = async () => {
    if (!file) {
      toast.error('Choose an image first.')
      return
    }
    setUploading(true)
    try {
      await studentService.uploadPhoto(studentId, file)
      toast.success('Photo updated.')
      await onDone()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {currentPhoto && (
        <figure className="flex items-center gap-3">
          <img
            src={mediaUrl(currentPhoto)}
            alt="Current profile photo"
            className="h-16 w-16 rounded-xl object-cover"
          />
          <figcaption className="muted">Current photo</figcaption>
        </figure>
      )}
      <ImagePicker onChange={setFile} label="Choose a new photo" />
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>
        <Button icon={Upload} loading={uploading} disabled={!file} onClick={upload}>
          Upload photo
        </Button>
      </div>
    </div>
  )
}

/* ============================================================== page ===== */

export default function AdminStudentProfile() {
  const { id } = useParams()
  const [tab, setTab] = useState('profile')
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const fetcher = useCallback(() => studentService.overview(id), [id])
  const { data, loading, error, reload, refresh } = useApi(fetcher)
  const { busy, run } = useAction(refresh)

  const handleEdit = async (payload) => {
    setSubmitting(true)
    try {
      await studentService.update(id, payload)
      toast.success('Student updated.')
      setEditOpen(false)
      await refresh()
      return { ok: true }
    } catch (err) {
      toast.error(err.message)
      return { error: err }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Link
        to="/admin/students"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to students
      </Link>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={(value) => !value?.student}
        loadingLabel="Loading student profile…"
        emptyIcon={GraduationCap}
        emptyTitle="Student not found"
        emptyMessage="This student record does not exist or has been removed."
        emptyAction={
          <Link to="/admin/students" className="btn-secondary">
            Back to students
          </Link>
        }
      >
        {(overview) => {
          const student = overview.student
          const blocked = student.account?.account_status === 'BLOCKED'
          return (
            <>
              {/* ------------------------------------------------ header */}
              <Card className="mb-4">
                <div className="card-pad flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="relative shrink-0">
                    <Avatar src={student.profile_photo} name={student.full_name} size="xl" />
                    <button
                      type="button"
                      onClick={() => setPhotoOpen(true)}
                      className="absolute -right-1 -bottom-1 rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:text-brand-700"
                      aria-label="Change profile photo"
                      title="Change photo"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                      {student.full_name}
                    </h1>
                    <p className="muted mt-0.5">
                      {student.student_code}
                      {student.student_class ? ` · ${student.student_class}` : ''}
                      {student.section ? ` ${student.section}` : ''}
                      {student.school_name ? ` · ${student.school_name}` : ''}
                    </p>
                    <p className="muted">
                      {student.hostel?.room_label ||
                        (student.room_number
                          ? `Room ${student.room_number}${student.bed_number ? ` · Bed ${student.bed_number}` : ''}`
                          : 'No bed assigned')}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <StatusBadge kind="verification" value={student.verification_status} />
                      <StatusBadge kind="studentStatus" value={student.current_status} />
                      <StatusBadge kind="health" value={overview.health?.status} />
                      {!student.is_active && <span className="badge-neutral">Archived</span>}
                      {blocked && <span className="badge-danger">Login blocked</span>}
                      {!student.has_login && <span className="badge-neutral">No login</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    <Button size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
                      Edit
                    </Button>
                    {student.verification_status !== 'VERIFIED' && (
                      <Button
                        size="sm"
                        variant="success"
                        icon={CheckCircle2}
                        loading={busy}
                        onClick={() =>
                          run(() => studentService.verify(id), `${student.full_name} verified.`)
                        }
                      >
                        Verify
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Activity}
                      onClick={() => setStatusOpen(true)}
                    >
                      Change status
                    </Button>
                    {student.has_login && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Ban}
                        onClick={() => setConfirm({ kind: blocked ? 'unblock' : 'block' })}
                      >
                        {blocked ? 'Unblock login' : 'Block login'}
                      </Button>
                    )}
                    {student.is_active ? (
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => setConfirm({ kind: 'archive' })}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="success"
                        icon={RotateCcw}
                        loading={busy}
                        onClick={() =>
                          run(() => studentService.restore(id), `${student.full_name} restored.`)
                        }
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* -------------------------------------------------- tabs */}
              <Tabs
                tabs={TABS.map((entry) =>
                  entry.id === 'parents'
                    ? { ...entry, count: student.parents?.length || 0 }
                    : entry,
                )}
                active={tab}
                onChange={setTab}
                className="mb-4"
              />

              {tab === 'profile' && <ProfileTab student={student} refresh={refresh} />}
              {tab === 'parents' && <ParentsTab student={student} refresh={refresh} />}
              {tab === 'hostel' && <HostelTab student={student} refresh={refresh} />}
              {tab === 'attendance' && (
                <AttendanceTab studentId={student.id} trend={overview.attendance_trend} />
              )}
              {tab === 'health' && (
                <HealthTab studentId={student.id} fallbackHealth={overview.health} />
              )}
              {tab === 'school' && <SchoolTab studentId={student.id} />}
              {tab === 'activities' && (
                <ActivitiesTab studentId={student.id} statusHistory={overview.status_history} />
              )}
              {tab === 'progress' && <ProgressTab studentId={student.id} />}

              {/* ------------------------------------------------ modals */}
              <Modal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                title={`Edit ${student.full_name}`}
                description="Room, parent and login changes are handled from their own tabs."
                size="lg"
              >
                <StudentForm
                  student={student}
                  submitting={submitting}
                  onSubmit={handleEdit}
                  onCancel={() => setEditOpen(false)}
                />
              </Modal>

              <Modal
                open={statusOpen}
                onClose={() => setStatusOpen(false)}
                title="Change activity status"
                description="Records where the student is right now and notifies the linked parents."
              >
                <StatusForm
                  studentId={student.id}
                  current={student.current_status}
                  onDone={async () => {
                    setStatusOpen(false)
                    await refresh()
                  }}
                  onCancel={() => setStatusOpen(false)}
                />
              </Modal>

              <Modal
                open={photoOpen}
                onClose={() => setPhotoOpen(false)}
                title="Update profile photo"
                description="The photo appears on the student list, parent portal and reports."
              >
                <PhotoForm
                  studentId={student.id}
                  currentPhoto={student.profile_photo}
                  onDone={async () => {
                    setPhotoOpen(false)
                    await refresh()
                  }}
                  onCancel={() => setPhotoOpen(false)}
                />
              </Modal>

              <ConfirmDialog
                open={confirm?.kind === 'block' || confirm?.kind === 'unblock'}
                onClose={() => setConfirm(null)}
                loading={busy}
                variant={confirm?.kind === 'block' ? 'danger' : 'success'}
                title={confirm?.kind === 'block' ? 'Block student login?' : 'Unblock student login?'}
                message={
                  confirm?.kind === 'block'
                    ? `${student.full_name} will no longer be able to sign in. Wardens can keep updating their records.`
                    : `${student.full_name} will be able to sign in again.`
                }
                confirmLabel={confirm?.kind === 'block' ? 'Block login' : 'Unblock login'}
                onConfirm={() =>
                  run(
                    () =>
                      confirm.kind === 'block'
                        ? studentService.block(id, 'Blocked by administrator')
                        : studentService.unblock(id),
                    confirm.kind === 'block' ? 'Student login blocked.' : 'Student login restored.',
                    () => setConfirm(null),
                  )
                }
              />

              <ConfirmDialog
                open={confirm?.kind === 'archive'}
                onClose={() => setConfirm(null)}
                loading={busy}
                title="Remove student?"
                message={`${student.full_name} will be archived: their bed is released and their login is disabled. Attendance, health and progress history is preserved and can be restored.`}
                confirmLabel="Remove student"
                requireTyped="DELETE"
                onConfirm={() =>
                  run(
                    () => studentService.archive(id, 'Removed by administrator'),
                    'Student archived. Records preserved.',
                    () => setConfirm(null),
                  )
                }
              />
            </>
          )
        }}
      </DataState>
    </>
  )
}
