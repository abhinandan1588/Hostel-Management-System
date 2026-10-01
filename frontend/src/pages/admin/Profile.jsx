import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { BellRing, Camera, KeyRound, Save, Upload, UserCog } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
  DataState,
  FormErrors,
  ImagePicker,
  InfoList,
  PageHeader,
  Section,
  SkeletonRows,
  StatusBadge,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { useAuth } from '../../context/auth'
import { useApi } from '../../hooks'
import { adminService, authService } from '../../services'
import { formatDate, formatDateTime, humanize } from '../../utils/format'

const PROFILE_FIELDS = [
  'full_name',
  'phone',
  'designation',
  'hostel_name',
  'notify_email',
  'notify_health_alerts',
  'notify_new_registrations',
  'notify_suggestions',
]

const PASSWORD_FIELDS = ['current_password', 'new_password', 'confirm_password']

/* ------------------------------------------------------------ profile form */
function ProfileForm({ user, profile, submitting, onSubmit }) {
  const [serverError, setServerError] = useState(null)
  const notifications = profile?.notification_settings || {}

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      designation: profile?.designation || '',
      hostel_name: profile?.hostel_name || '',
      notify_email: notifications.email ?? true,
      notify_health_alerts: notifications.health_alerts ?? true,
      notify_new_registrations: notifications.new_registrations ?? true,
      notify_suggestions: notifications.suggestions ?? true,
    },
  })

  const submit = async (values) => {
    setServerError(null)
    const result = await onSubmit({
      full_name: values.full_name.trim(),
      phone: values.phone.trim() || null,
      designation: values.designation.trim() || null,
      hostel_name: values.hostel_name.trim() || null,
      notify_email: values.notify_email,
      notify_health_alerts: values.notify_health_alerts,
      notify_new_registrations: values.notify_new_registrations,
      notify_suggestions: values.notify_suggestions,
    })
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, PROFILE_FIELDS)
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      <FormErrors error={serverError} ignoreFields={PROFILE_FIELDS} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          required
          error={errors.full_name?.message}
          {...register('full_name', {
            required: 'Enter your full name.',
            minLength: { value: 2, message: 'Name is too short.' },
          })}
        />
        <TextField
          label="Phone"
          type="tel"
          hint="Used by parents in an emergency."
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Designation"
          placeholder="Warden"
          error={errors.designation?.message}
          {...register('designation')}
        />
        <TextField
          label="Hostel name"
          placeholder="Sunrise Boys Hostel"
          error={errors.hostel_name?.message}
          {...register('hostel_name')}
        />
      </div>

      <fieldset className="space-y-3 border-t border-slate-100 pt-4">
        <legend className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BellRing className="h-4 w-4 text-brand-700" aria-hidden="true" />
          Notification settings
        </legend>
        <CheckboxField
          label="Email me notifications"
          hint="Turn this off to only see notifications inside the app."
          {...register('notify_email')}
        />
        <CheckboxField label="Health alerts" {...register('notify_health_alerts')} />
        <CheckboxField label="New parent registrations" {...register('notify_new_registrations')} />
        <CheckboxField label="New suggestions and replies" {...register('notify_suggestions')} />
      </fieldset>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button type="submit" icon={Save} loading={submitting}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

