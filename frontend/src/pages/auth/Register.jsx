import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Info, UserPlus } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  FormErrors,
  SelectField,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { authService } from '../../services/authService'
import AuthShell from './AuthShell'

const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Uncle', 'Aunt', 'Other']

const FIELDS = [
  'full_name',
  'email',
  'phone',
  'password',
  'confirm_password',
  'address',
  'city',
  'relationship_to_student',
  'occupation',
  'alternate_phone',
  'student_code',
]

export default function Register() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState(null)
  const [submitted, setSubmitted] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
      address: '',
      city: '',
      relationship_to_student: 'Mother',
      occupation: '',
      alternate_phone: '',
      student_code: '',
    },
  })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      const result = await authService.register(values)
      setSubmitted(result)
      toast.success('Registration received. The hostel office will verify your account.')
    } catch (error) {
      const mapped = applyServerErrors(error, setError, FIELDS)
      if (!mapped) setServerError(error)
    }
  }

  if (submitted) {
    return (
      <AuthShell
        title="Registration received"
        subtitle="An administrator will review your details shortly."
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">Your account has been created.</p>
              <p className="mt-1">
                You can sign in now, but your child&apos;s records stay private until the hostel
                office verifies that you are their parent or guardian.
              </p>
            </div>
          </div>

          {submitted.matched_student ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Matched student
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {submitted.matched_student.full_name}
              </p>
              <p className="text-xs text-slate-500">
                {submitted.matched_student.student_code} ·{' '}
                {submitted.matched_student.student_class || 'Class not set'}
              </p>
            </div>
          ) : (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p>
                We could not find a student with that admission ID yet. The hostel office will link
                your child during verification.
              </p>
            </div>
          )}

          <Button className="w-full" onClick={() => navigate('/login')}>
            Continue to sign in
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Parent registration"
      subtitle="Create an account to follow your child's daily records."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormErrors error={serverError} ignoreFields={FIELDS} />

        <TextField
          label="Full name"
          required
          autoComplete="name"
          placeholder="Meera Kumar"
          error={errors.full_name?.message}
          {...register('full_name', {
            required: 'Enter your full name.',
            minLength: { value: 2, message: 'Name is too short.' },
          })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email', {
              required: 'Enter your email address.',
              pattern: { value: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/, message: 'Enter a valid email.' },
            })}
          />
          <TextField
            label="Phone number"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+91 98000 00011"
            error={errors.phone?.message}
            {...register('phone', {
              required: 'Enter your phone number.',
              minLength: { value: 7, message: 'Enter a valid phone number.' },
            })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            error={errors.password?.message}
            {...register('password', {
              required: 'Choose a password.',
              minLength: { value: 8, message: 'Use at least 8 characters.' },
              validate: (value) =>
                (/[A-Za-z]/.test(value) && /\d/.test(value)) ||
                'Include at least one letter and one number.',
            })}
          />
          <TextField
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            error={errors.confirm_password?.message}
            {...register('confirm_password', {
              required: 'Re-enter your password.',
              validate: (value) => value === getValues('password') || 'Passwords do not match.',
            })}
          />
        </div>

        <TextArea
          label="Address"
          required
          rows={2}
          placeholder="House, street, city"
          error={errors.address?.message}
          {...register('address', {
            required: 'Enter your address.',
            minLength: { value: 5, message: 'Address is too short.' },
          })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="City" placeholder="Ranchi" error={errors.city?.message} {...register('city')} />
          <SelectField
            label="Relationship with student"
            required
            options={RELATIONSHIPS.map((value) => ({ value, label: value }))}
            error={errors.relationship_to_student?.message}
            {...register('relationship_to_student', { required: 'Select your relationship.' })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Occupation"
            placeholder="School teacher"
            error={errors.occupation?.message}
            {...register('occupation')}
          />
          <TextField
            label="Alternate phone"
            type="tel"
            placeholder="Optional"
            error={errors.alternate_phone?.message}
            {...register('alternate_phone')}
          />
        </div>

        <TextField
          label="Student admission / registration ID"
          required
          placeholder="HMS2026001"
          hint="Printed on your child's hostel admission slip. The office uses it to link your account."
          error={errors.student_code?.message}
          {...register('student_code', {
            required: "Enter your child's admission ID.",
            minLength: { value: 2, message: 'That ID looks too short.' },
          })}
        />

        <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <Info className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p>
            Your account starts as <strong>pending verification</strong>. The hostel office confirms
            your relationship to the student before any records are shared with you.
          </p>
        </div>

        <Button type="submit" icon={UserPlus} loading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
