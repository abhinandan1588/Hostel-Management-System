import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { KeyRound, MailCheck } from 'lucide-react'

import { Button, FormErrors, TextField, applyServerErrors } from '../../components/common'
import { authService } from '../../services/authService'
import AuthShell from './AuthShell'

export default function ForgotPassword() {
  const [serverError, setServerError] = useState(null)
  const [result, setResult] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '' } })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      const data = await authService.forgotPassword(values.email.trim())
      setResult(data || {})
    } catch (error) {
      const mapped = applyServerErrors(error, setError, ['email'])
      if (!mapped) setServerError(error)
    }
  }

  if (result) {
    return (
      <AuthShell title="Check your email" subtitle="We have sent password reset instructions.">
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
            <MailCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p>
              If an account exists for that email address, a reset link has been sent. The link
              expires in 60 minutes.
            </p>
          </div>

          {/* Development convenience: the API returns the token when SMTP is off. */}
          {result.reset_token && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm">
              <p className="font-semibold text-amber-900">
                Email delivery is disabled in this environment
              </p>
              <p className="mt-1 text-amber-800">Use this reset link directly:</p>
              <Link
                to={`/reset-password?token=${result.reset_token}`}
                className="mt-2 inline-block font-semibold break-all text-brand-700 hover:underline"
              >
                Open reset password page
              </Link>
            </div>
          )}

          <Link to="/login" className="btn-secondary w-full">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter the email address on your account and we will send a reset link."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormErrors error={serverError} ignoreFields={['email']} />
        <TextField
          label="Email address"
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email', {
            required: 'Enter your email address.',
            pattern: { value: /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/, message: 'Enter a valid email.' },
          })}
        />
        <Button type="submit" icon={KeyRound} loading={isSubmitting} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  )
}
