import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Activity,
  CheckCheck,
  CircleDashed,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
  ConfirmDialog,
  DataState,
  DateStepper,
  FormErrors,
  Modal,
  PageHeader,
  ProgressBar,
  Section,
  SelectField,
  SkeletonRows,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { ActivityTimeline } from '../../components/dashboard/ActivityTimeline'
import { StatCard } from '../../components/dashboard/StatCard'
import { useApi } from '../../hooks'
import { activityService, studentService } from '../../services'
import { formatDate, formatTime, humanize, todayISO } from '../../utils/format'
import { ACTIVITY_TYPES, optionsFrom } from '../../utils/labels'

const TYPE_OPTIONS = optionsFrom(ACTIVITY_TYPES)

const CREATE_FIELDS = [
  'student_id',
  'activity_type',
  'title',
  'scheduled_time',
  'activity_time',
  'is_completed',
  'remarks',
]

const EDIT_FIELDS = ['title', 'scheduled_time', 'activity_time', 'is_completed', 'remarks']

/** "07:00:00" -> "07:00" for <input type="time">. */
const toTimeInput = (value) => (value ? String(value).slice(0, 5) : '')

function ActivityForm({ activity, students, date, submitting, onSubmit, onCancel }) {
  const isEdit = Boolean(activity)
  const fields = isEdit ? EDIT_FIELDS : CREATE_FIELDS
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      student_id: activity?.student_id || '',
      activity_type: activity?.activity_type || 'STUDY',
      title: activity?.title || '',
      scheduled_time: toTimeInput(activity?.scheduled_time),
      activity_time: toTimeInput(activity?.activity_time),
      is_completed: Boolean(activity?.is_completed),
      remarks: activity?.remarks || '',
    },
  })

  const submit = async (values) => {
    setServerError(null)
    const shared = {
      title: values.title?.trim() || null,
      scheduled_time: values.scheduled_time || null,
      activity_time: values.activity_time || null,
      is_completed: Boolean(values.is_completed),
      remarks: values.remarks?.trim() || null,
    }
    const payload = isEdit
      ? shared
      : {
          ...shared,
          student_id: Number(values.student_id),
          activity_type: values.activity_type,
          date,
        }
    const result = await onSubmit(payload)
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, fields)
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={fields} />

      {!isEdit && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Student"
            required
            placeholder={students.length ? 'Select a student' : 'No active students found'}
            options={students.map((student) => ({
              value: student.id,
              label: `${student.full_name} · ${student.student_code}`,
            }))}
            error={errors.student_id?.message}
            {...register('student_id', { required: 'Choose the student.' })}
          />
          <SelectField
            label="Activity type"
            required
            options={TYPE_OPTIONS}
            error={errors.activity_type?.message}
            {...register('activity_type', { required: 'Choose an activity type.' })}
          />
        </div>
      )}

      <TextField
        label="Title"
        placeholder="Evening study hour"
        hint="Leave blank to use the default name for this activity type."
        error={errors.title?.message}
        {...register('title')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Scheduled time"
          type="time"
          error={errors.scheduled_time?.message}
          {...register('scheduled_time')}
        />
        <TextField
          label="Actual time"
          type="time"
          hint="Filled in automatically when you mark the activity complete."
          error={errors.activity_time?.message}
          {...register('activity_time')}
        />
      </div>

      <CheckboxField label="This activity is already completed" {...register('is_completed')} />

      <TextArea
        label="Remarks"
        rows={2}
        error={errors.remarks?.message}
        {...register('remarks')}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {isEdit ? 'Save changes' : 'Add activity'}
        </Button>
      </div>
    </form>
  )
}

