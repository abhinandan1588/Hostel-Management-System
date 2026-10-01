import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  BadgeCheck,
  Camera,
  KeyRound,
  LogOut,
  Save,
  ShieldAlert,
  Upload,
  UserRound,
  Users,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  CheckboxField,
  DataState,
  FormErrors,
  ImagePicker,
  InfoList,
  Loader,
  PageHeader,
  Section,
  StatusBadge,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { useAuth } from '../../context/auth'
import { useApi } from '../../hooks'
import { authService, parentPortalService } from '../../services'
import { formatDate, formatDateTime } from '../../utils/format'

const PROFILE_FIELDS = [
  'full_name',
  'phone',
  'address',
  'city',
  'occupation',
  'alternate_phone',
  'notify_email',
]
const PASSWORD_FIELDS = ['current_password', 'new_password', 'confirm_password']

/* ------------------------------------------------------------- details form */
function DetailsForm({ parent, onSaved }) {
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      full_name: parent.full_name || '',
      phone: parent.phone || '',
      address: parent.address || '',
      city: parent.city || '',
      occupation: parent.occupation || '',
      alternate_phone: parent.alternate_phone || '',
      notify_email: Boolean(parent.notify_email),
    },
  })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      await authService.updateProfile(values)
      toast.success('Profile updated.')
      await onSaved()
    } catch (err) {
      applyServerErrors(err, setError, PROFILE_FIELDS)
      setServerError(err)
      toast.error(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={PROFILE_FIELDS} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          required
          autoComplete="name"
          error={errors.full_name?.message}
          {...register('full_name', {
            required: 'Please enter your name.',
            minLength: { value: 2, message: 'Use at least 2 characters.' },
          })}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone', {
            maxLength: { value: 25, message: 'That phone number is too long.' },
          })}
        />
        <TextField
          label="Alternate phone"
          type="tel"
          error={errors.alternate_phone?.message}
          {...register('alternate_phone', {
            maxLength: { value: 25, message: 'That phone number is too long.' },
          })}
        />
        <TextField
          label="City"
          autoComplete="address-level2"
          error={errors.city?.message}
          {...register('city', { maxLength: { value: 80, message: 'Keep the city shorter.' } })}
        />
        <TextField
          label="Occupation"
          error={errors.occupation?.message}
          {...register('occupation', {
            maxLength: { value: 100, message: 'Keep the occupation shorter.' },
          })}
        />
        <TextArea
          label="Address"
          rows={3}
          className="sm:col-span-2"
          error={errors.address?.message}
          {...register('address', {
            maxLength: { value: 500, message: 'Keep the address under 500 characters.' },
          })}
        />
      </div>

      <CheckboxField
        label="Email me updates about my children"
        hint="Notifications always appear in the portal; this controls email copies."
        {...register('notify_email')}
      />

      <Button type="submit" icon={Save} loading={isSubmitting} className="w-full sm:w-auto">
        Save changes
      </Button>
    </form>
  )
}

