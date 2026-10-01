import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Camera,
  IdCard,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Phone,
  Save,
  Users,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataState,
  FormErrors,
  ImagePicker,
  InfoList,
  PageHeader,
  SelectField,
  SkeletonRows,
  StatusBadge,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { useAuth } from '../../context/auth'
import { useApi } from '../../hooks'
import { authService, studentPortalService } from '../../services'
import { formatDate, formatDateTime, humanize } from '../../utils/format'

/** The only fields a student may change on their own record. */
const EDITABLE_FIELDS = [
  'phone',
  'email',
  'blood_group',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relation',
]

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const PASSWORD_FIELDS = ['current_password', 'new_password', 'confirm_password']

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

function emptyToNull(value) {
  return value === '' || value === undefined ? null : value
}

/* ------------------------------------------------------- my contact details */
function ContactDetailsForm({ student, editableFields, onSaved }) {
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  const allowed = useMemo(
    () => EDITABLE_FIELDS.filter((field) => (editableFields || EDITABLE_FIELDS).includes(field)),
    [editableFields],
  )

  const bloodGroupOptions = useMemo(() => {
    const current = student.blood_group
    const values = current && !BLOOD_GROUPS.includes(current) ? [...BLOOD_GROUPS, current] : BLOOD_GROUPS
    return values.map((value) => ({ value, label: value }))
  }, [student.blood_group])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      phone: student.phone || '',
      email: student.email || '',
      blood_group: student.blood_group || '',
      emergency_contact_name: student.emergency_contact?.name || '',
      emergency_contact_phone: student.emergency_contact?.phone || '',
      emergency_contact_relation: student.emergency_contact?.relation || '',
    },
  })

  const submit = async (values) => {
    setSubmitting(true)
    setServerError(null)
    const payload = {}
    allowed.forEach((field) => {
      payload[field] = emptyToNull(values[field])
    })
    try {
      await studentPortalService.updateProfile(payload)
      toast.success('Your contact details have been updated.')
      onSaved()
    } catch (err) {
      const mapped = applyServerErrors(err, setError, allowed)
      if (!mapped) setServerError(err)
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={allowed} />

      <div className="grid gap-4 sm:grid-cols-2">
        {allowed.includes('phone') && (
          <TextField
            label="My phone"
            type="tel"
            autoComplete="tel"
            placeholder="9876543210"
            error={errors.phone?.message}
            {...register('phone', {
              maxLength: { value: 25, message: 'That phone number is too long.' },
            })}
          />
        )}
        {allowed.includes('email') && (
          <TextField
            label="My email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', {
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
            })}
          />
        )}
        {allowed.includes('blood_group') && (
          <SelectField
            label="Blood group"
            placeholder="Not recorded"
            options={bloodGroupOptions}
            error={errors.blood_group?.message}
            {...register('blood_group')}
          />
        )}
      </div>

      <fieldset className="space-y-4 border-t border-slate-100 pt-4">
        <legend className="text-sm font-semibold text-slate-900">Emergency contact</legend>
        <p className="text-xs text-slate-500">
          Who should the hostel call if they cannot reach your parents?
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {allowed.includes('emergency_contact_name') && (
            <TextField
              label="Name"
              error={errors.emergency_contact_name?.message}
              {...register('emergency_contact_name', {
                maxLength: { value: 150, message: 'That name is too long.' },
              })}
            />
          )}
          {allowed.includes('emergency_contact_phone') && (
            <TextField
              label="Phone"
              type="tel"
              error={errors.emergency_contact_phone?.message}
              {...register('emergency_contact_phone', {
                maxLength: { value: 25, message: 'That phone number is too long.' },
              })}
            />
          )}
          {allowed.includes('emergency_contact_relation') && (
            <TextField
              label="Relation"
              placeholder="Uncle"
              error={errors.emergency_contact_relation?.message}
              {...register('emergency_contact_relation', {
                maxLength: { value: 50, message: 'Keep this short.' },
              })}
            />
          )}
        </div>
      </fieldset>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button type="submit" icon={Save} loading={submitting}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