export default function AdminActivities() {
  const [date, setDate] = useState(todayISO())
  const [studentClass, setStudentClass] = useState('')
  const [studentId, setStudentId] = useState('')

  const [routineOpen, setRoutineOpen] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [routineBusy, setRoutineBusy] = useState(false)

  const [bulkType, setBulkType] = useState('STUDY')
  const [bulkIds, setBulkIds] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [itemBusy, setItemBusy] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const optionsFetcher = useCallback(() => studentService.filterOptions(), [])
  const { data: filterOptions } = useApi(optionsFetcher)
  const classOptions = (filterOptions?.classes || []).map((value) => ({ value, label: value }))

  const studentsFetcher = useCallback(
    () =>
      studentService.list({
        per_page: 100,
        ...(studentClass ? { student_class: studentClass } : {}),
      }),
    [studentClass],
  )
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
    reload: reloadStudents,
  } = useApi(studentsFetcher)

  const statsFetcher = useCallback(() => activityService.stats({ date }), [date])
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    reload: reloadStats,
    refresh: refreshStats,
  } = useApi(statsFetcher)

  const timelineFetcher = useCallback(
    () => activityService.timeline(studentId, { date }),
    [studentId, date],
  )
  const {
    data: timeline,
    loading: timelineLoading,
    error: timelineError,
    reload: reloadTimeline,
    refresh: refreshTimeline,
  } = useApi(timelineFetcher, { immediate: Boolean(studentId) })

  const recentFetcher = useCallback(() => activityService.recent(), [])
  const {
    data: recent,
    loading: recentLoading,
    error: recentError,
    reload: reloadRecent,
    refresh: refreshRecent,
  } = useApi(recentFetcher)

  const studentList = students || []
  const selectedStudent =
    studentList.find((student) => String(student.id) === String(studentId)) || null

  const refreshAfterChange = async () => {
    await refreshStats()
    await refreshRecent()
    if (studentId) await refreshTimeline()
  }

  /* ------------------------------------------------------- routine seeding */
  const generateRoutine = async () => {
    setRoutineBusy(true)
    try {
      // student_ids is omitted when no class filter is active, which targets
      // every active student.
      const payload = { date, overwrite }
      if (studentClass) payload.student_ids = studentList.map((student) => student.id)
      const result = await activityService.generateRoutine(payload)
      toast.success(
        `${result.created} routine activities created for ${result.students} student(s) on ${formatDate(
          result.date,
        )}.`,
      )
      setRoutineOpen(false)
      setOverwrite(false)
      await refreshAfterChange()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRoutineBusy(false)
    }
  }

  /* ------------------------------------------------------------- bulk tick */
  const toggleBulkId = (id) => {
    setBulkIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const allSelected = studentList.length > 0 && bulkIds.length === studentList.length

  const runBulkComplete = async () => {
    if (!bulkIds.length) {
      toast.error('Select at least one student.')
      return
    }
    setBulkBusy(true)
    try {
      const result = await activityService.bulkComplete({
        student_ids: bulkIds,
        activity_type: bulkType,
        date,
      })
      toast.success(
        `${result?.updated ?? bulkIds.length} "${humanize(bulkType)}" entries marked complete.`,
      )
      setBulkIds([])
      await refreshAfterChange()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBulkBusy(false)
    }
  }

  /* ----------------------------------------------------------- single item */
  const createActivity = async (payload) => {
    setSubmitting(true)
    try {
      await activityService.create(payload)
      toast.success('Activity added.')
      setCreateOpen(false)
      await refreshAfterChange()
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setSubmitting(false)
    }
  }

  const updateActivity = async (payload) => {
    setSubmitting(true)
    try {
      await activityService.update(editing.id, payload)
      toast.success('Activity updated.')
      setEditing(null)
      await refreshAfterChange()
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setSubmitting(false)
    }
  }

  const completeActivity = async (item) => {
    setItemBusy(item.id)
    try {
      await activityService.complete(item.id)
      toast.success(`${item.title || item.label} marked complete.`)
      await refreshAfterChange()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setItemBusy(null)
    }
  }

  const deleteActivity = async () => {
    setDeleteBusy(true)
    try {
      await activityService.remove(toDelete.id)
      toast.success('Activity deleted.')
      setToDelete(null)
      await refreshAfterChange()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Daily activities"
        subtitle="Seed the hostel routine, tick items off and keep each student's timeline accurate."
        actions={
          <>
            <Button variant="secondary" icon={Sparkles} onClick={() => setRoutineOpen(true)}>
              Generate routine
            </Button>
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              Add activity
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr_1fr] lg:items-end">
          <div>
            <p className="label">Date</p>
            <DateStepper value={date} onChange={setDate} />
          </div>
          <SelectField
            label="Class"
            placeholder="All classes"
            options={classOptions}
            value={studentClass}
            onChange={(event) => {
              setStudentClass(event.target.value)
              setStudentId('')
              setBulkIds([])
            }}
          />
          <SelectField
            label="Student timeline"
            placeholder={studentList.length ? 'Select a student' : 'No students found'}
            options={studentList.map((student) => ({
              value: student.id,
              label: `${student.full_name} · ${student.student_code}`,
            }))}
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          />
        </div>
      </Card>

      <DataState
        loading={statsLoading}
        error={statsError}
        data={stats}
        onRetry={reloadStats}
        loadingLabel="Loading completion stats…"
        isEmpty={false}
      >
        {(data) => (
          <section aria-label="Completion stats" className="mb-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Activities planned" value={data.total} icon={ListChecks} tone="brand" />
              <StatCard label="Completed" value={data.completed} icon={CheckCheck} tone="success" />
              <StatCard label="Pending" value={data.pending} icon={CircleDashed} tone="warning" />
              <StatCard
                label="Completion rate"
                value={`${data.completion_rate}%`}
                icon={Activity}
                tone="info"
                hint={formatDate(data.date)}
              />
            </div>
            <Card className="card-pad mt-3">
              <ProgressBar
                label={`Routine completion on ${formatDate(data.date)}`}
                value={data.completion_rate}
              />
            </Card>
          </section>
        )}
      </DataState>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Bulk tick */}
        <Card>
          <CardHeader
            title="Tick one activity for many students"
            subtitle="Fastest way to record a routine item for a whole group"
            icon={CheckCheck}
          />
          <CardBody className="space-y-4">
            <SelectField
              label="Activity type"
              options={TYPE_OPTIONS}
              value={bulkType}
              onChange={(event) => setBulkType(event.target.value)}
            />

            <DataState
              loading={studentsLoading}
              error={studentsError}
              data={students}
              onRetry={reloadStudents}
              loadingLabel="Loading students…"
              skeleton={<SkeletonRows rows={4} />}
              emptyTitle="No students"
              emptyMessage={
                studentClass
                  ? `No active students are in ${studentClass}.`
                  : 'Add students before recording activities.'
              }
            >
              {(rows) => (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="label mb-0">
                      Students ({bulkIds.length} of {rows.length} selected)
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-9"
                      onClick={() => setBulkIds(allSelected ? [] : rows.map((row) => row.id))}
                    >
                      {allSelected ? 'Clear all' : 'Select all'}
                    </Button>
                  </div>
                  <ul className="scrollbar-thin max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                    {rows.map((student) => (
                      <li key={student.id}>
                        <CheckboxField
                          label={`${student.full_name} · ${student.student_code}`}
                          checked={bulkIds.includes(student.id)}
                          onChange={() => toggleBulkId(student.id)}
                          className="min-h-9 py-1"
                        />
                      </li>
                    ))}
                  </ul>
                  <Button
                    icon={CheckCheck}
                    loading={bulkBusy}
                    disabled={!bulkIds.length}
                    onClick={runBulkComplete}
                  >
                    Mark &quot;{humanize(bulkType)}&quot; complete for {bulkIds.length} student(s)
                  </Button>
                </>
              )}
            </DataState>
          </CardBody>
        </Card>

        {/* Per-student timeline */}
        <Card>
          <CardHeader
            title={
              selectedStudent
                ? `${selectedStudent.full_name} · ${formatDate(date)}`
                : 'Student timeline'
            }
            subtitle={
              timeline && studentId
                ? `${timeline.completed} of ${timeline.total} activities completed`
                : 'Pick a student to see their day'
            }
            icon={Activity}
            action={
              selectedStudent && (
                <Link to={`/admin/students/${selectedStudent.id}`} className="btn-secondary btn-sm">
                  Profile
                </Link>
              )
            }
          />
          <CardBody>
            {!studentId ? (
              <p className="muted py-6 text-center">
                Select a student above to view and edit their routine for {formatDate(date)}.
              </p>
            ) : (
              <DataState
                loading={timelineLoading || (!timeline && !timelineError)}
                error={timelineError}
                data={timeline}
                onRetry={reloadTimeline}
                loadingLabel="Loading the timeline…"
                skeleton={<SkeletonRows rows={5} />}
                isEmpty={(value) => !value?.items?.length}
                emptyIcon={ListChecks}
                emptyTitle="No activities for this day"
                emptyMessage="Generate the routine or add an activity to start this student's timeline."
                emptyAction={
                  <Button variant="secondary" icon={Sparkles} onClick={() => setRoutineOpen(true)}>
                    Generate routine
                  </Button>
                }
              >
                {(data) => (
                  <ActivityTimeline
                    items={data.items}
                    actions={(item) => (
                      <>
                        {!item.is_completed && (
                          <Button
                            size="sm"
                            variant="success"
                            className="min-h-9"
                            loading={itemBusy === item.id}
                            onClick={() => completeActivity(item)}
                          >
                            Mark complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={Pencil}
                          className="min-h-9"
                          onClick={() => setEditing(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="min-h-9"
                          onClick={() => setToDelete(item)}
                          aria-label={`Delete ${item.title || item.label}`}
                        />
                      </>
                    )}
                  />
                )}
              </DataState>
            )}
          </CardBody>
        </Card>
      </div>

      <Section
        title="Recently completed across the hostel"
        subtitle="The latest ticked-off activities"
        className="mt-4"
      >
        <DataState
          loading={recentLoading}
          error={recentError}
          data={recent}
          onRetry={reloadRecent}
          loadingLabel="Loading recent activity…"
          skeleton={<SkeletonRows rows={5} />}
          emptyIcon={Activity}
          emptyTitle="Nothing completed yet"
          emptyMessage="Completed activities across the hostel will appear here."
        >
          {(rows) => (
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <Link
                    to={`/admin/students/${row.student_id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-700"
                  >
                    {row.student?.full_name || `Student #${row.student_id}`}
                    <span className="ml-1.5 text-xs text-slate-400">
                      {row.student?.student_code}
                    </span>
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                    {row.title || row.label}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {formatDate(row.date, { withYear: false })} ·{' '}
                    {row.time_12h || formatTime(row.activity_time || row.scheduled_time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </Section>

      {/* Generate routine */}
      <ConfirmDialog
        open={routineOpen}
        onClose={() => {
          setRoutineOpen(false)
          setOverwrite(false)
        }}
        loading={routineBusy}
        variant="primary"
        title="Generate the daily routine?"
        message={`This creates the 10 default routine entries (wake up, meals, school, study, outdoor activity and lights out) for ${
          studentClass ? `every active student in ${studentClass}` : 'every active student'
        } on ${formatDate(date)}. Existing entries are kept unless you choose to replace them.`}
        confirmLabel="Generate routine"
        onConfirm={generateRoutine}
      >
        <CheckboxField
          label="Replace the entries that already exist for this day"
          hint="Any remarks or completion ticks already recorded for this day will be lost."
          checked={overwrite}
          onChange={(event) => setOverwrite(event.target.checked)}
        />
      </ConfirmDialog>

      {/* Add activity */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add an activity"
        description={`The entry is added to the student's timeline for ${formatDate(date)}.`}
      >
        <ActivityForm
          students={studentList}
          date={date}
          submitting={submitting}
          onSubmit={createActivity}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Edit activity */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.title || editing.label}` : 'Edit activity'}
      >
        {editing && (
          <ActivityForm
            key={editing.id}
            activity={editing}
            students={studentList}
            date={date}
            submitting={submitting}
            onSubmit={updateActivity}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        loading={deleteBusy}
        title="Delete this activity?"
        message={`"${
          toDelete?.title || toDelete?.label || 'This activity'
        }" will be removed from the timeline for ${formatDate(toDelete?.date)}.`}
        confirmLabel="Delete activity"
        onConfirm={deleteActivity}
      />
    </>
  )
}
