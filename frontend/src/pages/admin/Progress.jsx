import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Award,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataState,
  FormErrors,
  Modal,
  PageHeader,
  Pagination,
  ProgressBar,
  Section,
  SelectField,
  SkeletonRows,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import {
  AcademicTrendChart,
  MonthlyAttendanceChart,
  ProgressHistoryChart,
  ProgressRadarChart,
  SubjectChart,
} from '../../components/dashboard/Charts'
import { StatCard } from '../../components/dashboard/StatCard'
import { useApi, usePagination } from '../../hooks'
import { progressService, studentService } from '../../services'
import { formatDate, formatPercent, monthLabel, monthName, todayISO } from '../../utils/format'

const NOW = new Date()
const YEAR_OPTIONS = [0, 1, 2].map((offset) => {
  const year = NOW.getFullYear() - offset
  return { value: year, label: String(year) }
})
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: monthName(index + 1),
}))

const ACADEMIC_FIELDS = [
  'subject',
  'exam_name',
  'exam_type',
  'marks_obtained',
  'max_marks',
  'exam_date',
  'teacher_remark',
]

/* ------------------------------------------------------------- scores form */
function ScoresForm({ categories, items, period, submitting, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const current = useMemo(() => {
    const map = {}
    ;(items || []).forEach((item) => {
      map[item.slug] = item
    })
    return map
  }, [items])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      period_year: period?.year || NOW.getFullYear(),
      period_month: period?.month || NOW.getMonth() + 1,
      ...categories.reduce((accumulator, category) => {
        const entry = current[category.slug]
        accumulator[`score_${category.slug}`] =
          entry?.score === null || entry?.score === undefined ? '' : String(entry.score)
        accumulator[`remarks_${category.slug}`] = entry?.remarks || ''
        return accumulator
      }, {}),
    },
  })

  const submit = async (values) => {
    setServerError(null)
    const scores = categories
      .map((category) => ({
        category_slug: category.slug,
        score: values[`score_${category.slug}`],
        remarks: values[`remarks_${category.slug}`]?.trim() || null,
      }))
      .filter((entry) => entry.score !== '' && entry.score !== null && entry.score !== undefined)
      .map((entry) => ({ ...entry, score: Number(entry.score) }))

    if (!scores.length) {
      setServerError({ message: 'Enter a score for at least one category.' })
      return
    }

    const result = await onSubmit({
      period_year: Number(values.period_year),
      period_month: Number(values.period_month),
      scores,
    })
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, ['period_year', 'period_month'])
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      <FormErrors error={serverError} ignoreFields={['period_year', 'period_month']} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Month"
          required
          options={MONTH_OPTIONS}
          error={errors.period_month?.message}
          {...register('period_month', { required: 'Choose the month.' })}
        />
        <SelectField
          label="Year"
          required
          options={YEAR_OPTIONS}
          error={errors.period_year?.message}
          {...register('period_year', { required: 'Choose the year.' })}
        />
      </div>

      <fieldset className="space-y-4 border-t border-slate-100 pt-4">
        <legend className="text-sm font-semibold text-slate-900">Category scores</legend>
        <p className="hint mt-0 mb-1">
          Score each area out of 100. Leave a field blank to keep it unrecorded for this month.
        </p>
        {categories.map((category) => (
          <div key={category.id} className="rounded-xl border border-slate-200 p-3.5">
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{category.name}</p>
                {category.description && <p className="hint mt-0.5">{category.description}</p>}
              </div>
              <TextField
                label="Score"
                type="number"
                min={0}
                max={100}
                step="1"
                inputMode="numeric"
                error={errors[`score_${category.slug}`]?.message}
                {...register(`score_${category.slug}`, {
                  min: { value: 0, message: 'Minimum is 0.' },
                  max: { value: 100, message: 'Maximum is 100.' },
                })}
              />
            </div>
            <TextField
              label="Remarks (optional)"
              className="mt-2"
              placeholder="What has improved, what needs work"
              error={errors[`remarks_${category.slug}`]?.message}
              {...register(`remarks_${category.slug}`)}
            />
          </div>
        ))}
      </fieldset>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          Save scores
        </Button>
      </div>
    </form>
  )
}

