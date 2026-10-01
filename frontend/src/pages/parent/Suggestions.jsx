import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  MessageSquarePlus,
  Paperclip,
  Send,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  Card,
  DataState,
  FormErrors,
  PageHeader,
  Pagination,
  Section,
  SelectField,
  StatusBadge,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { useApi, usePagination } from '../../hooks'
import { parentPortalService, suggestionService } from '../../services'
import { formatDateTime, humanize, timeAgo } from '../../utils/format'
import { SUGGESTION_CATEGORIES, SUGGESTION_STATUS, optionsFrom } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

const FORM_FIELDS = ['subject', 'category', 'message', 'student_id']

/** One suggestion with its reply thread and a follow-up box. */
function SuggestionThread({ suggestion, onReplied }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const replies = suggestion.replies || []

  const sendReply = async () => {
    const message = draft.trim()
    if (message.length < 2) {
      toast.error('Please write a short message before sending.')
      return
    }
    setSending(true)
    try {
      await suggestionService.reply(suggestion.id, message)
      toast.success('Reply sent to the hostel office.')
      setDraft('')
      await onReplied()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{suggestion.subject}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {humanize(suggestion.category)}
            {suggestion.student_name ? ` · about ${suggestion.student_name}` : ''} ·{' '}
            {formatDateTime(suggestion.created_at)}
          </p>
        </div>
        <StatusBadge kind="suggestion" value={suggestion.status} />
      </div>

      <p className="mt-2 text-sm whitespace-pre-line text-slate-700">{suggestion.message}</p>

      {suggestion.attachment && (
        <a
          href={mediaUrl(suggestion.attachment)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
        >
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          View attachment
        </a>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {replies.length
          ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`
          : 'Add a follow-up'}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-3">
          {replies.length ? (
            <ul className="space-y-2.5">
              {replies.map((reply) => (
                <li key={reply.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">
                      {reply.author_name}
                      {reply.author_role && (
                        <span className="ml-1.5 font-normal text-slate-400 capitalize">
                          {reply.author_role.toLowerCase()}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400">{timeAgo(reply.created_at)}</p>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{reply.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No replies yet. The hostel office will respond here once they review it.
            </p>
          )}

          <div>
            <label htmlFor={`reply-${suggestion.id}`} className="label">
              Add a follow-up
            </label>
            <textarea
              id={`reply-${suggestion.id}`}
              rows={3}
              className="input"
              value={draft}
              placeholder="Add more detail or thank the team…"
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              className="mt-2"
              size="sm"
              icon={Send}
              loading={sending}
              onClick={sendReply}
            >
              Send reply
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function ParentSuggestions() {
  const { page, perPage, setPage, setPerPage, reset } = usePagination(10)
  const [status, setStatus] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const childrenFetcher = useCallback(() => parentPortalService.children(), [])
  const { data: children } = useApi(childrenFetcher)

  const query = useMemo(
    () => ({ ...(status ? { status } : {}), page, per_page: perPage }),
    [status, page, perPage],
  )
  const listFetcher = useCallback(() => suggestionService.list(query), [query])
  const { data, meta, loading, error, reload, refresh } = useApi(listFetcher)

  const {
    register,
    handleSubmit,
    reset: resetForm,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { subject: '', category: 'GENERAL', message: '', student_id: '' },
  })

  const onSubmit = async (values) => {
    setSubmitError(null)
    try {
      await suggestionService.create(
        {
          subject: values.subject,
          category: values.category,
          message: values.message,
          ...(values.student_id ? { student_id: values.student_id } : {}),
        },
        attachment,
      )
      toast.success('Suggestion sent. The hostel office will review it.')
      resetForm({ subject: '', category: 'GENERAL', message: '', student_id: '' })
      setAttachment(null)
      refresh()
    } catch (err) {
      applyServerErrors(err, setError, FORM_FIELDS)
      setSubmitError(err)
      toast.error(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Suggestions"
        subtitle="Share feedback, questions or concerns with the hostel office"
      />

      <div className="space-y-4 lg:grid lg:grid-cols-5 lg:gap-4 lg:space-y-0">
        {/* ---------------------------------------------------------- form */}
        <div className="lg:col-span-2">
          <Section
            title="Send a suggestion"
            subtitle="Anything about food, study, health, rooms or activities"
            icon={MessageSquarePlus}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormErrors error={submitError} ignoreFields={FORM_FIELDS} />

              <TextField
                label="Subject"
                required
                placeholder="Short summary"
                error={errors.subject?.message}
                {...register('subject', {
                  required: 'Please add a short subject.',
                  minLength: { value: 3, message: 'Use at least 3 characters.' },
                  maxLength: { value: 180, message: 'Keep the subject under 180 characters.' },
                })}
              />

              <SelectField
                label="Category"
                required
                options={optionsFrom(SUGGESTION_CATEGORIES)}
                error={errors.category?.message}
                {...register('category', { required: 'Please choose a category.' })}
              />

              <SelectField
                label="About which child?"
                placeholder="General (not about one child)"
                options={(children || []).map((child) => ({
                  value: child.id,
                  label: `${child.full_name}${child.student_class ? ` · Class ${child.student_class}` : ''}`,
                }))}
                hint="Optional. Choose a child if your suggestion is about them."
                error={errors.student_id?.message}
                {...register('student_id')}
              />

              <TextArea
                label="Message"
                required
                rows={5}
                placeholder="Tell the hostel office what is on your mind…"
                error={errors.message?.message}
                {...register('message', {
                  required: 'Please write your message.',
                  minLength: { value: 10, message: 'Use at least 10 characters.' },
                })}
              />

              <div>
                <label htmlFor="suggestion-attachment" className="label">
                  Attachment
                </label>
                <input
                  id="suggestion-attachment"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  className="input py-2"
                  onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                />
                <p className="hint">
                  Optional. A photo or PDF, up to 8 MB.
                  {attachment ? ` Selected: ${attachment.name}` : ''}
                </p>
              </div>

              <Button type="submit" icon={Send} loading={isSubmitting} className="w-full">
                Send suggestion
              </Button>
            </form>
          </Section>
        </div>

        {/* ---------------------------------------------------------- list */}
        <div className="lg:col-span-3">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="section-title">Your suggestions</h2>
                <p className="muted mt-0.5">
                  {meta ? `${meta.total} sent` : 'Everything you have sent so far'}
                </p>
              </div>
              <select
                className="input w-auto py-2 text-sm"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  reset()
                }}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {optionsFrom(SUGGESTION_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <DataState
              loading={loading}
              error={error}
              data={data}
              onRetry={reload}
              loadingLabel="Loading your suggestions…"
              emptyIcon={Lightbulb}
              emptyTitle="No suggestions yet"
              emptyMessage={
                status
                  ? 'No suggestions match this status.'
                  : 'Use the form to send your first suggestion to the hostel office.'
              }
            >
              {(rows) => (
                <>
                  <ul className="divide-y divide-slate-100">
                    {rows.map((suggestion) => (
                      <SuggestionThread
                        key={suggestion.id}
                        suggestion={suggestion}
                        onReplied={refresh}
                      />
                    ))}
                  </ul>
                  <div className="px-4 sm:px-5">
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
        </div>
      </div>
    </>
  )
}
