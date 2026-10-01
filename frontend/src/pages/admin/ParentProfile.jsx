import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  FileText,
  GraduationCap,
  Lightbulb,
  Mail,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  User,
  Users,
  XCircle,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataState,
  FormErrors,
  InfoList,
  Modal,
  Section,
  SkeletonRows,
  StatusBadge,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { useApi } from '../../hooks'
import { parentService } from '../../services'
import { formatDate, formatDateTime, timeAgo } from '../../utils/format'
import { mediaUrl } from '../../utils/media'

const EDIT_FIELDS = [
  'full_name',
  'phone',
  'address',
  'city',
  'relationship_to_student',
  'occupation',
  'alternate_phone',
]

/* --------------------------------------------------------------- edit form */

function ParentEditForm({ parent, onDone, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: parent.full_name || '',
      phone: parent.phone || '',
      alternate_phone: parent.alternate_phone || '',
      relationship_to_student: parent.relationship_to_student || '',
      occupation: parent.occupation || '',
      address: parent.address || '',
      city: parent.city || '',
    },
  })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      const payload = {}
      EDIT_FIELDS.forEach((field) => {
        const value = values[field]
        payload[field] = value === '' || value === undefined ? null : value
      })
      payload.full_name = values.full_name.trim()
      await parentService.update(parent.id, payload)
      toast.success('Parent profile updated.')
      await onDone()
    } catch (error) {
      toast.error(error.message)
      if (!applyServerErrors(error, setError, EDIT_FIELDS)) setServerError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={EDIT_FIELDS} />
      <TextField
        label="Full name"
        required
        error={errors.full_name?.message}
        {...register('full_name', {
          required: "Enter the parent's full name.",
          minLength: { value: 2, message: 'Name is too short.' },
        })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Phone"
          type="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          label="Alternate phone"
          type="tel"
          error={errors.alternate_phone?.message}
          {...register('alternate_phone')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Relationship to student"
          placeholder="Father, Mother, Guardian…"
          error={errors.relationship_to_student?.message}
          {...register('relationship_to_student')}
        />
        <TextField
          label="Occupation"
          error={errors.occupation?.message}
          {...register('occupation')}
        />
      </div>
      <TextArea label="Address" rows={3} error={errors.address?.message} {...register('address')} />
      <TextField label="City" error={errors.city?.message} {...register('city')} />
      <p className="hint">
        The login email cannot be changed here. Ask the parent to update it from their own profile.
      </p>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

/* -------------------------------------------------------- reject with reason */

function RejectForm({ parent, onDone, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { reason: '' } })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await parentService.reject(parent.id, values.reason.trim())
      toast.success('Registration rejected.')
      await onDone()
    } catch (error) {
      toast.error(error.message)
      if (!applyServerErrors(error, setError, ['reason'])) setServerError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={['reason']} />
      <p className="text-sm text-slate-600">
        {parent.full_name} is told the reason so they can correct their details and register again.
      </p>
      <TextArea
        label="Reason for rejection"
        required
        rows={4}
        error={errors.reason?.message}
        {...register('reason', {
          required: 'Give a reason so the parent knows what to fix.',
          minLength: { value: 5, message: 'Add a little more detail.' },
        })}
      />
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" icon={XCircle} loading={submitting}>
          Reject registration
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------- suggestions */

function SuggestionsPanel({ parentId }) {
  const fetcher = useCallback(() => parentService.suggestions(parentId), [parentId])
  const { data, meta, loading, error, reload } = useApi(fetcher)

  return (
    <Card>
      <CardHeader
        title="Suggestions from this parent"
        subtitle={
          meta?.total
            ? `${meta.total} suggestion${meta.total === 1 ? '' : 's'} raised through the parent portal`
            : 'Feedback raised through the parent portal'
        }
        icon={Lightbulb}
        action={
          <Link to="/admin/suggestions" className="btn-secondary btn-sm">
            Suggestion board
          </Link>
        }
      />
      <CardBody>
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={reload}
          skeleton={<SkeletonRows rows={3} />}
          loadingLabel="Loading suggestions…"
          emptyIcon={Lightbulb}
          emptyTitle="No suggestions yet"
          emptyMessage="This parent has not raised any suggestions or concerns."
        >
          {(rows) => (
            <ul className="divide-y divide-slate-100">
              {rows.map((suggestion) => (
                <li key={suggestion.id} className="py-3.5 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                      {suggestion.subject}
                    </p>
                    <StatusBadge kind="suggestion" value={suggestion.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <span className="badge-neutral mr-1.5">{suggestion.category}</span>
                    {suggestion.student_name ? `About ${suggestion.student_name} · ` : ''}
                    {timeAgo(suggestion.created_at)} · {suggestion.reply_count || 0} repl
                    {suggestion.reply_count === 1 ? 'y' : 'ies'}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-700">{suggestion.message}</p>
                  {suggestion.replies?.length > 0 && (
                    <ul className="mt-2 space-y-2 border-l-2 border-slate-100 pl-3">
                      {suggestion.replies.map((reply) => (
                        <li key={reply.id}>
                          <p className="text-xs font-semibold text-slate-700">
                            {reply.author_name}
                            <span className="ml-1.5 font-normal text-slate-400">
                              {reply.author_role} · {timeAgo(reply.created_at)}
                            </span>
                          </p>
                          <p className="text-xs text-slate-600">{reply.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </CardBody>
    </Card>
  )
}

/* ================================================================= page == */

export default function AdminParentProfile() {
  const { id } = useParams()
  const [editOpen, setEditOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const fetcher = useCallback(() => parentService.get(id), [id])
  const { data, loading, error, reload, refresh } = useApi(fetcher)

  const runAction = useCallback(
    async (fn, message, done) => {
      setBusy(true)
      try {
        await fn()
        toast.success(message)
        done?.()
        await refresh()
        return true
      } catch (err) {
        toast.error(err.message)
        return false
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  return (
    <>
      <Link
        to="/admin/parents"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to parents
      </Link>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={(value) => !value?.id}
        loadingLabel="Loading parent profile…"
        emptyIcon={Users}
        emptyTitle="Parent not found"
        emptyMessage="This parent account does not exist or has been removed."
        emptyAction={
          <Link to="/admin/parents" className="btn-secondary">
            Back to parents
          </Link>
        }
      >
        {(parent) => {
          const blocked = parent.account_status === 'BLOCKED'
          const children = parent.children || []
          const documentUrl = mediaUrl(parent.identity_document)
          return (
            <div className="space-y-4">
              {/* ------------------------------------------------ header */}
              <Card>
                <div className="card-pad flex flex-col gap-4 sm:flex-row sm:items-start">
                  <Avatar
                    src={parent.profile_photo}
                    name={parent.full_name}
                    size="xl"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                      {parent.full_name}
                    </h1>
                    <p className="muted mt-0.5">
                      {parent.relationship_to_student || 'Guardian'}
                      {parent.city ? ` · ${parent.city}` : ''}
                      {' · '}
                      {children.length} child{children.length === 1 ? '' : 'ren'} linked
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <StatusBadge kind="verification" value={parent.verification_status} />
                      <StatusBadge kind="account" value={parent.account_status} />
                      {parent.notify_email && <span className="badge-neutral">Email alerts on</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    <Button size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
                      Edit profile
                    </Button>
                    {parent.verification_status !== 'VERIFIED' && (
                      <Button
                        size="sm"
                        variant="success"
                        icon={CheckCircle2}
                        loading={busy}
                        onClick={() =>
                          runAction(
                            () => parentService.verify(parent.id),
                            `${parent.full_name} verified.`,
                          )
                        }
                      >
                        Verify
                      </Button>
                    )}
                    {parent.verification_status !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={XCircle}
                        onClick={() => setRejectOpen(true)}
                      >
                        Reject
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Ban}
                      onClick={() => setConfirm({ kind: blocked ? 'unblock' : 'block' })}
                    >
                      {blocked ? 'Unblock' : 'Block'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      onClick={() => setConfirm({ kind: 'remove' })}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <Section title="Parent information" icon={User}>
                    <InfoList
                      items={[
                        { label: 'Full name', value: parent.full_name },
                        { label: 'Relationship to student', value: parent.relationship_to_student },
                        { label: 'Occupation', value: parent.occupation },
                        { label: 'Claimed student ID', value: parent.claimed_student_code },
                        { label: 'Registered on', value: formatDateTime(parent.registered_at) },
                        { label: 'Last updated', value: formatDateTime(parent.updated_at) },
                      ]}
                    />
                  </Section>

                  <Section title="Contact information" icon={Phone}>
                    <InfoList
                      items={[
                        { label: 'Phone', value: parent.phone },
                        { label: 'Alternate phone', value: parent.alternate_phone },
                        {
                          label: 'Email',
                          value: parent.email ? (
                            <a
                              href={`mailto:${parent.email}`}
                              className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                            >
                              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                              {parent.email}
                            </a>
                          ) : null,
                        },
                        { label: 'Email notifications', value: parent.notify_email ? 'On' : 'Off' },
                        { label: 'Address', value: parent.address },
                        { label: 'City', value: parent.city },
                      ]}
                    />
                  </Section>

                  <Card>
                    <CardHeader
                      title="Associated children"
                      subtitle={`${children.length} student${children.length === 1 ? '' : 's'} linked to this parent`}
                      icon={GraduationCap}
                    />
                    <CardBody>
                      {children.length ? (
                        <ul className="grid gap-3 sm:grid-cols-2">
                          {children.map((child) => (
                            <li key={child.id}>
                              <Link
                                to={`/admin/students/${child.id}`}
                                className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-shadow hover:shadow-[var(--shadow-float)]"
                              >
                                <Avatar
                                  src={child.profile_photo}
                                  name={child.full_name}
                                  size="md"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold text-slate-900">
                                    {child.full_name}
                                  </span>
                                  <span className="block truncate text-xs text-slate-500">
                                    {child.student_code}
                                    {child.student_class ? ` · ${child.student_class}` : ''}
                                    {child.section ? ` ${child.section}` : ''}
                                  </span>
                                  <span className="block truncate text-xs text-slate-500">
                                    {child.room_number
                                      ? `Room ${child.room_number}${child.bed_number ? ` · Bed ${child.bed_number}` : ''}`
                                      : 'No bed assigned'}
                                  </span>
                                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                                    <span className="badge-neutral">
                                      {child.relationship_type || 'Guardian'}
                                    </span>
                                    {child.is_primary && (
                                      <span className="badge-info">Primary contact</span>
                                    )}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div
                          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                          role="status"
                        >
                          <p className="font-semibold">No children linked.</p>
                          <p className="mt-0.5">
                            This parent receives no updates yet. Link them from the student's profile
                            page once you have confirmed the relationship.
                          </p>
                        </div>
                      )}
                    </CardBody>
                  </Card>

                  <SuggestionsPanel parentId={parent.id} />
                </div>

                <div className="space-y-4">
                  <Section title="Verification status" icon={ShieldCheck} className="h-fit">
                    <InfoList
                      columns={1}
                      items={[
                        {
                          label: 'Verification',
                          value: (
                            <StatusBadge kind="verification" value={parent.verification_status} />
                          ),
                        },
                        {
                          label: 'Verified at',
                          value: parent.verified_at ? formatDateTime(parent.verified_at) : null,
                        },
                        { label: 'Rejection reason', value: parent.rejection_reason },
                        {
                          label: 'Identity document',
                          value: documentUrl ? (
                            <a
                              href={documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                              Open document
                            </a>
                          ) : null,
                        },
                      ]}
                    />
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {parent.verification_status !== 'VERIFIED' && (
                        <Button
                          size="sm"
                          variant="success"
                          icon={CheckCircle2}
                          loading={busy}
                          onClick={() =>
                            runAction(
                              () => parentService.verify(parent.id),
                              `${parent.full_name} verified.`,
                            )
                          }
                        >
                          Verify
                        </Button>
                      )}
                      {parent.verification_status !== 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="danger"
                          icon={XCircle}
                          onClick={() => setRejectOpen(true)}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </Section>

                  <Section title="Account status" icon={Ban} className="h-fit">
                    <InfoList
                      columns={1}
                      items={[
                        {
                          label: 'Account status',
                          value: <StatusBadge kind="account" value={parent.account_status} />,
                        },
                        { label: 'User ID', value: parent.user_id },
                        { label: 'Registered', value: formatDate(parent.created_at) },
                        { label: 'Children linked', value: parent.children_count ?? children.length },
                      ]}
                    />
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <Button
                        size="sm"
                        variant={blocked ? 'success' : 'secondary'}
                        icon={Ban}
                        onClick={() => setConfirm({ kind: blocked ? 'unblock' : 'block' })}
                      >
                        {blocked ? 'Unblock account' : 'Block account'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => setConfirm({ kind: 'remove' })}
                      >
                        Remove account
                      </Button>
                    </div>
                  </Section>
                </div>
              </div>

              {/* ------------------------------------------------ modals */}
              <Modal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                title={`Edit ${parent.full_name}`}
                description="Correct contact details on the parent's behalf. Changes are audited."
              >
                <ParentEditForm
                  parent={parent}
                  onDone={async () => {
                    setEditOpen(false)
                    await refresh()
                  }}
                  onCancel={() => setEditOpen(false)}
                />
              </Modal>

              <Modal
                open={rejectOpen}
                onClose={() => setRejectOpen(false)}
                title={`Reject ${parent.full_name}?`}
              >
                <RejectForm
                  parent={parent}
                  onDone={async () => {
                    setRejectOpen(false)
                    await refresh()
                  }}
                  onCancel={() => setRejectOpen(false)}
                />
              </Modal>

              <ConfirmDialog
                open={confirm?.kind === 'block' || confirm?.kind === 'unblock'}
                onClose={() => setConfirm(null)}
                loading={busy}
                variant={confirm?.kind === 'block' ? 'danger' : 'success'}
                title={
                  confirm?.kind === 'block' ? 'Block this parent account?' : 'Unblock this parent account?'
                }
                message={
                  confirm?.kind === 'block'
                    ? `${parent.full_name} will not be able to sign in or receive updates. Their children's records are untouched.`
                    : `${parent.full_name} will be able to sign in again and will resume receiving updates.`
                }
                confirmLabel={confirm?.kind === 'block' ? 'Block account' : 'Unblock account'}
                onConfirm={() =>
                  runAction(
                    () =>
                      confirm.kind === 'block'
                        ? parentService.block(parent.id, 'Blocked by administrator')
                        : parentService.unblock(parent.id),
                    confirm.kind === 'block'
                      ? 'Parent account blocked.'
                      : 'Parent account unblocked.',
                    () => setConfirm(null),
                  )
                }
              />

              <ConfirmDialog
                open={confirm?.kind === 'remove'}
                onClose={() => setConfirm(null)}
                loading={busy}
                title="Remove parent account?"
                message={`${parent.full_name} will be deactivated and unlinked from every child. Student records stay intact, but the parent loses all access and must register again.`}
                confirmLabel="Remove account"
                requireTyped="DELETE"
                onConfirm={() =>
                  runAction(() => parentService.remove(parent.id), 'Parent account removed.', () =>
                    setConfirm(null),
                  )
                }
              />
            </div>
          )
        }}
      </DataState>
    </>
  )
}
