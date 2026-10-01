import { useCallback, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { AlertTriangle, CheckCircle2, Send, ShieldCheck, Siren, Users } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
  ConfirmDialog,
  DataState,
  FormErrors,
  InfoList,
  Modal,
  PageHeader,
  Pagination,
  SelectField,
  SkeletonRows,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { useApi, usePagination } from '../../hooks'
import { emergencyService, parentService, studentService } from '../../services'
import { formatDateTime, humanize, timeAgo } from '../../utils/format'
import { EMERGENCY_TYPES, optionsFrom } from '../../utils/labels'

const AUDIENCES = ['SINGLE_PARENT', 'SELECTED_PARENTS', 'ALL_PARENTS']

const FORM_FIELDS = ['alert_type', 'audience', 'student_id', 'parent_ids', 'title', 'message']

const AUDIENCE_HINTS = {
  SINGLE_PARENT: 'Only the parents linked to the selected student are alerted.',
  SELECTED_PARENTS: 'Only the parents you tick below are alerted.',
  ALL_PARENTS: 'Every verified parent in the hostel is alerted immediately.',
}

export default function AdminEmergency() {
  const { page, perPage, setPage, setPerPage, reset: resetPage } = usePagination(10)
  const [activeOnly, setActiveOnly] = useState(false)
  const [parentIds, setParentIds] = useState([])
  const [pending, setPending] = useState(null)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  /* --- lookups --- */
  const studentsFetcher = useCallback(() => studentService.list({ per_page: 100 }), [])
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
    reload: reloadStudents,
  } = useApi(studentsFetcher)

  const parentsFetcher = useCallback(
    () => parentService.lookup({ verification_status: 'VERIFIED' }),
    [],
  )
  const {
    data: parents,
    loading: parentsLoading,
    error: parentsError,
    reload: reloadParents,
  } = useApi(parentsFetcher)

  /* --- alert history --- */
  const query = useMemo(
    () => ({ ...(activeOnly ? { active_only: true } : {}), page, per_page: perPage }),
    [activeOnly, page, perPage],
  )
  const listFetcher = useCallback(() => emergencyService.list(query), [query])
  const { data: alerts, meta, loading, error, reload, refresh } = useApi(listFetcher)

  /* --- alert detail --- */
  const detailFetcher = useCallback(
    () => (selectedId ? emergencyService.get(selectedId) : Promise.resolve(null)),
    [selectedId],
  )
  const {
    data: detail,
    loading: detailLoading,
    error: detailError,
    reload: reloadDetail,
  } = useApi(detailFetcher)

  /* --- send form --- */
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    // The student / parent pickers appear only for some audiences, so drop
    // their rules and values when they are hidden.
    shouldUnregister: true,
    defaultValues: {
      alert_type: 'MEDICAL_EMERGENCY',
      audience: 'SINGLE_PARENT',
      student_id: '',
      title: '',
      message: '',
    },
  })

  const audience = useWatch({ control, name: 'audience' })
  const needsStudent = audience === 'SINGLE_PARENT'
  const needsParents = audience === 'SELECTED_PARENTS'

  const toggleParent = (parentId) => {
    clearErrors('parent_ids')
    setParentIds((current) =>
      current.includes(parentId)
        ? current.filter((id) => id !== parentId)
        : [...current, parentId],
    )
  }

  const prepare = (values) => {
    setServerError(null)
    if (needsParents && parentIds.length === 0) {
      setError('parent_ids', { type: 'manual', message: 'Select at least one parent.' })
      return
    }
    setPending({
      alert_type: values.alert_type,
      audience: values.audience,
      title: values.title.trim(),
      message: values.message.trim(),
      ...(needsStudent ? { student_id: Number(values.student_id) } : {}),
      ...(needsParents ? { parent_ids: parentIds } : {}),
    })
  }

  const confirmSend = async () => {
    setSending(true)
    setServerError(null)
    try {
      const sent = await emergencyService.send(pending)
      toast.success(
        `Emergency alert sent to ${sent?.recipient_count ?? 0} recipient${
          sent?.recipient_count === 1 ? '' : 's'
        }.`,
      )
      setPending(null)
      setParentIds([])
      reset({
        alert_type: 'MEDICAL_EMERGENCY',
        audience: 'SINGLE_PARENT',
        student_id: '',
        title: '',
        message: '',
      })
      resetPage()
      refresh()
    } catch (err) {
      setPending(null)
      const mapped = applyServerErrors(err, setError, FORM_FIELDS)
      if (!mapped) setServerError(err)
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleResolve = async () => {
    setActionBusy(true)
    try {
      await emergencyService.resolve(resolveTarget.id)
      toast.success('Alert marked as resolved.')
      setResolveTarget(null)
      refresh()
      if (selectedId) reloadDetail()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  const audienceSummary = useMemo(() => {
    if (!pending) return ''
    if (pending.audience === 'ALL_PARENTS') return 'every verified parent'
    if (pending.audience === 'SELECTED_PARENTS') {
      return `${parentIds.length} selected parent${parentIds.length === 1 ? '' : 's'}`
    }
    const student = (students || []).find((row) => row.id === pending.student_id)
    return student ? `the parents of ${student.full_name}` : 'the selected parents'
  }, [pending, parentIds, students])

  return (
    <>
      <PageHeader
        title="Emergency alerts"
        subtitle="High-priority alerts that reach parents instantly."
      />

      <div
        className="mb-4 flex gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3.5"
        role="note"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div className="min-w-0 text-sm text-red-800">
          <p className="font-semibold">Use this only for genuine emergencies.</p>
          <p className="mt-1">
            An emergency alert interrupts parents wherever they are and is logged against your
            account. For ordinary news, meetings or reminders use{' '}
            <span className="font-semibold">Announcements</span> instead - never this page.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* -------------------------------------------------- send alert form */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Send an emergency alert"
            subtitle="Every recipient is notified immediately"
            icon={Siren}
          />
          <CardBody>
            <form onSubmit={handleSubmit(prepare)} className="space-y-4" noValidate>
              <FormErrors error={serverError} ignoreFields={FORM_FIELDS} />

              <SelectField
                label="Alert type"
                required
                options={optionsFrom(EMERGENCY_TYPES)}
                error={errors.alert_type?.message}
                {...register('alert_type', { required: 'Choose the alert type.' })}
              />

              <SelectField
                label="Who should be alerted"
                required
                options={optionsFrom(AUDIENCES)}
                hint={AUDIENCE_HINTS[audience]}
                error={errors.audience?.message}
                {...register('audience', { required: 'Choose an audience.' })}
              />

              {needsStudent && (
                <DataState
                  loading={studentsLoading}
                  error={studentsError}
                  data={students}
                  onRetry={reloadStudents}
                  loadingLabel="Loading students…"
                  skeleton={<SkeletonRows rows={1} />}
                  emptyIcon={Users}
                  emptyTitle="No students"
                  emptyMessage="Add a student before sending a single-parent alert."
                >
                  {(rows) => (
                    <SelectField
                      label="Student"
                      required
                      placeholder="Select the student concerned"
                      options={rows.map((student) => ({
                        value: student.id,
                        label: `${student.full_name} · ${student.student_code}`,
                      }))}
                      error={errors.student_id?.message}
                      {...register('student_id', {
                        required: needsStudent ? 'Select the student concerned.' : false,
                      })}
                    />
                  )}
                </DataState>
              )}

              {needsParents && (
                <fieldset>
                  <legend className="label">Parents to alert</legend>
                  <DataState
                    loading={parentsLoading}
                    error={parentsError}
                    data={parents}
                    onRetry={reloadParents}
                    loadingLabel="Loading verified parents…"
                    skeleton={<SkeletonRows rows={3} />}
                    emptyIcon={Users}
                    emptyTitle="No verified parents"
                    emptyMessage="Verify a parent account before sending a targeted alert."
                  >
                    {(rows) => (
                      <div className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 px-3 py-2.5">
                        {rows.map((parent) => (
                          <CheckboxField
                            key={parent.id}
                            label={`${parent.full_name}${parent.phone ? ` · ${parent.phone}` : ''}`}
                            checked={parentIds.includes(parent.id)}
                            onChange={() => toggleParent(parent.id)}
                          />
                        ))}
                      </div>
                    )}
                  </DataState>
                  {errors.parent_ids?.message && (
                    <p className="field-error" role="alert">
                      {errors.parent_ids.message}
                    </p>
                  )}
                  {parentIds.length > 0 && (
                    <p className="hint">
                      {parentIds.length} parent{parentIds.length === 1 ? '' : 's'} selected.
                    </p>
                  )}
                </fieldset>
              )}

              <TextField
                label="Title"
                required
                placeholder="Student taken to hospital"
                error={errors.title?.message}
                {...register('title', {
                  required: 'Enter a short, factual title.',
                  minLength: { value: 3, message: 'Title is too short.' },
                })}
              />

              <TextArea
                label="Message"
                required
                rows={5}
                placeholder="State what happened, where the student is now and what the parent should do."
                error={errors.message?.message}
                {...register('message', {
                  required: 'Describe the emergency.',
                  minLength: { value: 5, message: 'Add a little more detail.' },
                })}
              />

              <Button type="submit" variant="danger" icon={Send} className="w-full" loading={sending}>
                Review and send alert
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* ----------------------------------------------------- alert history */}
        <Card className="xl:col-span-3">
          <CardHeader
            title="Alert history"
            subtitle="Active alerts stay at the top until resolved"
            icon={ShieldCheck}
            action={
              <CheckboxField
                label="Active only"
                checked={activeOnly}
                onChange={(event) => {
                  setActiveOnly(event.target.checked)
                  resetPage()
                }}
              />
            }
          />
          <CardBody>
            <DataState
              loading={loading}
              error={error}
              data={alerts}
              onRetry={reload}
              loadingLabel="Loading alerts…"
              skeleton={<SkeletonRows rows={4} />}
              emptyIcon={ShieldCheck}
              emptyTitle={activeOnly ? 'No active alerts' : 'No alerts sent'}
              emptyMessage={
                activeOnly
                  ? 'Nothing needs attention right now.'
                  : 'Emergency alerts you send will be listed here with their acknowledgements.'
              }
            >
              {(rows) => (
                <>
                  <ul className="space-y-3">
                    {rows.map((item) => (
                      <li
                        key={item.id}
                        className={`rounded-2xl border px-4 py-3.5 ${
                          item.is_active ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex gap-3">
                          <span
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              item.is_active ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Siren className="h-4.5 w-4.5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedId(item.id)}
                                className="text-left text-sm font-semibold text-slate-900 hover:text-brand-700"
                                aria-label={`Open alert: ${item.title}`}
                              >
                                {item.title}
                              </button>
                              <span className="text-[11px] whitespace-nowrap text-slate-500">
                                {timeAgo(item.created_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">{item.message}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge tone={item.is_active ? 'danger' : 'neutral'}>
                                {item.is_active ? 'Active' : 'Resolved'}
                              </Badge>
                              <Badge tone="info">
                                {EMERGENCY_TYPES[item.alert_type]?.label || humanize(item.alert_type)}
                              </Badge>
                              <Badge tone="neutral">{humanize(item.audience)}</Badge>
                              {item.student_name && (
                                <Badge tone="neutral">{item.student_name}</Badge>
                              )}
                              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                                {item.acknowledged_count ?? 0}/{item.recipient_count ?? 0} acknowledged
                              </span>
                              {item.is_active && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={CheckCircle2}
                                  onClick={() => setResolveTarget(item)}
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                            {item.resolved_at && (
                              <p className="mt-1.5 text-[11px] text-slate-500">
                                Resolved {formatDateTime(item.resolved_at)}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    meta={meta}
                    page={page}
                    onPageChange={setPage}
                    perPage={perPage}
                    onPerPageChange={(size) => {
                      setPerPage(size)
                      resetPage()
                    }}
                  />
                </>
              )}
            </DataState>
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------------ detail modal */}
      <Modal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={detail?.title || 'Emergency alert'}
        description={detail ? formatDateTime(detail.created_at) : undefined}
        size="lg"
      >
        <DataState
          loading={detailLoading}
          error={detailError}
          data={detail}
          onRetry={reloadDetail}
          loadingLabel="Loading alert…"
          emptyIcon={Siren}
          emptyTitle="Alert not available"
          emptyMessage="This alert could not be loaded."
        >
          {(row) => (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.is_active ? 'danger' : 'neutral'}>
                  {row.is_active ? 'Active' : 'Resolved'}
                </Badge>
                <Badge tone="info">
                  {EMERGENCY_TYPES[row.alert_type]?.label || humanize(row.alert_type)}
                </Badge>
                <Badge tone="neutral">{humanize(row.audience)}</Badge>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <p className="text-sm whitespace-pre-line text-slate-700">{row.message}</p>
              </div>

              <InfoList
                items={[
                  { label: 'Student', value: row.student_name },
                  { label: 'Sent by', value: row.created_by || 'Administrator' },
                  { label: 'Sent at', value: formatDateTime(row.created_at) },
                  {
                    label: 'Acknowledged',
                    value: `${row.acknowledged_count ?? 0} of ${row.recipient_count ?? 0}`,
                  },
                  { label: 'Resolved at', value: row.resolved_at ? formatDateTime(row.resolved_at) : null },
                ]}
              />

              <div className="border-t border-slate-100 pt-4">
                <h3 className="section-title mb-3 text-sm">
                  Recipients ({row.recipients?.length || 0})
                </h3>
                {row.recipients?.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Recipient</th>
                          <th scope="col">Acknowledged</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.recipients.map((recipient) => (
                          <tr key={recipient.id}>
                            <td className="font-medium text-slate-800">{recipient.user_name}</td>
                            <td>
                              {recipient.acknowledged_at ? (
                                <Badge tone="success">
                                  {formatDateTime(recipient.acknowledged_at)}
                                </Badge>
                              ) : (
                                <Badge tone="warning">Not yet acknowledged</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">No recipients were recorded for this alert.</p>
                )}
              </div>

              {row.is_active && (
                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <Button
                    variant="success"
                    icon={CheckCircle2}
                    onClick={() => setResolveTarget(row)}
                  >
                    Mark as resolved
                  </Button>
                </div>
              )}
            </div>
          )}
        </DataState>
      </Modal>

      {/* --------------------------------------------------- send confirmation */}
      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={confirmSend}
        loading={sending}
        title="Send this emergency alert?"
        message={`This will immediately alert ${audienceSummary}. Only continue if this is a genuine emergency - use Announcements for anything else.`}
        confirmLabel="Send alert now"
        requireTyped="SEND"
      >
        {pending && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm">
            <p className="font-semibold text-slate-900">{pending.title}</p>
            <p className="mt-1 whitespace-pre-line text-slate-600">{pending.message}</p>
          </div>
        )}
      </ConfirmDialog>

      {/* ------------------------------------------------ resolve confirmation */}
      <ConfirmDialog
        open={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        onConfirm={handleResolve}
        loading={actionBusy}
        variant="success"
        title="Mark alert as resolved?"
        message={
          resolveTarget
            ? `“${resolveTarget.title}” will stop showing as active for parents. The alert and its acknowledgements are kept for the record.`
            : ''
        }
        confirmLabel="Mark resolved"
      />
    </>
  )
}