/* ------------------------------------------------------------ password form */
function PasswordForm() {
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      await authService.changePassword(values)
      toast.success('Password changed. Use it next time you sign in.')
      reset({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      applyServerErrors(err, setError, PASSWORD_FIELDS)
      setServerError(err)
      toast.error(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={PASSWORD_FIELDS} />

      <TextField
        label="Current password"
        type="password"
        required
        autoComplete="current-password"
        error={errors.current_password?.message}
        {...register('current_password', { required: 'Enter your current password.' })}
      />
      <TextField
        label="New password"
        type="password"
        required
        autoComplete="new-password"
        hint="At least 8 characters, including a letter and a number."
        error={errors.new_password?.message}
        {...register('new_password', {
          required: 'Choose a new password.',
          minLength: { value: 8, message: 'Use at least 8 characters.' },
          validate: (value) =>
            (/[A-Za-z]/.test(value) && /\d/.test(value)) ||
            'Include at least one letter and one number.',
        })}
      />
      <TextField
        label="Confirm new password"
        type="password"
        required
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        {...register('confirm_password', {
          required: 'Repeat the new password.',
          validate: (value) =>
            value === getValues('new_password') || 'Passwords do not match.',
        })}
      />

      <Button type="submit" icon={KeyRound} loading={isSubmitting} className="w-full sm:w-auto">
        Change password
      </Button>
    </form>
  )
}

/* ------------------------------------------------------------------- page */
export default function ParentProfile() {
  const { refreshSession, logout } = useAuth()
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)

  const fetcher = useCallback(() => parentPortalService.profile(), [])
  const { data, loading, error, reload, refresh } = useApi(fetcher)

  const afterSave = useCallback(async () => {
    await refreshSession()
    refresh()
  }, [refreshSession, refresh])

  const uploadPhoto = async () => {
    if (!photo) {
      toast.error('Choose an image first.')
      return
    }
    setUploading(true)
    try {
      await authService.uploadPhoto(photo)
      toast.success('Profile photo updated.')
      setPhoto(null)
      await afterSave()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Your details, photo, password and verification status"
        actions={
          <Button variant="secondary" icon={LogOut} onClick={() => logout()}>
            Sign out
          </Button>
        }
      />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<Loader label="Loading your profile…" />}
      >
        {(payload) => {
          const parent = payload.parent
          const user = payload.user
          const verified = parent.verification_status === 'VERIFIED'

          return (
            <div className="space-y-4">
              {/* ------------------------------------------------ identity */}
              <Card className="card-pad">
                <div className="flex items-start gap-3">
                  <Avatar src={parent.profile_photo || user.profile_photo} name={parent.full_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold text-slate-900">
                      {parent.full_name}
                    </h2>
                    <p className="muted truncate">
                      {parent.relationship_to_student || 'Guardian'}
                      {parent.email ? ` · ${parent.email}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge kind="verification" value={parent.verification_status} />
                      <StatusBadge kind="account" value={user.account_status} />
                      {user.is_email_verified && (
                        <span className="badge-success text-[10px]">Email verified</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* -------------------------------------------- verification */}
              <Section
                title="Verification status"
                subtitle="Set by the hostel office"
                icon={verified ? BadgeCheck : ShieldAlert}
              >
                <div
                  className={`rounded-2xl border p-4 ${
                    verified ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="verification" value={parent.verification_status} />
                    {parent.verified_at && (
                      <span className="text-xs text-slate-600">
                        since {formatDate(parent.verified_at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {verified
                      ? 'Your account is verified, so you can see your children\u2019s official records.'
                      : 'Your account is waiting for the hostel office to confirm your relationship to the student. Records stay hidden until then.'}
                  </p>
                  {parent.rejection_reason && (
                    <p className="mt-2 text-sm font-medium text-red-700">
                      Reason given: {parent.rejection_reason}
                    </p>
                  )}
                </div>

                <InfoList
                  className="mt-4"
                  items={[
                    { label: 'Registered on', value: formatDate(parent.registered_at) },
                    { label: 'Student ID claimed at signup', value: parent.claimed_student_code },
                    { label: 'Children linked', value: parent.children_count },
                    { label: 'Username', value: user.username },
                    { label: 'Last signed in', value: formatDateTime(user.last_login_at) },
                    { label: 'Email notifications', value: parent.notify_email ? 'On' : 'Off' },
                  ]}
                />
              </Section>

              {/* ------------------------------------------------- children */}
              <Section
                title="Linked children"
                subtitle="Records you can view"
                icon={Users}
              >
                {parent.children?.length ? (
                  <ul className="divide-y divide-slate-100">
                    {parent.children.map((child) => (
                      <li key={child.id} className="flex items-center gap-3 py-2.5">
                        <Avatar src={child.profile_photo} name={child.full_name} size="sm" />
                        <Link
                          to={`/parent/children/${child.id}`}
                          className="min-w-0 flex-1 hover:text-brand-700"
                        >
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {child.full_name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {child.student_code}
                            {child.student_class ? ` · Class ${child.student_class}` : ''}
                            {child.relationship_type ? ` · ${child.relationship_type}` : ''}
                          </span>
                        </Link>
                        {child.is_primary && <span className="badge-info text-[10px]">Primary</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    No child is linked to your account yet. The hostel office links children after
                    checking your details.
                  </p>
                )}
              </Section>

              {/* ---------------------------------------------------- photo */}
              <Section title="Profile photo" subtitle="Helps staff recognise you" icon={Camera}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <Avatar
                    src={parent.profile_photo || user.profile_photo}
                    name={parent.full_name}
                    size="xl"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <ImagePicker onChange={setPhoto} label="Choose a new photo" />
                    <Button
                      icon={Upload}
                      loading={uploading}
                      disabled={!photo}
                      onClick={uploadPhoto}
                      className="w-full sm:w-auto"
                    >
                      Upload photo
                    </Button>
                  </div>
                </div>
              </Section>

              {/* -------------------------------------------------- details */}
              <Section title="My details" subtitle="Keep your contact details current" icon={UserRound}>
                <DetailsForm parent={parent} onSaved={afterSave} />
              </Section>

              {/* ------------------------------------------------- password */}
              <Section title="Change password" subtitle="Use a password only you know" icon={KeyRound}>
                <PasswordForm />
              </Section>

              <Card className="card-pad">
                <p className="muted">
                  Signed in as {user.full_name} ({user.role?.toLowerCase()}).
                </p>
                <Button
                  variant="secondary"
                  icon={LogOut}
                  className="mt-3 w-full sm:w-auto"
                  onClick={() => logout()}
                >
                  Sign out
                </Button>
              </Card>
            </div>
          )
        }}
      </DataState>
    </>
  )
}
