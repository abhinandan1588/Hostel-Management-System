import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { toast } from 'react-toastify'

import { Button, FormErrors, TextField, applyServerErrors } from '../../components/common'
import { authService } from '../../services/authService'
import AuthShell from './AuthShell'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenFromUrl = params.get('token') || ''
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { token: tokenFromUrl, password: '', confirm_password: '' },
  })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      await authService.resetPassword(values)
      toast.success('Password updated. Please sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      const mapped = applyServerErrors(error, setError, ['token', 'password', 'confirm_password'])
      if (!mapped) setServerError(error)
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a password you have not used before."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormErrors error={serverError} ignoreFields={['token', 'password', 'confirm_password']} />

        {!tokenFromUrl && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            <p>Paste the reset token from your email below.</p>
          </div>
        )}

        <TextField
          label="Reset token"
          required
          readOnly={Boolean(tokenFromUrl)}
          inputClassName={tokenFromUrl ? 'bg-slate-100 font-mono text-xs' : 'font-mono text-xs'}
          error={errors.token?.message}
          {...register('token', { required: 'The reset token is required.' })}
        />

        <TextField
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.password?.message}
          {...register('password', {
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
            required: 'Re-enter your new password.',
            validate: (value) => value === getValues('password') || 'Passwords do not match.',
          })}
        />

        <Button type="submit" icon={ShieldCheck} loading={isSubmitting} className="w-full">
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
