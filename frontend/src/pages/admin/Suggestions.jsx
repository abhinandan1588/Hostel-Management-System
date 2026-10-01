import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  CheckCircle2,
  Clock,
  Inbox,
  Lightbulb,
  Loader,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Badge,
  Button,
  Card,
  CardBody,
  DataState,
  FormErrors,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SelectField,
  SkeletonRows,
  StatusBadge,
  Tabs,
  TextArea,
  applyServerErrors,
} from '../../components/common'
import { StatCard } from '../../components/dashboard/StatCard'
import { useApi, usePagination } from '../../hooks'
import { suggestionService } from '../../services'
import { formatDateTime, humanize, timeAgo } from '../../utils/format'
import { SUGGESTION_CATEGORIES, SUGGESTION_STATUS, optionsFrom } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

const STATUS_TABS = [
  { id: '', label: 'All', statKey: 'TOTAL', icon: Inbox },
  { id: 'NEW', label: 'New', statKey: 'NEW', icon: Sparkles },
  { id: 'UNDER_REVIEW', label: 'Under review', statKey: 'UNDER_REVIEW', icon: Clock },
  { id: 'IN_PROGRESS', label: 'In progress', statKey: 'IN_PROGRESS', icon: Loader },
  { id: 'RESOLVED', label: 'Resolved', statKey: 'RESOLVED', icon: CheckCircle2 },
]

