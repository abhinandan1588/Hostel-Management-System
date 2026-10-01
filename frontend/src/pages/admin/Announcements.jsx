import { useCallback, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import {
  CalendarDays,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  Power,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Badge,
  Button,
  Card,
  CardBody,
  CheckboxField,
  ConfirmDialog,
  DataState,
  FormErrors,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SelectField,
  SkeletonRows,
  StatusBadge,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { useApi, usePagination } from '../../hooks'
import { announcementService, studentService } from '../../services'
import { formatDate, formatDateTime } from '../../utils/format'
import { ANNOUNCEMENT_AUDIENCE, optionsFrom } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

const FORM_FIELDS = [
  'title',
  'description',
  'audience',
  'target_student_id',
  'target_class',
  'start_date',
  'end_date',
  'attachment',
]

/* ------------------------------------------------------- announcement form */
function AnnouncementForm({ record, students, classes, submitting, onSubmit, onCancel }) {
  const isEdit = Boolean(record)
  const [serverError, setServerError] = useState(null)
  const [file, setFile] = useState(null)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm({
    // Conditional audience fields unregister on unmount so their validation
    // rules never block a submit while hidden.
    shouldUnregister: true,
    defaultValues: {
      title: record?.title || '',
      description: record?.description || '',
      audience: record?.audience || 'ALL_PARENTS',
      target_student_id: record?.target_student_id ? String(record.target_student_id) : '',
      target_class: record?.target_class || '',
      start_date: record?.start_date || '',
      end_date: record?.end_date || '',
    },
  })

  const audience = useWatch({ control, name: 'audience' })
  const needsStudent = audience === 'SPECIFIC_STUDENT'
  const needsClass = audience === 'SPECIFIC_CLASS'

  const submit = async (values) => {
    setServerError(null)
    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      audience: values.audience,
      target_student_id: needsStudent && values.target_student_id ? Number(values.target_student_id) : null,
      target_class: needsClass && values.target_class ? values.target_class.trim() : null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
    }
    const result = await onSubmit(payload, file)
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, FORM_FIELDS)
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={FORM_FIELDS} />

      <TextField
        label="Title"
        required
        placeholder="Parents' meeting on Saturday"
        error={errors.title?.message}
        {...register('title', {
          required: 'Enter a title.',
          minLength: { value: 3, message: 'Title is too short.' },
        })}
      />

      <TextArea
        label="Message"
        required
        rows={5}
        placeholder="Explain the what, when and where in plain language."
        error={errors.description?.message}
        {...register('description', {
          required: 'Write the announcement message.',
          minLength: { value: 3, message: 'Message is too short.' },
        })}
      />

      <SelectField
        label="Audience"
        required
        options={optionsFrom(ANNOUNCEMENT_AUDIENCE)}
        error={errors.audience?.message}
        hint="Only the selected audience sees this announcement on their portal."
        {...register('audience', { required: 'Choose an audience.' })}
      />

      {needsStudent && (
        <SelectField
          label="Student"
          required
          placeholder={students.length ? 'Select a student' : 'No students available'}
          options={students.map((student) => ({
            value: student.id,
            label: `${student.full_name} · ${student.student_code}`,
          }))}
          error={errors.target_student_id?.message}
          {...register('target_student_id', {
            required: needsStudent ? 'Select the student this is for.' : false,
          })}
        />
      )}

      {needsClass && (
        <SelectField
          label="Class"
          required
          placeholder={classes.length ? 'Select a class' : 'No classes recorded yet'}
          options={classes.map((value) => ({ value, label: value }))}
          error={errors.target_class?.message}
          {...register('target_class', {
            required: needsClass ? 'Select the class this is for.' : false,
          })}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Starts on"
          type="date"
          hint="Leave blank to publish immediately."
          error={errors.start_date?.message}
          {...register('start_date')}
        />
        <TextField
          label="Ends on"
          type="date"
          hint="Leave blank to keep it visible."
          error={errors.end_date?.message}
          {...register('end_date')}
        />
      </div>

      {!isEdit && (
        <div>
          <label htmlFor="announcement-attachment" className="label">
            Attachment (optional)
          </label>
          <input
            id="announcement-attachment"
            type="file"
            className="input"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <p className="hint">A notice, circular or image parents can open. Max 8 MB.</p>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {isEdit ? 'Save changes' : 'Publish announcement'}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------- page */
export default function AdminAnnouncements() {
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [activeOnly, setActiveOnly] = useState(false)
  const [audience, setAudience] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  const query = useMemo(
    () => ({
      ...(activeOnly ? { active_only: true } : {}),
      ...(audience ? { audience } : {}),
      ...(search ? { q: search } : {}),
      page,
      per_page: perPage,
    }),
    [activeOnly, audience, search, page, perPage],
  )

  const listFetcher = useCallback(() => announcementService.list(query), [query])
  const { data: announcements, meta, loading, error, reload, refresh } = useApi(listFetcher)

  const studentsFetcher = useCallback(() => studentService.list({ per_page: 100 }), [])
  const { data: students } = useApi(studentsFetcher, { immediate: formOpen })

  const optionsFetcher = useCallback(() => studentService.filterOptions(), [])
  const { data: filterOptions } = useApi(optionsFetcher, { immediate: formOpen })

  const handleSubmit = async (payload, file) => {
    setSubmitting(true)
    try {
      if (editing) {
        await announcementService.update(editing.id, payload)
        toast.success('Announcement updated.')
      } else {
        await announcementService.create(payload, file)
        toast.success('Announcement published.')
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

  const toggleActive = async (row) => {
    setActionBusy(true)
    try {
      await announcementService.update(row.id, { is_active: !row.is_active })
      toast.success(row.is_active ? 'Announcement deactivated.' : 'Announcement activated.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  const handleDelete = async () => {
    setActionBusy(true)
    try {
      await announcementService.remove(deleteTarget.id)
      toast.success('Announcement deleted.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={
          meta ? `${meta.total} announcement${meta.total === 1 ? '' : 's'}` : 'Notices for parents and students'
        }
        actions={
          <Button icon={Plus} onClick={openCreate}>
            New announcement
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value)
                reset()
              }}
              placeholder="Search title or message…"
              className="min-w-0 flex-1 sm:min-w-64"
            />
            <SelectField
              label="Audience"
              placeholder="All audiences"
              className="w-full sm:w-56"
              options={optionsFrom(ANNOUNCEMENT_AUDIENCE)}
              value={audience}
              onChange={(event) => {
                setAudience(event.target.value)
                reset()
              }}
            />
            <CheckboxField
              label="Currently visible only"
              className="pb-2.5"
              checked={activeOnly}
              onChange={(event) => {
                setActiveOnly(event.target.checked)
                reset()
              }}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <DataState
          loading={loading}
          error={error}
          data={announcements}
          onRetry={reload}
          loadingLabel="Loading announcements…"
          skeleton={
            <div className="card-pad">
              <SkeletonRows rows={5} />
            </div>
          }
          emptyIcon={Megaphone}
          emptyTitle="No announcements"
          emptyMessage={
            activeOnly || audience || search
              ? 'Nothing matches the current filters.'
              : 'Publish your first notice for parents and students.'
          }
          emptyAction={
            <Button icon={Plus} onClick={openCreate}>
              New announcement
            </Button>
          }
        >
          {(rows) => (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Announcement</th>
                      <th scope="col">Audience</th>
                      <th scope="col">Visible</th>
                      <th scope="col">Dates</th>
                      <th scope="col">Created</th>
                      <th scope="col" className="text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="max-w-80">
                          <span className="block truncate font-semibold text-slate-900">
                            {row.title}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {row.description}
                          </span>
                          {row.attachment && (
                            <a
                              href={mediaUrl(row.attachment)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                            >
                              <Paperclip className="h-3 w-3" aria-hidden="true" />
                              Attachment
                            </a>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <StatusBadge kind="audience" value={row.audience} />
                            {row.target_student_name && (
                              <span className="text-xs text-slate-500">{row.target_student_name}</span>
                            )}
                            {row.target_class && (
                              <span className="text-xs text-slate-500">{row.target_class}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <Badge tone={row.is_active ? 'success' : 'neutral'}>
                              {row.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge tone={row.is_current ? 'info' : 'neutral'}>
                              {row.is_current ? 'Showing now' : 'Not showing'}
                            </Badge>
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          <span className="flex items-center gap-1 text-slate-600">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            {row.start_date ? formatDate(row.start_date) : 'Immediately'}
                          </span>
                          <span className="mt-0.5 block text-slate-400">
                            to {row.end_date ? formatDate(row.end_date) : 'no end date'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-xs text-slate-500">
                          {formatDateTime(row.created_at)}
                          <span className="block text-slate-400">by {row.created_by || 'Administrator'}</span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(row)
                                setFormOpen(true)
                              }}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                              aria-label={`Edit ${row.title}`}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => toggleActive(row)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                              aria-label={`${row.is_active ? 'Deactivate' : 'Activate'} ${row.title}`}
                              title={row.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(row)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Delete ${row.title}`}
                              title="Delete"
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
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Edit announcement' : 'New announcement'}
        description={
          editing
            ? 'Changes are visible to the audience straight away.'
            : 'Write a short, clear notice. Parents and students see it on their portal.'
        }
        size="lg"
      >
        <AnnouncementForm
          key={editing?.id || 'new-announcement'}
          record={editing}
          students={students || []}
          classes={filterOptions?.classes || []}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={actionBusy}
        title="Delete announcement?"
        message={
          deleteTarget
            ? `“${deleteTarget.title}” will be removed for everyone. Deactivate it instead if you only want to hide it for now.`
            : ''
        }
        confirmLabel="Delete announcement"
      />
    </>
  )
}