/* ----------------------------------------------------------- password form */
function PasswordForm({ submitting, onSubmit }) {
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const submit = async (values) => {
    setServerError(null)
    const result = await onSubmit(values)
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, PASSWORD_FIELDS)
      if (!mapped) setServerError(result.error)
      return
    }
    reset({ current_password: '', new_password: '', confirm_password: '' })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
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
        hint="At least 8 characters, with a letter and a number."
        error={errors.new_password?.message}
        {...register('new_password', {
          required: 'Choose a new password.',
          minLength: { value: 8, message: 'Use at least 8 characters.' },
          pattern: {
            value: /^(?=.*[A-Za-z])(?=.*\d).+$/,
            message: 'Include at least one letter and one number.',
          },
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
          validate: (value) => value === getValues('new_password') || 'The passwords do not match.',
        })}
      />

      <div className="flex justify-end">
        <Button type="submit" icon={KeyRound} loading={submitting}>
          Change password
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------- page */
export default function AdminProfile() {
  const { refreshSession } = useAuth()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)

  const fetcher = useCallback(() => adminService.profile(), [])
  const { data, loading, error, reload, refresh } = useApi(fetcher)

  const handleProfileSave = async (payload) => {
    setSavingProfile(true)
    try {
      await adminService.updateProfile(payload)
      toast.success('Profile updated.')
      refresh()
      refreshSession()
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordChange = async (values) => {
    setSavingPassword(true)
    try {
      await authService.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      })
      toast.success('Password changed. Use it the next time you sign in.')
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setSavingPassword(false)
    }
  }

  const handlePhotoUpload = async () => {
    if (!photo) {
      toast.error('Choose an image first.')
      return
    }
    setUploading(true)
    try {
      await authService.uploadPhoto(photo)
      toast.success('Profile photo updated.')
      setPhoto(null)
      refresh()
      await refreshSession()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Your details, photo, alerts and password." />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        loadingLabel="Loading your profile…"
        skeleton={
          <Card>
            <CardBody>
              <SkeletonRows rows={4} />
            </CardBody>
          </Card>
        }
        isEmpty={false}
      >
        {({ user, profile }) => (
          <div className="grid gap-4 xl:grid-cols-3">
            {/* ------------------------------------------------------- identity */}
            <div className="space-y-4">
              <Card>
                <CardBody className="text-center">
                  <Avatar
                    src={user?.profile_photo}
                    name={user?.full_name}
                    size="xl"
                    className="mx-auto"
                  />
                  <h2 className="mt-3 text-lg font-semibold text-slate-900">{user?.full_name}</h2>
                  <p className="muted">{profile?.designation || 'Administrator'}</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <StatusBadge kind="account" value={user?.account_status} />
                    {user?.is_super_admin && <Badge tone="info">Super administrator</Badge>}
                    <Badge tone={user?.is_email_verified ? 'success' : 'warning'}>
                      {user?.is_email_verified ? 'Email verified' : 'Email not verified'}
                    </Badge>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Profile photo" subtitle="Shown beside your name" icon={Camera} />
                <CardBody className="space-y-3">
                  <ImagePicker
                    label="Choose a photo"
                    hint="PNG, JPG, WEBP or GIF. Max 8 MB."
                    onChange={setPhoto}
                  />
                  <Button
                    icon={Upload}
                    className="w-full"
                    loading={uploading}
                    disabled={!photo}
                    onClick={handlePhotoUpload}
                  >
                    Upload photo
                  </Button>
                </CardBody>
              </Card>

              <Section title="Account information" icon={UserCog}>
                <InfoList
                  columns={1}
                  items={[
                    { label: 'Email', value: user?.email },
                    { label: 'Username', value: user?.username },
                    { label: 'Role', value: humanize(user?.role) },
                    {
                      label: 'Super administrator',
                      value: user?.is_super_admin ? 'Yes' : 'No',
                    },
                    {
                      label: 'Last login',
                      value: user?.last_login_at ? formatDateTime(user.last_login_at) : null,
                    },
                    {
                      label: 'Member since',
                      value: user?.created_at ? formatDate(user.created_at) : null,
                    },
                  ]}
                />
              </Section>
            </div>

            {/* -------------------------------------------------- forms column */}
            <div className="space-y-4 xl:col-span-2">
              <Card>
                <CardHeader
                  title="Your details"
                  subtitle="Keep your contact details current so parents can reach the hostel"
                  icon={UserCog}
                />
                <CardBody>
                  <ProfileForm
                    key={`${user?.id}-${profile?.updated_at || 'new'}`}
                    user={user}
                    profile={profile}
                    submitting={savingProfile}
                    onSubmit={handleProfileSave}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Change password"
                  subtitle="You stay signed in on this device after changing it"
                  icon={KeyRound}
                />
                <CardBody>
                  <PasswordForm submitting={savingPassword} onSubmit={handlePasswordChange} />
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </DataState>
    </>
  )
}