/* -------------------------------------------------------------- reply form */
function ReplyForm({ submitting, onSubmit }) {
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { message: '' } })

  const submit = async (values) => {
    setServerError(null)
    const result = await onSubmit(values.message.trim())
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, ['message'])
      if (!mapped) setServerError(result.error)
      return
    }
    reset({ message: '' })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
      <FormErrors error={serverError} ignoreFields={['message']} />
      <TextArea
        label="Reply to the author"
        required
        rows={3}
        placeholder="Explain what action the hostel is taking…"
        error={errors.message?.message}
        {...register('message', {
          required: 'Write a reply before sending.',
          minLength: { value: 2, message: 'Reply is too short.' },
        })}
      />
      <div className="flex justify-end">
        <Button type="submit" icon={Send} loading={submitting}>
          Send reply
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------- page */
export default function AdminSuggestions() {
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [replyBusy, setReplyBusy] = useState(false)

  const query = useMemo(
    () => ({
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(search ? { q: search } : {}),
      page,
      per_page: perPage,
    }),
    [status, category, search, page, perPage],
  )

  const listFetcher = useCallback(() => suggestionService.list(query), [query])
  const { data: suggestions, meta, loading, error, reload, refresh } = useApi(listFetcher)

  const statsFetcher = useCallback(() => suggestionService.stats(), [])
  const { data: stats, refresh: refreshStats } = useApi(statsFetcher)

  const counts = stats || meta?.stats || {}

  const selected = useMemo(
    () => (suggestions || []).find((row) => row.id === selectedId) || null,
    [suggestions, selectedId],
  )

  const changeFilter = (setter) => (value) => {
    setter(value)
    reset()
  }

  const handleStatusChange = async (nextStatus) => {
    if (!selected || nextStatus === selected.status) return
    setStatusBusy(true)
    try {
      await suggestionService.setStatus(selected.id, nextStatus)
      toast.success(`Marked as ${(SUGGESTION_STATUS[nextStatus]?.label || humanize(nextStatus)).toLowerCase()}.`)
      refresh()
      refreshStats()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setStatusBusy(false)
    }
  }

  const handleReply = async (message) => {
    setReplyBusy(true)
    try {
      await suggestionService.reply(selected.id, message)
      toast.success('Reply sent to the author.')
      refresh()
      refreshStats()
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setReplyBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Suggestions & feedback"
        subtitle="Everything parents and students have raised, with your replies in one thread."
      />

      <section aria-label="Suggestion counts" className="mb-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Open" value={counts.OPEN ?? 0} icon={Inbox} tone="warning" highlight />
          <StatCard label="New" value={counts.NEW ?? 0} icon={Sparkles} tone="info" />
          <StatCard label="In progress" value={counts.IN_PROGRESS ?? 0} icon={Clock} tone="warning" />
          <StatCard label="Resolved" value={counts.RESOLVED ?? 0} icon={CheckCircle2} tone="success" />
        </div>
      </section>

      <Card className="mb-4">
        <CardBody className="space-y-3">
          <Tabs
            tabs={STATUS_TABS.map((tab) => ({
              id: tab.id,
              label: tab.label,
              icon: tab.icon,
              count: counts[tab.statKey] ?? 0,
            }))}
            active={status}
            onChange={changeFilter(setStatus)}
          />
          <div className="flex flex-wrap items-end gap-3">
            <SearchInput
              value={search}
              onChange={changeFilter(setSearch)}
              placeholder="Search subject, message or author…"
              className="min-w-0 flex-1 sm:min-w-64"
            />
            <SelectField
              label="Category"
              placeholder="All categories"
              className="w-full sm:w-52"
              options={optionsFrom(SUGGESTION_CATEGORIES)}
              value={category}
              onChange={(event) => changeFilter(setCategory)(event.target.value)}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <DataState
          loading={loading}
          error={error}
          data={suggestions}
          onRetry={reload}
          loadingLabel="Loading suggestions…"
          skeleton={
            <div className="card-pad">
              <SkeletonRows rows={6} />
            </div>
          }
          emptyIcon={Lightbulb}
          emptyTitle="No suggestions here"
          emptyMessage={
            status || category || search
              ? 'Nothing matches the current filters.'
              : 'Feedback from parents and students will appear here.'
          }
        >
          {(rows) => (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col">From</th>
                      <th scope="col">About</th>
                      <th scope="col">Category</th>
                      <th scope="col">Status</th>
                      <th scope="col">Replies</th>
                      <th scope="col">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="max-w-72">
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            className="text-left font-semibold text-slate-900 hover:text-brand-700"
                            aria-label={`Open suggestion: ${row.subject}`}
                          >
                            <span className="block truncate">{row.subject}</span>
                            <span className="block truncate text-xs font-normal text-slate-500">
                              {row.message}
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="block">{row.author_name || 'Unknown'}</span>
                          <span className="block text-xs text-slate-400">
                            {humanize(row.author_role || row.source)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">{row.student_name || '—'}</td>
                        <td>
                          <Badge tone="neutral">{humanize(row.category)}</Badge>
                        </td>
                        <td>
                          <StatusBadge kind="suggestion" value={row.status} />
                        </td>
                        <td className="tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            {row.reply_count ?? row.replies?.length ?? 0}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-xs text-slate-500">
                          {timeAgo(row.created_at)}
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
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.subject || 'Suggestion'}
        description={
          selected
            ? `${humanize(selected.author_role || selected.source)} · ${formatDateTime(selected.created_at)}`
            : undefined
        }
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="suggestion" value={selected.status} />
              <Badge tone="neutral">{humanize(selected.category)}</Badge>
              {selected.student_name && <Badge tone="info">About {selected.student_name}</Badge>}
              {selected.resolved_at && (
                <span className="muted">Resolved {formatDateTime(selected.resolved_at)}</span>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <p className="text-sm whitespace-pre-line text-slate-700">{selected.message}</p>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Author</dt>
                <dd className="mt-0.5 text-slate-800">
                  {selected.author_name || 'Unknown'}
                  {selected.author_phone ? ` · ${selected.author_phone}` : ''}
                  {selected.author_email ? ` · ${selected.author_email}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Student concerned
                </dt>
                <dd className="mt-0.5 text-slate-800">{selected.student_name || 'Not specified'}</dd>
              </div>
            </dl>

            {selected.attachment && (
              <a
                href={mediaUrl(selected.attachment)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-sm w-fit"
              >
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                View attachment
              </a>
            )}

            <div className="border-t border-slate-100 pt-4">
              <SelectField
                label="Status"
                className="sm:max-w-xs"
                options={optionsFrom(SUGGESTION_STATUS)}
                value={selected.status}
                disabled={statusBusy}
                onChange={(event) => handleStatusChange(event.target.value)}
                hint="Parents see this status on their portal."
              />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="section-title mb-3 text-sm">
                Conversation ({selected.replies?.length || 0})
              </h3>
              {selected.replies?.length ? (
                <ul className="space-y-2.5">
                  {selected.replies.map((reply) => (
                    <li
                      key={reply.id}
                      className={`rounded-xl border px-4 py-3 ${
                        reply.author_role === 'ADMIN'
                          ? 'border-brand-200 bg-brand-50/60'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {reply.author_name || 'Unknown'}
                          <span className="ml-1.5 text-xs font-normal text-slate-500">
                            {humanize(reply.author_role)}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-400">{timeAgo(reply.created_at)}</p>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{reply.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No replies yet. Your reply is emailed and notified to the author.</p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <ReplyForm submitting={replyBusy} onSubmit={handleReply} />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
