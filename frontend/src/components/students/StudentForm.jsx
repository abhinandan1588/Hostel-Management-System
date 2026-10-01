import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Save } from 'lucide-react'

import {
  Button,
  CheckboxField,
  FormErrors,
  SelectField,
  TextArea,
  TextField,
  applyServerErrors,
} from '../common'

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
]

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const CREATE_FIELDS = [
  'student_code',
  'full_name',
  'date_of_birth',
  'gender',
  'blood_group',
  'student_class',
  'section',
  'school_name',
  'phone',
  'email',
  'admission_date',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relation',
  'bed_id',
  'notes',
  'account_email',
  'account_password',
]

function emptyToNull(values, keys) {
  const output = { ...values }
  keys.forEach((key) => {
    if (output[key] === '' || output[key] === undefined) output[key] = null
  })
  return output
}

/**
 * Create / edit student form.
 *
 * In edit mode the immutable identity fields (student code, bed, login account)
 * are managed from the profile page instead, so this form stays focused.
 */
export function StudentForm({ student, beds = [], parents = [], onSubmit, onCancel, submitting }) {
  const isEdit = Boolean(student)
  const [serverError, setServerError] = useState(null)
  const [createAccount, setCreateAccount] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      student_code: student?.student_code || '',
      full_name: student?.full_name || '',
      date_of_birth: student?.date_of_birth || '',
      gender: student?.gender || '',
      blood_group: student?.blood_group || '',
      student_class: student?.student_class || '',
      section: student?.section || '',
      school_name: student?.school_name || '',
      phone: student?.phone || '',
      email: student?.email || '',
      admission_date: student?.admission_date || new Date().toISOString().slice(0, 10),
      emergency_contact_name: student?.emergency_contact?.name || '',
      emergency_contact_phone: student?.emergency_contact?.phone || '',
      emergency_contact_relation: student?.emergency_contact?.relation || '',
      bed_id: student?.hostel?.bed_id || '',
      parent_id: '',
      notes: student?.notes || '',
      account_email: '',
      account_password: '',
    },
  })

  useEffect(() => {
    if (student) reset((current) => ({ ...current }))
  }, [student, reset])

  const submit = async (values) => {
    setServerError(null)
    const payload = emptyToNull(values, [
      'student_code',
      'date_of_birth',
      'gender',
      'blood_group',
      'section',
      'phone',
      'email',
      'admission_date',
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relation',
      'notes',
    ])

    if (isEdit) {
      delete payload.student_code
      delete payload.bed_id
      delete payload.parent_id
      delete payload.account_email
      delete payload.account_password
    } else {
      payload.bed_id = values.bed_id ? Number(values.bed_id) : null
      payload.parent_ids = values.parent_id ? [Number(values.parent_id)] : []
      delete payload.parent_id
      payload.create_account = createAccount
      if (!createAccount) {
        delete payload.account_email
        delete payload.account_password
      }
    }

    const result = await onSubmit(payload)
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, CREATE_FIELDS)
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      <FormErrors error={serverError} ignoreFields={CREATE_FIELDS} />

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Student details</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Full name"
            required
            error={errors.full_name?.message}
            {...register('full_name', {
              required: "Enter the student's full name.",
              minLength: { value: 2, message: 'Name is too short.' },
            })}
          />
          {!isEdit && (
            <TextField
              label="Student ID"
              hint="Leave blank to generate one automatically."
              error={errors.student_code?.message}
              {...register('student_code')}
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Date of birth"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            error={errors.date_of_birth?.message}
            {...register('date_of_birth')}
          />
          <SelectField
            label="Gender"
            placeholder="Select"
            options={GENDERS}
            error={errors.gender?.message}
            {...register('gender')}
          />
          <SelectField
            label="Blood group"
            placeholder="Select"
            options={BLOOD_GROUPS.map((value) => ({ value, label: value }))}
            error={errors.blood_group?.message}
            {...register('blood_group')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Class"
            required
            placeholder="Class 8"
            error={errors.student_class?.message}
            {...register('student_class', { required: 'Enter the class.' })}
          />
          <TextField label="Section" placeholder="A" error={errors.section?.message} {...register('section')} />
          <TextField
            label="Admission date"
            type="date"
            error={errors.admission_date?.message}
            {...register('admission_date')}
          />
        </div>

        <TextField
          label="School name"
          required
          placeholder="St. Xavier's High School"
          error={errors.school_name?.message}
          {...register('school_name', { required: 'Enter the school name.' })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Student phone"
            type="tel"
            hint="Only if the student owns a phone."
            error={errors.phone?.message}
            {...register('phone')}
          />
          <TextField label="Student email" type="email" error={errors.email?.message} {...register('email')} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Emergency contact</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Name"
            error={errors.emergency_contact_name?.message}
            {...register('emergency_contact_name')}
          />
          <TextField
            label="Phone"
            type="tel"
            error={errors.emergency_contact_phone?.message}
            {...register('emergency_contact_phone')}
          />
          <TextField
            label="Relation"
            placeholder="Uncle"
            error={errors.emergency_contact_relation?.message}
            {...register('emergency_contact_relation')}
          />
        </div>
      </fieldset>

      {!isEdit && (
        <>
          <fieldset className="space-y-4 border-t border-slate-100 pt-5">
            <legend className="text-sm font-semibold text-slate-900">Hostel & guardian</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Assign bed"
                placeholder={beds.length ? 'Select an available bed' : 'No beds available'}
                options={beds.map((bed) => ({
                  value: bed.id,
                  label: `${bed.room?.label || 'Room'} · Bed ${bed.bed_number}`,
                }))}
                hint="You can assign or change this later."
                error={errors.bed_id?.message}
                {...register('bed_id')}
              />
              <SelectField
                label="Link parent"
                placeholder={parents.length ? 'Select a verified parent' : 'No verified parents yet'}
                options={parents.map((parent) => ({
                  value: parent.id,
                  label: `${parent.full_name}${parent.phone ? ` · ${parent.phone}` : ''}`,
                }))}
                error={errors.parent_id?.message}
                {...register('parent_id')}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-slate-100 pt-5">
            <legend className="text-sm font-semibold text-slate-900">Student login (optional)</legend>
            <CheckboxField
              label="Create a login account for this student"
              hint="Only for students who have their own phone. They can view records and confirm activities, but never edit official records."
              checked={createAccount}
              onChange={(event) => setCreateAccount(event.target.checked)}
            />
            {createAccount && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Login email"
                  type="email"
                  required
                  error={errors.account_email?.message}
                  {...register('account_email', {
                    required: createAccount ? 'Enter a login email.' : false,
                  })}
                />
                <TextField
                  label="Temporary password"
                  type="text"
                  required
                  hint="At least 8 characters with a letter and a number."
                  error={errors.account_password?.message}
                  {...register('account_password', {
                    required: createAccount ? 'Set a temporary password.' : false,
                    minLength: { value: 8, message: 'Use at least 8 characters.' },
                  })}
                />
              </div>
            )}
          </fieldset>
        </>
      )}

      <TextArea
        label="Internal notes"
        rows={3}
        hint="Visible to administrators only."
        error={errors.notes?.message}
        {...register('notes')}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" icon={Save} loading={submitting}>
          {isEdit ? 'Save changes' : 'Add student'}
        </Button>
      </div>
    </form>
  )
}

export default StudentForm
