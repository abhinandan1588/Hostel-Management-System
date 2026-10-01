import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  ShieldQuestion,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  FormErrors,
  InfoList,
  Loader,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SelectField,
  SkeletonRows,
  StatusBadge,
  TextArea,
  applyServerErrors,
} from '../../components/common'
import { useApi, usePagination } from '../../hooks'
import { parentService } from '../../services'
import { formatDate, formatDateTime } from '../../utils/format'
import { ACCOUNT_STATUS, VERIFICATION, optionsFrom } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

const SORTS = [
  { value: 'full_name', label: 'Name (A–Z)' },
  { value: 'created_at', label: 'Recently registered' },
  { value: 'verification_status', label: 'Verification status' },
]

const EMPTY_FILTERS = {
  q: '',
  verification_status: '',
  account_status: '',
  student_id: '',
  sort_by: 'created_at',
  sort_dir: 'desc',
}

/* ------------------------------------------------------- reject reason --- */

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
        {parent.full_name} will be told why their registration was not approved, so they can correct
        the details and register again.
      </p>
      <TextArea
        label="Reason for rejection"
        required
        rows={4}
        placeholder="The student ID does not match any student in this hostel."
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

/* ----------------------------------------------------- verification review */

function ReviewPanel({ parentId, busy, onVerify, onReject }) {
  const fetcher = useCallback(() => parentService.review(parentId), [parentId])
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <DataState
      loading={loading}
      error={error}
      data={data}
      onRetry={reload}
      isEmpty={false}
      loadingLabel="Loading registration details…"
    >
      {(parent) => {
        const child = parent.claimed_student
        const documentUrl = mediaUrl(parent.identity_document)
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar src={parent.profile_photo} name={parent.full_name} size="lg" />
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">{parent.full_name}</p>
                <p className="muted">Registered {formatDateTime(parent.registered_at)}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <StatusBadge kind="verification" value={parent.verification_status} />
                  <StatusBadge kind="account" value={parent.account_status} />
                </div>
              </div>
            </div>

            <section aria-label="Contact information">
              <h3 className="section-title mb-2.5 text-sm">Contact information</h3>
              <InfoList
                items={[
                  { label: 'Phone', value: parent.phone },
                  { label: 'Alternate phone', value: parent.alternate_phone },
                  { label: 'Email', value: parent.email },
                  { label: 'Occupation', value: parent.occupation },
                  { label: 'Address', value: parent.address },
                  { label: 'City', value: parent.city },
                ]}
              />
            </section>

            <section aria-label="Claimed relationship">
              <h3 className="section-title mb-2.5 text-sm">Claimed relationship</h3>
              <InfoList
                items={[
                  { label: 'Relationship to student', value: parent.relationship_to_student },
                  { label: 'Claimed student ID', value: parent.claimed_student_code },
                ]}
              />
            </section>

            <section aria-label="Claimed student">
              <h3 className="section-title mb-2.5 text-sm">Claimed student</h3>
              {child ? (
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar src={child.profile_photo} name={child.full_name} size="md" />
                    <div className="min-w-0">
                      <Link
                        to={`/admin/students/${child.id}`}
                        className="font-semibold text-slate-900 hover:text-brand-700"
                      >
                        {child.full_name}
                      </Link>
                      <p className="muted">
                        {child.student_code}
                        {child.student_class ? ` · ${child.student_class}` : ''}
                        {child.school_name ? ` · ${child.school_name}` : ''}
                      </p>
                    </div>
                  </div>
                  <InfoList
                    className="mt-3"
                    items={[
                      {
                        label: 'Room',
                        value: child.room_number
                          ? `${child.room_number}${child.bed_number ? ` · Bed ${child.bed_number}` : ''}`
                          : null,
                      },
                      {
                        label: 'Emergency contact',
                        value: child.emergency_contact?.name
                          ? `${child.emergency_contact.name} · ${child.emergency_contact.phone || 'no phone'}`
                          : null,
                      },
                      {
                        label: 'Already linked parents',
                        value: child.parents?.length
                          ? child.parents.map((entry) => entry.full_name).join(', ')
                          : 'None',
                      },
                    ]}
                  />
                </div>
              ) : (
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  role="alert"
                >
                  No student matches the ID{' '}
                  <span className="font-mono font-semibold">
                    {parent.claimed_student_code || 'not provided'}
                  </span>
                  . Confirm the details with the parent before approving.
                </div>
              )}
            </section>

            <section aria-label="Submitted document">
              <h3 className="section-title mb-2.5 text-sm">Identity document</h3>
              {documentUrl ? (
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary btn-sm inline-flex"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Open submitted document
                </a>
              ) : (
                <p className="muted">No identity document was uploaded.</p>
              )}
            </section>

            {parent.rejection_reason && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="status"
              >
                <p className="font-semibold">Previously rejected</p>
                <p className="mt-0.5">{parent.rejection_reason}</p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="danger" icon={XCircle} onClick={() => onReject(parent)}>
                Reject
              </Button>
              <Button
                variant="success"
                icon={CheckCircle2}
                loading={busy}
                onClick={() => onVerify(parent)}
              >
                Verify parent
              </Button>
            </div>
          </div>
        )
      }}
    </DataState>
  )
}

