import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import {
  CheckCircle2,
  Heart,
  HeartPulse,
  Hospital,
  Plus,
  Save,
  ShieldCheck,
  Stethoscope,
  Thermometer,
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
  FormErrors,
  Modal,
  PageHeader,
  Pagination,
  Section,
  SelectField,
  SkeletonCards,
  SkeletonRows,
  StatusBadge,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { HealthDonutChart } from '../../components/dashboard/Charts'
import { HealthHistoryItem } from '../../components/dashboard/HealthCard'
import { StatCard } from '../../components/dashboard/StatCard'
import { useApi, usePagination } from '../../hooks'
import { healthService, studentService } from '../../services'
import { formatDate, formatDateTime, shiftDate, todayISO } from '../../utils/format'
import { HEALTH, HEALTH_SEVERITY, RECOVERY, labelOf, optionsFrom } from '../../utils/labels'

const STATUS_OPTIONS = optionsFrom(HEALTH)
const SEVERITY_OPTIONS = optionsFrom(HEALTH_SEVERITY)
const RECOVERY_OPTIONS = optionsFrom(RECOVERY)

const FORM_FIELDS = [
  'student_id',
  'status',
  'severity',
  'symptoms',
  'temperature',
  'description',
  'medicine_given',
  'doctor_visited',
  'doctor_name',
  'hospital_visit',
  'hospital_name',
  'medical_remarks',
  'recovery_status',
]

const PRIVACY_NOTE =
  'Medical details are shared only with the verified parents or guardians of this student. No other parent, and no other student, can see them.'

function HealthForm({ students, submitting, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      student_id: '',
      status: 'FEELING_UNWELL',
      severity: 'LOW',
      symptoms: '',
      temperature: '',
      description: '',
      medicine_given: '',
      doctor_visited: false,
      doctor_name: '',
      hospital_visit: false,
      hospital_name: '',
      medical_remarks: '',
      recovery_status: 'ONGOING',
    },
  })

  const status = useWatch({ control, name: 'status' })
  const doctorVisited = useWatch({ control, name: 'doctor_visited' })
  const hospitalVisit = useWatch({ control, name: 'hospital_visit' })
  const isHealthy = status === 'HEALTHY'

  const submit = async (values) => {
    setServerError(null)
    const payload = {
      student_id: Number(values.student_id),
      status: values.status,
      severity: values.severity,
      symptoms: values.symptoms?.trim() || null,
      temperature: values.temperature === '' ? null : Number(values.temperature),
      description: values.description?.trim() || null,
      medicine_given: values.medicine_given?.trim() || null,
      doctor_visited: Boolean(values.doctor_visited),
      doctor_name: values.doctor_visited ? values.doctor_name?.trim() || null : null,
      hospital_visit: Boolean(values.hospital_visit),
      hospital_name: values.hospital_visit ? values.hospital_name?.trim() || null : null,
      medical_remarks: values.medical_remarks?.trim() || null,
      recovery_status: values.recovery_status,
    }
    const result = await onSubmit(payload)
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, FORM_FIELDS)
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      <FormErrors error={serverError} ignoreFields={FORM_FIELDS} />

      <p className="flex gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-xs text-brand-900">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{PRIVACY_NOTE}</span>
      </p>

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
          {...register('student_id', { required: 'Choose the student this update is about.' })}
        />
        <SelectField
          label="Health status"
          required
          options={STATUS_OPTIONS}
          error={errors.status?.message}
          {...register('status', { required: 'Choose a health status.' })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Severity"
          required
          options={SEVERITY_OPTIONS}
          hint="High and critical records are flagged as urgent."
          error={errors.severity?.message}
          {...register('severity', { required: 'Choose a severity.' })}
        />
        <TextField
          label="Temperature (°C)"
          type="number"
          step="0.1"
          min="30"
          max="45"
          placeholder="37.0"
          error={errors.temperature?.message}
          {...register('temperature', {
            min: { value: 30, message: 'Temperature must be at least 30 °C.' },
            max: { value: 45, message: 'Temperature must be 45 °C or less.' },
          })}
        />
        <SelectField
          label="Recovery"
          required
          options={RECOVERY_OPTIONS}
          error={errors.recovery_status?.message}
          {...register('recovery_status', { required: 'Choose a recovery status.' })}
        />
      </div>

      <TextArea
        label="Symptoms"
        rows={3}
        required={!isHealthy}
        placeholder="Fever since morning, mild cough…"
        hint={isHealthy ? 'Optional when the student is healthy.' : undefined}
        error={errors.symptoms?.message}
        {...register('symptoms', {
          validate: (value) =>
            isHealthy || (value && value.trim().length > 0)
              ? true
              : 'Describe the symptoms for a health issue.',
        })}
      />

      <TextArea
        label="What happened"
        rows={3}
        placeholder="Context a parent would want to know: when it started, what was done."
        error={errors.description?.message}
        {...register('description')}
      />

      <TextField
        label="Medicine given"
        placeholder="Paracetamol 250 mg at 10:30"
        error={errors.medicine_given?.message}
        {...register('medicine_given')}
      />

      <fieldset className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <legend className="text-sm font-semibold text-slate-900">Medical attention</legend>
        <div className="space-y-3">
          <CheckboxField label="A doctor was consulted" {...register('doctor_visited')} />
          {doctorVisited && (
            <TextField
              label="Doctor's name"
              placeholder="Dr. Meera Nair"
              error={errors.doctor_name?.message}
              {...register('doctor_name')}
            />
          )}
        </div>
        <div className="space-y-3">
          <CheckboxField label="The student visited a hospital" {...register('hospital_visit')} />
          {hospitalVisit && (
            <TextField
              label="Hospital name"
              placeholder="City General Hospital"
              error={errors.hospital_name?.message}
              {...register('hospital_name')}
            />
          )}
        </div>
      </fieldset>

      <TextArea
        label="Medical remarks"
        rows={2}
        hint="Advice, follow-up date or anything the next warden on duty should know."
        error={errors.medical_remarks?.message}
        {...register('medical_remarks')}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          Save health record
        </Button>
      </div>
    </form>
  )
}

