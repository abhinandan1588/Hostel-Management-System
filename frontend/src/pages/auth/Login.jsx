import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { toast } from 'react-toastify'

import { Button, FormErrors, TextField, applyServerErrors } from '../../components/common'
import { homePathFor, useAuth } from '../../context/auth'
import AuthShell from './AuthShell'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { identifier: '', password: '' } })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      const session = await login(values.identifier.trim(), values.password)
      toast.success(`Welcome back, ${session.user.full_name.split(' ')[0]}.`)
      const target = location.state?.from || homePathFor(session.user, session.profile)
      navigate(target, { replace: true })
    } catch (error) {
      const mapped = applyServerErrors(error, setError, ['identifier', 'password'])
      if (!mapped) setServerError(error)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Administrators, parents and students all sign in here."
      footer={
        <>
          New parent?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormErrors error={serverError} ignoreFields={['identifier', 'password']} />

        <TextField
          label="Email, username or phone"
          type="text"
          autoComplete="username"
          autoFocus
          placeholder="you@example.com"
          required
          error={errors.identifier?.message}
          {...register('identifier', {
            required: 'Enter your email, username or phone number.',
            minLength: { value: 3, message: 'That is too short to be valid.' },
          })}
        />

        <div>
          <div className="relative">
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              inputClassName="pr-11"
              error={errors.password?.message}
              {...register('password', { required: 'Enter your password.' })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute top-[34px] right-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <Button type="submit" icon={LogIn} loading={isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold text-slate-700">Demo accounts (seeded data)</p>
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
          <li>
            Admin: <span className="font-mono">admin@hostel.test</span>
          </li>
          <li>
            Parent: <span className="font-mono">meera.parent@hostel.test</span>
          </li>
          <li>
            Student: <span className="font-mono">rahul.student@hostel.test</span>
          </li>
          <li className="pt-0.5">
            Password: <span className="font-mono">Password123</span>
          </li>
        </ul>
      </div>
    </AuthShell>
  )
}