/* ----------------------------------------------------------- password change */
function PasswordForm() {
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const submit = async (values) => {
    setSubmitting(true)
    setServerError(null)
    try {
      await authService.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      })
      toast.success('Your password has been changed.')
      reset({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      const mapped = applyServerErrors(err, setError, PASSWORD_FIELDS)
      if (!mapped) setServerError(err)
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
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

      <div className="grid gap-4 sm:grid-cols-2">
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
              value: PASSWORD_PATTERN,
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
            required: 'Type the new password again.',
            validate: (value, values) =>
              value === values.new_password || 'The two passwords do not match.',
          })}
        />
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button type="submit" icon={Lock} loading={submitting}>
          Change password
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------- profile photo */
function PhotoCard({ user, student, onUploaded }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const upload = async () => {
    if (!file) return
    setUploading(true)
    try {
      await authService.uploadPhoto(file)
      toast.success('Photo updated.')
      setFile(null)
      onUploaded()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar
          src={user?.profile_photo || student.profile_photo}
          name={student.full_name}
          size="xl"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{student.full_name}</p>
          <p className="muted mt-0.5">{user?.email || student.email || 'No email on file'}</p>
        </div>
      </div>

      <ImagePicker onChange={setFile} label="Choose a new photo" />

      {file && (
        <Button icon={Camera} loading={uploading} onClick={upload}>
          Upload photo
        </Button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- the page */
export default function StudentProfile() {
  const { logout, refreshSession } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const fetcher = useCallback(() => studentPortalService.profile(), [])
  const { data, loading, error, reload, refresh } = useApi(fetcher)

  const afterPhotoUpload = useCallback(() => {
    refreshSession()
    refresh()
  }, [refreshSession, refresh])

  const signOut = async () => {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Your hostel record and account settings"
        actions={
          <Button variant="secondary" icon={LogOut} loading={signingOut} onClick={signOut}>
            Sign out
          </Button>
        }
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        data={data}
        isEmpty={(value) => !value?.student}
        emptyTitle="Profile unavailable"
        emptyMessage="We could not load your hostel record. Please try again."
        loadingLabel="Loading your profile…"
        skeleton={
          <Card className="card-pad">
            <SkeletonRows rows={5} />
          </Card>
        }
      >
        {(profile) => {
          const student = profile.student
          const user = profile.user
          const editableFields = profile.editable_fields || EDITABLE_FIELDS

          return (
            <div className="space-y-4">
              {/* Official record ------------------------------------- */}
              <Card>
                <CardHeader
                  title="My hostel record"
                  subtitle="Kept by the hostel office"
                  icon={IdCard}
                  action={<StatusBadge kind="verification" value={student.verification_status} />}
                />
                <CardBody className="space-y-4">
                  <div
                    className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    role="note"
                  >
                    <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <p className="text-sm text-slate-600">
                      These details can only be changed by the hostel office. If something is wrong,
                      speak to your warden.
                    </p>
                  </div>

                  <InfoList
                    columns={3}
                    items={[
                      { label: 'Student ID', value: student.student_code },
                      { label: 'Full name', value: student.full_name },
                      { label: 'Date of birth', value: formatDate(student.date_of_birth) },
                      { label: 'Age', value: student.age ? `${student.age} years` : null },
                      { label: 'Gender', value: student.gender ? humanize(student.gender) : null },
                      { label: 'Class', value: student.student_class },
                      { label: 'Section', value: student.section },
                      { label: 'School', value: student.school_name },
                      {
                        label: 'Room',
                        value: student.hostel?.room_label || student.room_number,
                      },
                      { label: 'Bed', value: student.bed_number },
                      { label: 'Admission date', value: formatDate(student.admission_date) },
                      {
                        label: 'Verification',
                        value: <StatusBadge kind="verification" value={student.verification_status} />,
                      },
                      {
                        label: 'Current status',
                        value: <StatusBadge kind="studentStatus" value={student.current_status} />,
                      },
                      {
                        label: 'Status updated',
                        value: student.status_updated_at
                          ? formatDateTime(student.status_updated_at)
                          : null,
                      },
                      {
                        label: 'Login account',
                        value: user?.account_status ? (
                          <StatusBadge kind="account" value={user.account_status} />
                        ) : null,
                      },
                    ]}
                  />
                </CardBody>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Editable contact details ------------------------ */}
                <Card>
                  <CardHeader
                    title="My contact details"
                    subtitle="The only details you can change yourself"
                    icon={Phone}
                  />
                  <CardBody>
                    <ContactDetailsForm
                      student={student}
                      editableFields={editableFields}
                      onSaved={refresh}
                    />
                  </CardBody>
                </Card>

                {/* Parents ----------------------------------------- */}
                <Card>
                  <CardHeader
                    title="Parents & guardians"
                    subtitle="Managed by the hostel office"
                    icon={Users}
                  />
                  <CardBody className="pt-0">
                    {student.parents?.length ? (
                      <ul className="divide-y divide-slate-100">
                        {student.parents.map((parent) => (
                          <li key={parent.parent_id} className="py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {parent.full_name || 'Guardian'}
                                {parent.is_primary && (
                                  <span className="badge-info ml-2 text-[10px]">Primary</span>
                                )}
                              </p>
                              <StatusBadge kind="verification" value={parent.verification_status} />
                            </div>
                            <p className="muted mt-0.5">
                              {parent.relationship_type
                                ? humanize(parent.relationship_type)
                                : 'Guardian'}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              {parent.phone && <span>Phone: {parent.phone}</span>}
                              {parent.email && <span>Email: {parent.email}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted py-3">
                        No parent or guardian has been linked to your record yet.
                      </p>
                    )}
                  </CardBody>
                </Card>

                {/* Photo ------------------------------------------- */}
                <Card>
                  <CardHeader title="My photo" subtitle="Used across the portal" icon={Camera} />
                  <CardBody>
                    <PhotoCard user={user} student={student} onUploaded={afterPhotoUpload} />
                  </CardBody>
                </Card>

                {/* Password ---------------------------------------- */}
                <Card>
                  <CardHeader
                    title="Change password"
                    subtitle="Keep your login private"
                    icon={KeyRound}
                  />
                  <CardBody>
                    <PasswordForm />
                  </CardBody>
                </Card>
              </div>

              {/* Sign out ------------------------------------------- */}
              <Card className="card-pad">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="section-title">Sign out</h2>
                    <p className="muted mt-0.5">
                      Sign out if you are using a shared phone or computer.
                    </p>
                  </div>
                  <Button variant="danger" icon={LogOut} loading={signingOut} onClick={signOut}>
                    Sign out
                  </Button>
                </div>
              </Card>
            </div>
          )
        }}
      </DataState>
    </>
  )
}