export default function AdminHealth() {
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  const overviewFetcher = useCallback(() => healthService.overview(), [])
  const { data: overview, loading, error, reload, refresh } = useApi(overviewFetcher)

  const studentsFetcher = useCallback(() => studentService.list({ per_page: 100 }), [])
  const { data: students } = useApi(studentsFetcher)

  /* --------------------------------------------------------------- history */
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [filters, setFilters] = useState(() => ({
    student_id: '',
    status: '',
    severity: '',
    recovery_status: '',
    start_date: shiftDate(todayISO(), -29),
    end_date: todayISO(),
    urgent_only: '',
  }))

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    reset()
  }

  const historyQuery = useMemo(() => {
    const cleaned = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== null),
    )
    return { ...cleaned, page, per_page: perPage }
  }, [filters, page, perPage])

  const historyFetcher = useCallback(() => healthService.list(historyQuery), [historyQuery])
  const {
    data: history,
    meta,
    loading: historyLoading,
    error: historyError,
    reload: reloadHistory,
    refresh: refreshHistory,
  } = useApi(historyFetcher)

  const distribution = useMemo(
    () =>
      Object.keys(HEALTH).map((status) => ({
        status,
        label: labelOf('health', status),
        count: overview?.counts?.[status] ?? 0,
      })),
    [overview],
  )

  const createRecord = async (payload) => {
    setSubmitting(true)
    try {
      await healthService.create(payload)
      toast.success('Health record saved. Verified parents have been notified.')
      setFormOpen(false)
      await refresh()
      await refreshHistory()
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
      await refresh()
      await refreshHistory()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Health"
        subtitle="Current health of every student, plus the full medical log."
        actions={
          <Button icon={Plus} onClick={() => setFormOpen(true)}>
            Record a health update
          </Button>
        }
      />

      <p className="mb-4 flex gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-xs text-brand-900">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{PRIVACY_NOTE}</span>
      </p>

      <DataState
        loading={loading}
        error={error}
        data={overview}
        onRetry={reload}
        loadingLabel="Loading the health board…"
        skeleton={<SkeletonCards count={4} />}
        isEmpty={false}
      >
        {(data) => (
          <div className="space-y-4">
            <section aria-label="Health summary">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label={labelOf('health', 'HEALTHY')}
                  value={data.counts?.HEALTHY ?? 0}
                  icon={Heart}
                  tone="success"
                  hint={`${data.counts?.TOTAL_STUDENTS ?? 0} students in total`}
                />
                <StatCard
                  label={labelOf('health', 'SICK')}
                  value={data.counts?.SICK ?? 0}
                  icon={Thermometer}
                  tone="danger"
                  highlight
                />
                <StatCard
                  label={labelOf('health', 'MEDICAL_OBSERVATION')}
                  value={data.counts?.MEDICAL_OBSERVATION ?? 0}
                  icon={Stethoscope}
                  tone="warning"
                  highlight
                />
                <StatCard
                  label={labelOf('health', 'HOSPITALIZED')}
                  value={data.counts?.HOSPITALIZED ?? 0}
                  icon={Hospital}
                  tone="danger"
                  highlight
                />
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-3">
              <Section
                title="Health distribution"
                subtitle={`${data.counts?.NEEDS_ATTENTION ?? 0} student(s) need attention`}
              >
                <HealthDonutChart data={distribution} />
              </Section>

              <Card className="xl:col-span-2">
                <CardHeader
                  title="Active cases"
                  subtitle="Latest record per student that is not healthy"
                  icon={HeartPulse}
                />
                <CardBody>
                  {data.active_cases?.length ? (
                    <ul>
                      {data.active_cases.map((record) => (
                        <HealthHistoryItem
                          key={record.id}
                          record={record}
                          actions={
                            <>
                              <Link
                                to={`/admin/students/${record.student_id}`}
                                className="btn-secondary btn-sm"
                              >
                                {record.student?.full_name || 'View student'}
                              </Link>
                              {record.recovery_status !== 'RECOVERED' && (
                                <Button
                                  size="sm"
                                  variant="success"
                                  icon={CheckCircle2}
                                  className="min-h-9"
                                  onClick={() => setConfirm({ kind: 'recovered', record })}
                                >
                                  Mark recovered
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Trash2}
                                className="min-h-9"
                                onClick={() => setConfirm({ kind: 'delete', record })}
                              >
                                Delete
                              </Button>
                            </>
                          }
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="muted py-4">
                      No active cases. Every student is currently recorded as healthy.
                    </p>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </DataState>

      <Card className="mt-4">
        <CardHeader title="Health log" subtitle="Every record, newest first" />
        <CardBody className="border-b border-slate-100">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="Student"
              placeholder="All students"
              options={(students || []).map((student) => ({
                value: student.id,
                label: `${student.full_name} · ${student.student_code}`,
              }))}
              value={filters.student_id}
              onChange={(event) => setFilter('student_id', event.target.value)}
            />
            <SelectField
              label="Status"
              placeholder="Any status"
              options={STATUS_OPTIONS}
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
            />
            <SelectField
              label="Severity"
              placeholder="Any severity"
              options={SEVERITY_OPTIONS}
              value={filters.severity}
              onChange={(event) => setFilter('severity', event.target.value)}
            />
            <SelectField
              label="Recovery"
              placeholder="Any recovery state"
              options={RECOVERY_OPTIONS}
              value={filters.recovery_status}
              onChange={(event) => setFilter('recovery_status', event.target.value)}
            />
            <label className="block">
              <span className="label">From</span>
              <input
                type="date"
                className="input"
                value={filters.start_date}
                max={filters.end_date || todayISO()}
                onChange={(event) => setFilter('start_date', event.target.value)}
              />
            </label>
            <label className="block">
              <span className="label">To</span>
              <input
                type="date"
                className="input"
                value={filters.end_date}
                max={todayISO()}
                onChange={(event) => setFilter('end_date', event.target.value)}
              />
            </label>
            <div className="flex items-end">
              <CheckboxField
                label="Urgent records only"
                checked={filters.urgent_only === 'true'}
                onChange={(event) => setFilter('urgent_only', event.target.checked ? 'true' : '')}
              />
            </div>
          </div>
        </CardBody>

        <DataState
          loading={historyLoading}
          error={historyError}
          data={history}
          onRetry={reloadHistory}
          loadingLabel="Loading the health log…"
          skeleton={
            <div className="card-pad">
              <SkeletonRows rows={5} />
            </div>
          }
          emptyIcon={HeartPulse}
          emptyTitle="No health records"
          emptyMessage="No records match the selected period and filters."
        >
          {(rows) => (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Recorded</th>
                      <th scope="col">Status</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Recovery</th>
                      <th scope="col">Symptoms</th>
                      <th scope="col">Temp.</th>
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
                        <td className="text-xs whitespace-nowrap text-slate-500">
                          {formatDateTime(record.recorded_at)}
                          <span className="block text-slate-400">by {record.recorded_by}</span>
                        </td>
                        <td>
                          <StatusBadge kind="health" value={record.status} />
                        </td>
                        <td>
                          <StatusBadge kind="severity" value={record.severity} />
                        </td>
                        <td>
                          <StatusBadge kind="recovery" value={record.recovery_status} />
                        </td>
                        <td className="max-w-52 truncate">{record.symptoms || '—'}</td>
                        <td className="whitespace-nowrap">
                          {record.temperature ? `${record.temperature} °C` : '—'}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {record.recovery_status !== 'RECOVERED' && (
                              <button
                                type="button"
                                onClick={() => setConfirm({ kind: 'recovered', record })}
                                className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                                aria-label={`Mark ${
                                  record.student?.full_name || 'this student'
                                } as recovered`}
                                title="Mark recovered"
                              >
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirm({ kind: 'delete', record })}
                              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Delete the health record from ${formatDate(
                                record.recorded_at,
                              )}`}
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Record a health update"
        description="Parents of this student are notified straight away, so keep the wording factual and calm."
        size="lg"
      >
        <HealthForm
          students={students || []}
          submitting={submitting}
          onSubmit={createRecord}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === 'recovered'}
        onClose={() => setConfirm(null)}
        loading={actionBusy}
        variant="success"
        title="Mark as recovered?"
        message={`${
          confirm?.record?.student?.full_name || 'This student'
        } will be recorded as recovered and healthy again. Their guardians are notified.`}
        confirmLabel="Mark recovered"
        onConfirm={() =>
          runAction(
            () => healthService.markRecovered(confirm.record.id),
            'Marked as recovered. Guardians notified.',
          )
        }
      />

      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        onClose={() => setConfirm(null)}
        loading={actionBusy}
        title="Delete this health record?"
        message={`The ${labelOf(
          'health',
          confirm?.record?.status,
        ).toLowerCase()} record for ${
          confirm?.record?.student?.full_name || 'this student'
        } from ${formatDate(
          confirm?.record?.recorded_at,
        )} will be permanently removed. Medical history is used for care decisions, so delete only genuine mistakes.`}
        confirmLabel="Delete record"
        requireTyped="DELETE"
        onConfirm={() =>
          runAction(() => healthService.remove(confirm.record.id), 'Health record deleted.')
        }
      />
    </>
  )
}