/* ================================================================= page == */

export default function AdminParents() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)

  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    q: searchParams.get('q') || '',
    verification_status: searchParams.get('verification_status') || '',
    account_status: searchParams.get('account_status') || '',
    student_id: searchParams.get('student_id') || '',
  }))
  const [reviewing, setReviewing] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const query = useMemo(() => {
    const cleaned = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== null),
    )
    return { ...cleaned, page, per_page: perPage }
  }, [filters, page, perPage])

  const fetcher = useCallback(() => parentService.list(query), [query])
  const { data: parents, meta, loading, error, reload, refresh } = useApi(fetcher)

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    reset()
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSearchParams({}, { replace: true })
    reset()
  }

  const hasFilters = Boolean(
    filters.q || filters.verification_status || filters.account_status || filters.student_id,
  )

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

  const pendingCount = meta?.pending_verification || 0

  return (
    <>
      <PageHeader
        title="Parents"
        subtitle={
          meta ? `${meta.total} parent account${meta.total === 1 ? '' : 's'}` : 'Manage parent accounts'
        }
      />

      {pendingCount > 0 && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5"
          role="status"
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <ShieldQuestion className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {pendingCount} registration{pendingCount === 1 ? '' : 's'} waiting for verification
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                Parents cannot see their child's records until you approve them. Check the claimed
                student ID and the identity document before verifying.
              </p>
            </div>
          </div>
          <Button
            variant={filters.verification_status === 'PENDING' ? 'secondary' : 'primary'}
            size="sm"
            onClick={() =>
              setFilter('verification_status', filters.verification_status === 'PENDING' ? '' : 'PENDING')
            }
          >
            {filters.verification_status === 'PENDING' ? 'Show all parents' : 'Review pending only'}
          </Button>
        </div>
      )}

      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput
            value={filters.q}
            onChange={(value) => setFilter('q', value)}
            placeholder="Search name, phone, email or student ID…"
            className="sm:col-span-2"
          />
          <SelectField
            label="Verification status"
            placeholder="Any verification status"
            options={optionsFrom(VERIFICATION)}
            value={filters.verification_status}
            onChange={(event) => setFilter('verification_status', event.target.value)}
          />
          <SelectField
            label="Account status"
            placeholder="Any account status"
            options={optionsFrom(ACCOUNT_STATUS)}
            value={filters.account_status}
            onChange={(event) => setFilter('account_status', event.target.value)}
          />
          <SelectField
            label="Sort by"
            options={SORTS}
            value={filters.sort_by}
            onChange={(event) => setFilter('sort_by', event.target.value)}
          />
          <SelectField
            label="Direction"
            options={[
              { value: 'desc', label: 'Newest first' },
              { value: 'asc', label: 'Oldest first' },
            ]}
            value={filters.sort_dir}
            onChange={(event) => setFilter('sort_dir', event.target.value)}
          />
          {hasFilters && (
            <div className="flex items-end">
              <Button variant="ghost" icon={X} onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <DataState
          loading={loading}
          error={error}
          data={parents}
          onRetry={reload}
          skeleton={
            <div className="card-pad">
              <SkeletonRows rows={6} />
            </div>
          }
          loadingLabel="Loading parents…"
          emptyIcon={Users}
          emptyTitle="No parents found"
          emptyMessage={
            hasFilters
              ? 'No parent accounts match the current search or filters.'
              : 'No parents have registered yet. Parents create their own account and then wait for your verification.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null
          }
        >
          {(rows) => (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Parent name</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Email</th>
                      <th scope="col">Child name</th>
                      <th scope="col">Relationship</th>
                      <th scope="col">Verification status</th>
                      <th scope="col">Account status</th>
                      <th scope="col">Registration date</th>
                      <th scope="col" className="text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((parent) => {
                      const children = parent.children || []
                      const blocked = parent.account_status === 'BLOCKED'
                      return (
                        <tr key={parent.id}>
                          <td>
                            <Link
                              to={`/admin/parents/${parent.id}`}
                              className="flex items-center gap-2.5 hover:text-brand-700"
                            >
                              <Avatar
                                src={parent.profile_photo}
                                name={parent.full_name}
                                size="sm"
                              />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-slate-900">
                                  {parent.full_name}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  {parent.city || 'City not recorded'}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap">{parent.phone || '—'}</td>
                          <td className="max-w-44 truncate">{parent.email || '—'}</td>
                          <td className="max-w-44">
                            {children.length ? (
                              <span className="block truncate">
                                {children[0].full_name}
                                {children.length > 1 && (
                                  <span className="text-xs text-slate-400">
                                    {' '}
                                    +{children.length - 1} more
                                  </span>
                                )}
                                <span className="block truncate text-xs text-slate-400">
                                  {children[0].student_code}
                                </span>
                              </span>
                            ) : (
                              <span className="text-amber-600">
                                {parent.claimed_student_code
                                  ? `Claimed ${parent.claimed_student_code}`
                                  : 'No child linked'}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            {children[0]?.relationship_type ||
                              parent.relationship_to_student ||
                              'Guardian'}
                          </td>
                          <td>
                            <StatusBadge kind="verification" value={parent.verification_status} />
                          </td>
                          <td>
                            <StatusBadge kind="account" value={parent.account_status} />
                          </td>
                          <td className="whitespace-nowrap">
                            {formatDate(parent.registered_at || parent.created_at)}
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                to={`/admin/parents/${parent.id}`}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                                aria-label={`View ${parent.full_name}`}
                                title="View profile"
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReviewing(parent)}
                                aria-label={`Review ${parent.full_name}'s registration`}
                              >
                                Review
                              </Button>
                              {parent.verification_status !== 'VERIFIED' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAction(
                                      () => parentService.verify(parent.id),
                                      `${parent.full_name} verified.`,
                                    )
                                  }
                                  className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                                  aria-label={`Verify ${parent.full_name}`}
                                  title="Verify"
                                >
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {parent.verification_status !== 'REJECTED' && (
                                <button
                                  type="button"
                                  onClick={() => setRejecting(parent)}
                                  className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                                  aria-label={`Reject ${parent.full_name}`}
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirm({ kind: blocked ? 'unblock' : 'block', parent })
                                }
                                className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                                aria-label={`${blocked ? 'Unblock' : 'Block'} ${parent.full_name}`}
                                title={blocked ? 'Unblock account' : 'Block account'}
                              >
                                <Ban className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirm({ kind: 'remove', parent })}
                                className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                                aria-label={`Remove ${parent.full_name}`}
                                title="Remove account"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
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

      {/* Verification review */}
      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Verification review"
        description="Check the claimed student and identity document before approving access."
        size="lg"
      >
        {reviewing ? (
          <ReviewPanel
            parentId={reviewing.id}
            busy={busy}
            onVerify={(parent) =>
              runAction(() => parentService.verify(parent.id), `${parent.full_name} verified.`, () =>
                setReviewing(null),
              )
            }
            onReject={(parent) => {
              setReviewing(null)
              setRejecting(parent)
            }}
          />
        ) : (
          <Loader label="Loading…" />
        )}
      </Modal>

      {/* Reject with a required reason */}
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.full_name || 'registration'}?`}
      >
        {rejecting && (
          <RejectForm
            parent={rejecting}
            onDone={async () => {
              setRejecting(null)
              await refresh()
            }}
            onCancel={() => setRejecting(null)}
          />
        )}
      </Modal>

      {/* Block / unblock */}
      <ConfirmDialog
        open={confirm?.kind === 'block' || confirm?.kind === 'unblock'}
        onClose={() => setConfirm(null)}
        loading={busy}
        variant={confirm?.kind === 'block' ? 'danger' : 'success'}
        title={confirm?.kind === 'block' ? 'Block this parent account?' : 'Unblock this parent account?'}
        message={
          confirm?.kind === 'block'
            ? `${confirm?.parent?.full_name} will not be able to sign in or receive updates. Their child's records are untouched.`
            : `${confirm?.parent?.full_name} will be able to sign in again and will resume receiving updates.`
        }
        confirmLabel={confirm?.kind === 'block' ? 'Block account' : 'Unblock account'}
        onConfirm={() =>
          runAction(
            () =>
              confirm.kind === 'block'
                ? parentService.block(confirm.parent.id, 'Blocked by administrator')
                : parentService.unblock(confirm.parent.id),
            confirm.kind === 'block' ? 'Parent account blocked.' : 'Parent account unblocked.',
            () => setConfirm(null),
          )
        }
      />

      {/* Remove */}
      <ConfirmDialog
        open={confirm?.kind === 'remove'}
        onClose={() => setConfirm(null)}
        loading={busy}
        title="Remove parent account?"
        message={`${confirm?.parent?.full_name} will be deactivated and unlinked from every child. Student records stay intact, but the parent loses all access and must register again.`}
        confirmLabel="Remove account"
        requireTyped="DELETE"
        onConfirm={() =>
          runAction(
            () => parentService.remove(confirm.parent.id),
            'Parent account removed.',
            () => setConfirm(null),
          )
        }
      />

      <p className="muted mt-4">
        Verification protects student privacy: only a verified parent can see a child's records.
        Every decision here is written to the audit log.
      </p>
    </>
  )
}
