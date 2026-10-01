import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  BedDouble,
  GraduationCap,
  Info,
  Layers,
  Lock,
  School,
  ScrollText,
  Shield,
  ShieldCheck,
  Sliders,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
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
  TextField,
  applyServerErrors,
} from '../../components/common'
import { StatCard } from '../../components/dashboard/StatCard'
import { useAuth } from '../../context/auth'
import { useApi, usePagination } from '../../hooks'
import { adminService } from '../../services'
import { formatDateTime, humanize, todayISO } from '../../utils/format'

const ADMIN_FIELDS = ['full_name', 'email', 'phone', 'password', 'designation', 'is_super_admin']

function Chips({ values, emptyMessage }) {
  if (!values?.length) return <p className="muted">{emptyMessage}</p>
  return (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => (
        <li key={value} className="badge-neutral">
          {value}
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------- create admin form */
function AdminForm({ submitting, onSubmit, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      password: '',
      designation: '',
      is_super_admin: false,
    },
  })

  const submit = async (values) => {
    setServerError(null)
    const result = await onSubmit({
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || null,
      password: values.password,
      designation: values.designation.trim() || null,
      is_super_admin: values.is_super_admin,
    })
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, ADMIN_FIELDS)
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={ADMIN_FIELDS} />

      <TextField
        label="Full name"
        required
        error={errors.full_name?.message}
        {...register('full_name', {
          required: 'Enter the administrator name.',
          minLength: { value: 2, message: 'Name is too short.' },
        })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="off"
          error={errors.email?.message}
          {...register('email', {
            required: 'Enter a work email.',
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' },
          })}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="off"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Temporary password"
          type="text"
          required
          autoComplete="new-password"
          hint="At least 8 characters. Ask them to change it after the first sign-in."
          error={errors.password?.message}
          {...register('password', {
            required: 'Set a temporary password.',
            minLength: { value: 8, message: 'Use at least 8 characters.' },
          })}
        />
        <TextField
          label="Designation"
          placeholder="Warden, matron, office manager…"
          error={errors.designation?.message}
          {...register('designation')}
        />
      </div>

      <CheckboxField
        label="Make this person a super administrator"
        hint="Super administrators can create and manage other administrator accounts."
        {...register('is_super_admin')}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={UserPlus} loading={submitting}>
          Create administrator
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------- page */
export default function AdminSettings() {
  const { permissions } = useAuth()
  const canManageAdmins = Boolean(permissions?.manage_admins)

  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [logFilters, setLogFilters] = useState({
    action: '',
    admin_id: '',
    entity_type: '',
    start_date: '',
    end_date: '',
  })

  const settingsFetcher = useCallback(() => adminService.settings(), [])
  const {
    data: settings,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useApi(settingsFetcher)

  const adminsFetcher = useCallback(() => adminService.listAdmins(), [])
  const {
    data: admins,
    loading: adminsLoading,
    error: adminsError,
    reload: reloadAdmins,
    refresh: refreshAdmins,
  } = useApi(adminsFetcher)

  const logQuery = useMemo(() => {
    const cleaned = Object.fromEntries(
      Object.entries(logFilters).filter(([, value]) => value !== '' && value !== null),
    )
    return { ...cleaned, page, per_page: perPage }
  }, [logFilters, page, perPage])

  const logsFetcher = useCallback(() => adminService.auditLogs(logQuery), [logQuery])
  const {
    data: logs,
    meta: logsMeta,
    loading: logsLoading,
    error: logsError,
    reload: reloadLogs,
  } = useApi(logsFetcher)

  const setLogFilter = (key, value) => {
    setLogFilters((current) => ({ ...current, [key]: value }))
    reset()
  }

  const handleCreateAdmin = async (payload) => {
    setSubmitting(true)
    try {
      await adminService.createAdmin(payload)
      toast.success('Administrator account created.')
      setFormOpen(false)
      refreshAdmins()
      reloadSettings()
      return { ok: true }
    } catch (err) {
      if (err.status === 403) {
        toast.error('Only a super administrator can create administrator accounts.')
      } else {
        toast.error(err.message)
      }
      return { error: err }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Reference data, administrator accounts and the audit trail."
      />

      <div className="space-y-5">
        {/* ------------------------------------------------- counts + reference */}
        <DataState
          loading={settingsLoading}
          error={settingsError}
          data={settings}
          onRetry={reloadSettings}
          loadingLabel="Loading settings…"
          skeleton={<SkeletonCards count={3} />}
          isEmpty={false}
        >
          {(data) => (
            <div className="space-y-5">
              <section aria-label="Accounts by role">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatCard
                    label="Administrators"
                    value={data.user_counts?.ADMIN ?? 0}
                    icon={Shield}
                    tone="brand"
                  />
                  <StatCard
                    label="Parents"
                    value={data.user_counts?.PARENT ?? 0}
                    icon={Users}
                    tone="info"
                    to="/admin/parents"
                  />
                  <StatCard
                    label="Students with a login"
                    value={data.user_counts?.STUDENT ?? 0}
                    icon={GraduationCap}
                    tone="success"
                    to="/admin/students"
                  />
                </div>
              </section>

              <Section
                title="Progress categories"
                subtitle="The development areas wardens score each month"
                icon={Sliders}
              >
                {data.progress_categories?.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Category</th>
                          <th scope="col">Slug</th>
                          <th scope="col">Description</th>
                          <th scope="col">State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.progress_categories.map((category) => (
                          <tr key={category.id}>
                            <td className="font-semibold text-slate-900">{category.name}</td>
                            <td className="font-mono text-xs text-slate-500">{category.slug}</td>
                            <td className="max-w-96 text-slate-600">{category.description || '—'}</td>
                            <td>
                              <Badge tone={category.is_active ? 'success' : 'neutral'}>
                                {category.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">No progress categories are configured.</p>
                )}
                <p className="hint">
                  Categories are seeded with the hostel database and are read-only here so historic
                  scores stay comparable.
                </p>
              </Section>

              <div className="grid gap-4 xl:grid-cols-3">
                <Section title="Classes" subtitle="Across all students" icon={Layers}>
                  <Chips
                    values={data.filter_options?.classes}
                    emptyMessage="No classes recorded yet."
                  />
                </Section>
                <Section title="Schools" subtitle="Where students study" icon={School}>
                  <Chips
                    values={data.filter_options?.schools}
                    emptyMessage="No schools recorded yet."
                  />
                </Section>
                <Section title="Rooms" subtitle="Hostel rooms in use" icon={BedDouble}>
                  <Chips
                    values={(data.filter_options?.rooms || []).map((room) => room.label)}
                    emptyMessage="No rooms have been added yet."
                  />
                </Section>
              </div>
            </div>
          )}
        </DataState>

        {/* ----------------------------------------------- administrator accounts */}
        <Card>
          <CardHeader
            title="Administrators"
            subtitle="Wardens and office staff who can edit official records"
            icon={ShieldCheck}
            action={
              canManageAdmins ? (
                <Button size="sm" icon={UserPlus} onClick={() => setFormOpen(true)}>
                  Create administrator
                </Button>
              ) : null
            }
          />
          {!canManageAdmins && (
            <div className="mx-4 mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:mx-5">
              <Lock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="text-sm text-amber-800">
                Only a super administrator can create administrator accounts. Ask a super
                administrator if a new warden needs access.
              </p>
            </div>
          )}
          <DataState
            loading={adminsLoading}
            error={adminsError}
            data={admins}
            onRetry={reloadAdmins}
            loadingLabel="Loading administrators…"
            skeleton={
              <div className="card-pad">
                <SkeletonRows rows={3} />
              </div>
            }
            emptyIcon={ShieldCheck}
            emptyTitle="No administrators"
            emptyMessage="No administrator accounts were found."
          >
            {(rows) => (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Designation</th>
                      <th scope="col">Access</th>
                      <th scope="col">Account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((admin) => (
                      <tr key={admin.id}>
                        <td className="font-semibold text-slate-900">{admin.full_name}</td>
                        <td className="break-all">{admin.email || '—'}</td>
                        <td className="whitespace-nowrap">{admin.phone || '—'}</td>
                        <td>{admin.designation || '—'}</td>
                        <td>
                          <Badge tone={admin.is_super_admin ? 'info' : 'neutral'}>
                            {admin.is_super_admin ? 'Super administrator' : 'Administrator'}
                          </Badge>
                        </td>
                        <td>
                          <StatusBadge kind="account" value={admin.account_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataState>
        </Card>

        {/* -------------------------------------------------------- audit trail */}
        <Card>
          <CardHeader
            title="Audit log"
            subtitle="Every administrative change, kept for accountability"
            icon={ScrollText}
          />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <TextField
                label="Action"
                placeholder="STUDENT_UPDATED"
                value={logFilters.action}
                onChange={(event) => setLogFilter('action', event.target.value.toUpperCase())}
              />
              <TextField
                label="Entity type"
                placeholder="Student"
                value={logFilters.entity_type}
                onChange={(event) => setLogFilter('entity_type', event.target.value)}
              />
              <SelectField
                label="Administrator"
                placeholder="Anyone"
                options={(admins || []).map((admin) => ({
                  value: admin.id,
                  label: admin.full_name,
                }))}
                value={logFilters.admin_id}
                onChange={(event) => setLogFilter('admin_id', event.target.value)}
              />
              <TextField
                label="From"
                type="date"
                max={todayISO()}
                value={logFilters.start_date}
                onChange={(event) => setLogFilter('start_date', event.target.value)}
              />
              <TextField
                label="To"
                type="date"
                max={todayISO()}
                value={logFilters.end_date}
                onChange={(event) => setLogFilter('end_date', event.target.value)}
              />
            </div>
          </CardBody>
          <DataState
            loading={logsLoading}
            error={logsError}
            data={logs}
            onRetry={reloadLogs}
            loadingLabel="Loading audit log…"
            skeleton={
              <div className="card-pad">
                <SkeletonRows rows={6} />
              </div>
            }
            emptyIcon={Info}
            emptyTitle="No audit entries"
            emptyMessage="Nothing matches the current filters."
          >
            {(rows) => (
              <>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Admin</th>
                        <th scope="col">Action</th>
                        <th scope="col">Affected</th>
                        <th scope="col">Description</th>
                        <th scope="col">IP address</th>
                        <th scope="col">Date/time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((entry) => (
                        <tr key={entry.id}>
                          <td className="whitespace-nowrap font-medium text-slate-800">
                            {entry.admin_name || 'System'}
                          </td>
                          <td>
                            <Badge tone="neutral">{humanize(entry.action)}</Badge>
                          </td>
                          <td className="whitespace-nowrap">
                            {entry.affected_user_name || entry.entity_type || '—'}
                            {entry.entity_id ? (
                              <span className="block text-xs text-slate-400">#{entry.entity_id}</span>
                            ) : null}
                          </td>
                          <td className="max-w-96 text-slate-600">{entry.description || '—'}</td>
                          <td className="font-mono text-xs whitespace-nowrap text-slate-500">
                            {entry.ip_address || '—'}
                          </td>
                          <td className="whitespace-nowrap text-xs text-slate-500">
                            {formatDateTime(entry.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4">
                  <Pagination
                    meta={logsMeta}
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Create administrator"
        description="Administrators can edit official records, so only add people who need that access."
        size="lg"
      >
        <AdminForm
          submitting={submitting}
          onSubmit={handleCreateAdmin}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>
    </>
  )
}