/* ----------------------------------------------------------- academic form */
function AcademicForm({ record, submitting, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      subject: record?.subject || '',
      exam_name: record?.exam_name || '',
      exam_type: record?.exam_type || '',
      marks_obtained:
        record?.marks_obtained === null || record?.marks_obtained === undefined
          ? ''
          : String(record.marks_obtained),
      max_marks:
        record?.max_marks === null || record?.max_marks === undefined ? '100' : String(record.max_marks),
      exam_date: record?.exam_date || todayISO(),
      teacher_remark: record?.teacher_remark || '',
    },
  })

  const submit = async (values) => {
    setServerError(null)
    const result = await onSubmit({
      subject: values.subject.trim(),
      exam_name: values.exam_name.trim(),
      exam_type: values.exam_type.trim() || null,
      marks_obtained: Number(values.marks_obtained),
      max_marks: Number(values.max_marks),
      exam_date: values.exam_date || null,
      teacher_remark: values.teacher_remark.trim() || null,
    })
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, ACADEMIC_FIELDS)
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={ACADEMIC_FIELDS} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Subject"
          required
          placeholder="Mathematics"
          error={errors.subject?.message}
          {...register('subject', { required: 'Enter the subject.' })}
        />
        <TextField
          label="Exam name"
          required
          placeholder="Half-yearly examination"
          error={errors.exam_name?.message}
          {...register('exam_name', { required: 'Enter the exam name.' })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Exam type"
          placeholder="Unit test, mid-term, final…"
          error={errors.exam_type?.message}
          {...register('exam_type')}
        />
        <TextField
          label="Exam date"
          type="date"
          max={todayISO()}
          error={errors.exam_date?.message}
          {...register('exam_date')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Marks obtained"
          type="number"
          required
          min={0}
          step="0.01"
          inputMode="decimal"
          error={errors.marks_obtained?.message}
          {...register('marks_obtained', {
            required: 'Enter the marks obtained.',
            min: { value: 0, message: 'Marks cannot be negative.' },
            validate: (value) => {
              const maximum = Number(getValues('max_marks'))
              if (!Number.isFinite(maximum) || maximum <= 0) return true
              return Number(value) <= maximum || 'Marks obtained cannot exceed the maximum marks.'
            },
          })}
        />
        <TextField
          label="Maximum marks"
          type="number"
          required
          min={1}
          step="0.01"
          inputMode="decimal"
          error={errors.max_marks?.message}
          {...register('max_marks', {
            required: 'Enter the maximum marks.',
            min: { value: 0.01, message: 'Maximum marks must be greater than zero.' },
          })}
        />
      </div>

      <TextArea
        label="Teacher remark"
        rows={3}
        placeholder="Optional feedback shared with the parents"
        error={errors.teacher_remark?.message}
        {...register('teacher_remark')}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {record ? 'Save changes' : 'Add result'}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ page */
export default function AdminProgress() {
  const [studentId, setStudentId] = useState('')
  const [scoresOpen, setScoresOpen] = useState(false)
  const [academicOpen, setAcademicOpen] = useState(false)
  const [editingResult, setEditingResult] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const { page, perPage, setPage, setPerPage, reset } = usePagination(10)

  const studentsFetcher = useCallback(() => studentService.list({ per_page: 100 }), [])
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
    reload: reloadStudents,
  } = useApi(studentsFetcher)

  const categoriesFetcher = useCallback(() => progressService.categories(), [])
  const { data: categories } = useApi(categoriesFetcher)

  const overviewFetcher = useCallback(
    () => (studentId ? progressService.overview(studentId) : Promise.resolve(null)),
    [studentId],
  )
  const { data: overview, loading, error, reload, refresh } = useApi(overviewFetcher)

  const academicQuery = useMemo(
    () => ({ student_id: studentId, page, per_page: perPage }),
    [studentId, page, perPage],
  )
  const academicFetcher = useCallback(
    () =>
      studentId ? progressService.academic(academicQuery) : Promise.resolve({ data: [], meta: null }),
    [studentId, academicQuery],
  )
  const {
    data: results,
    meta: resultsMeta,
    loading: resultsLoading,
    error: resultsError,
    reload: reloadResults,
    refresh: refreshResults,
  } = useApi(academicFetcher)

  const activeCategories = useMemo(
    () => (categories || []).filter((category) => category.is_active !== false),
    [categories],
  )

  const selectedStudent = useMemo(
    () => (students || []).find((student) => String(student.id) === String(studentId)) || null,
    [students, studentId],
  )

  /* --- mutations --- */
  const handleSaveScores = async (payload) => {
    setSubmitting(true)
    try {
      await progressService.saveScores({ student_id: Number(studentId), ...payload })
      toast.success('Progress scores saved.')
      setScoresOpen(false)
      refresh()
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveResult = async (payload) => {
    setSubmitting(true)
    try {
      if (editingResult) {
        await progressService.updateAcademic(editingResult.id, payload)
        toast.success('Exam result updated.')
      } else {
        await progressService.createAcademic({ student_id: Number(studentId), ...payload })
        toast.success('Exam result added.')
      }
      setAcademicOpen(false)
      setEditingResult(null)
      refreshResults()
      refresh()
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteResult = async () => {
    setActionBusy(true)
    try {
      await progressService.removeAcademic(deleteTarget.id)
      toast.success('Exam result removed.')
      setDeleteTarget(null)
      refreshResults()
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
        title="Progress & academics"
        subtitle="Personal development scores and exam results, student by student."
      />

      <Card className="mb-4">
        <CardBody>
          <DataState
            loading={studentsLoading}
            error={studentsError}
            data={students}
            onRetry={reloadStudents}
            loadingLabel="Loading students…"
            skeleton={<SkeletonRows rows={1} />}
            emptyIcon={GraduationCap}
            emptyTitle="No students yet"
            emptyMessage="Add a student before recording progress."
          >
            {(rows) => (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,26rem)_1fr] sm:items-end">
                <SelectField
                  label="Student"
                  placeholder="Select a student"
                  value={studentId}
                  onChange={(event) => {
                    setStudentId(event.target.value)
                    reset()
                  }}
                  options={rows.map((student) => ({
                    value: student.id,
                    label: `${student.full_name} · ${student.student_code}${
                      student.student_class ? ` · ${student.student_class}` : ''
                    }`,
                  }))}
                />
                {selectedStudent && (
                  <p className="muted">
                    Showing progress for <span className="font-semibold text-slate-800">{selectedStudent.full_name}</span>
                    {selectedStudent.student_class ? ` · ${selectedStudent.student_class}` : ''}
                  </p>
                )}
              </div>
            )}
          </DataState>
        </CardBody>
      </Card>

      <DataState
        loading={loading}
        error={error}
        data={overview}
        onRetry={reload}
        loadingLabel="Loading progress…"
        emptyIcon={Users}
        emptyTitle="Select a student"
        emptyMessage="Choose a student above to see their development scores, exam results and attendance."
      >
        {(data) => {
          const period = data.categories?.period
          const items = data.categories?.items || []
          return (
            <div className="space-y-5">
              <section aria-label="Progress summary">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="Overall progress"
                    value={formatPercent(data.categories?.overall)}
                    icon={Sparkles}
                    tone="brand"
                    hint={period ? monthLabel(period.year, period.month) : undefined}
                  />
                  <StatCard
                    label="Attendance"
                    value={formatPercent(data.attendance?.percentage)}
                    icon={CalendarCheck}
                    tone="success"
                    hint={`${data.attendance?.PRESENT ?? 0} present · ${data.attendance?.ABSENT ?? 0} absent`}
                  />
                  <StatCard
                    label="Subjects tracked"
                    value={data.subjects?.length ?? 0}
                    icon={BookOpen}
                    tone="info"
                  />
                  <StatCard
                    label="Exam results"
                    value={resultsMeta?.total ?? data.academic_trend?.length ?? 0}
                    icon={Award}
                    tone="neutral"
                  />
                </div>
              </section>

              <Section
                title="Development categories"
                subtitle={
                  period
                    ? `Scores for ${monthLabel(period.year, period.month)}`
                    : 'No scoring period recorded yet'
                }
                icon={TrendingUp}
                action={
                  <Button
                    size="sm"
                    icon={Pencil}
                    onClick={() => setScoresOpen(true)}
                    disabled={!activeCategories.length}
                  >
                    Update scores
                  </Button>
                }
              >
                {items.length ? (
                  <ul className="space-y-4">
                    {items.map((item) => (
                      <li key={item.category_id}>
                        <ProgressBar
                          label={item.category}
                          value={item.score}
                          showValue={item.score !== null && item.score !== undefined}
                        />
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {item.description && <span className="hint mt-0">{item.description}</span>}
                          {item.remarks && (
                            <span className="text-xs text-slate-600">“{item.remarks}”</span>
                          )}
                          {item.period_label && (
                            <span className="text-xs text-slate-400">{item.period_label}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    No category scores recorded yet. Use “Update scores” to add the first month.
                  </p>
                )}
              </Section>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Progress shape" subtitle="All categories at a glance">
                  <ProgressRadarChart items={items} />
                </Section>
                <Section title="Progress over time" subtitle="Month-by-month comparison">
                  <ProgressHistoryChart
                    history={data.progress_history}
                    categories={activeCategories}
                  />
                </Section>
                <Section title="Subject averages" subtitle="Across all recorded exams">
                  <SubjectChart data={data.subjects} />
                </Section>
                <Section title="Exam trend" subtitle="Percentage per exam">
                  <AcademicTrendChart data={data.academic_trend} />
                </Section>
              </div>

              <Section title="Hostel attendance" subtitle="Monthly percentage">
                <MonthlyAttendanceChart data={data.attendance?.monthly_trend} />
              </Section>
            </div>
          )
        }}
      </DataState>

      {studentId && (
        <Card className="mt-5">
          <CardHeader
            title="Academic results"
            subtitle="Exam-by-exam record shared with parents"
            icon={BookOpen}
            action={
              <Button
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingResult(null)
                  setAcademicOpen(true)
                }}
              >
                Add exam result
              </Button>
            }
          />
          <DataState
            loading={resultsLoading}
            error={resultsError}
            data={results}
            onRetry={reloadResults}
            loadingLabel="Loading exam results…"
            skeleton={
              <div className="card-pad">
                <SkeletonRows rows={5} />
              </div>
            }
            emptyIcon={Award}
            emptyTitle="No exam results yet"
            emptyMessage="Add the first exam result for this student."
            emptyAction={
              <Button
                icon={Plus}
                onClick={() => {
                  setEditingResult(null)
                  setAcademicOpen(true)
                }}
              >
                Add exam result
              </Button>
            }
          >
            {(rows) => (
              <>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Subject</th>
                        <th scope="col">Exam</th>
                        <th scope="col">Marks</th>
                        <th scope="col">Percentage</th>
                        <th scope="col">Grade</th>
                        <th scope="col">Date</th>
                        <th scope="col">Remark</th>
                        <th scope="col" className="text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td className="font-semibold text-slate-900">{row.subject}</td>
                          <td>
                            <span className="block">{row.exam_name}</span>
                            {row.exam_type && (
                              <span className="block text-xs text-slate-400">{row.exam_type}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap tabular-nums">
                            {row.marks_obtained} / {row.max_marks}
                          </td>
                          <td className="tabular-nums">{formatPercent(row.percentage, 1)}</td>
                          <td>{row.grade || '—'}</td>
                          <td className="whitespace-nowrap">{formatDate(row.exam_date)}</td>
                          <td className="max-w-56 truncate">{row.teacher_remark || '—'}</td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingResult(row)
                                  setAcademicOpen(true)
                                }}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                                aria-label={`Edit ${row.subject} ${row.exam_name}`}
                                title="Edit result"
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                                aria-label={`Delete ${row.subject} ${row.exam_name}`}
                                title="Delete result"
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
                    meta={resultsMeta}
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

      <Modal
        open={scoresOpen}
        onClose={() => setScoresOpen(false)}
        title="Update progress scores"
        description={
          selectedStudent
            ? `Recording development scores for ${selectedStudent.full_name}.`
            : 'Recording development scores.'
        }
        size="lg"
      >
        <ScoresForm
          key={`${studentId}-${overview?.categories?.period?.month || ''}`}
          categories={activeCategories}
          items={overview?.categories?.items}
          period={overview?.categories?.period}
          submitting={submitting}
          onSubmit={handleSaveScores}
          onCancel={() => setScoresOpen(false)}
        />
      </Modal>

      <Modal
        open={academicOpen}
        onClose={() => {
          setAcademicOpen(false)
          setEditingResult(null)
        }}
        title={editingResult ? 'Edit exam result' : 'Add exam result'}
        description={
          selectedStudent ? `For ${selectedStudent.full_name}.` : 'Record an exam result.'
        }
        size="lg"
      >
        <AcademicForm
          key={editingResult?.id || 'new-result'}
          record={editingResult}
          submitting={submitting}
          onSubmit={handleSaveResult}
          onCancel={() => {
            setAcademicOpen(false)
            setEditingResult(null)
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteResult}
        loading={actionBusy}
        title="Delete exam result?"
        message={
          deleteTarget
            ? `${deleteTarget.subject} · ${deleteTarget.exam_name} will be removed permanently. Subject averages and the exam trend will be recalculated.`
            : ''
        }
        confirmLabel="Delete result"
      />
    </>
  )
}
