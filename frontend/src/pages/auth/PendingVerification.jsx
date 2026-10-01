import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, LogOut, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'react-toastify'

import { Button, DataState, InfoList } from '../../components/common'
import { useAuth } from '../../context/auth'
import { useApi } from '../../hooks'
import { parentPortalService } from '../../services'

const STEPS = [
  { key: 'submitted', label: 'Registration submitted', done: true },
  { key: 'review', label: 'Hostel office review', done: false },
  { key: 'access', label: 'Access to your child’s records', done: false },
]

export default function PendingVerification() {
  const { user, logout, refreshSession } = useAuth()
  const navigate = useNavigate()

  const fetcher = useCallback(() => parentPortalService.status(), [])
  const { data, loading, error, reload } = useApi(fetcher)

  const recheck = async () => {
    const [status] = await Promise.all([reload(), refreshSession()])
    if (status?.verification_status === 'VERIFIED') {
      toast.success('Your account has been verified.')
      navigate('/parent/dashboard', { replace: true })
    } else if (status?.verification_status === 'REJECTED') {
      toast.error('Your registration was not approved.')
    } else {
      toast.info('Still pending. The hostel office has not reviewed your account yet.')
    }
  }

  const rejected = data?.verification_status === 'REJECTED'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="card card-pad">
          <DataState
            loading={loading}
            error={error}
            data={data}
            onRetry={reload}
            isEmpty={false}
            loadingLabel="Checking your verification status…"
          >
            {() => (
              <>
                <span
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                    rejected ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {rejected ? (
                    <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Clock className="h-6 w-6" aria-hidden="true" />
                  )}
                </span>

                <h1 className="mt-4 text-xl font-bold text-slate-900">
                  {rejected ? 'Registration not approved' : 'Awaiting verification'}
                </h1>
                <p className="muted mt-1.5">
                  {rejected
                    ? 'The hostel office could not approve your registration.'
                    : `Hello ${user?.full_name?.split(' ')[0] || 'there'}, your account is being reviewed by the hostel office.`}
                </p>

                {rejected && data?.rejection_reason && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <p className="font-semibold">Reason</p>
                    <p className="mt-0.5">{data.rejection_reason}</p>
                  </div>
                )}

                {!rejected && (
                  <ol className="mt-5 space-y-3">
                    {STEPS.map((step, index) => {
                      const isDone = index === 0
                      const isCurrent = index === 1
                      return (
                        <li key={step.key} className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isDone
                                ? 'bg-emerald-500 text-white'
                                : isCurrent
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isDone ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : index + 1}
                          </span>
                          <span
                            className={`text-sm ${isDone || isCurrent ? 'font-semibold text-slate-800' : 'text-slate-500'}`}
                          >
                            {step.label}
                            {isCurrent && <span className="ml-2 badge-warning text-[10px]">In progress</span>}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                )}

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <InfoList
                    columns={2}
                    items={[
                      { label: 'Account email', value: user?.email },
                      { label: 'Submitted admission ID', value: data?.claimed_student_code },
                      {
                        label: 'Verification status',
                        value: (data?.verification_status || '').replace(/_/g, ' ').toLowerCase(),
                      },
                      {
                        label: 'Children linked',
                        value: data?.children_linked ?? 0,
                      },
                    ]}
                  />
                </div>

                <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Your child&apos;s attendance, health, meals and progress records stay private until
                  an administrator confirms your relationship to the student.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button icon={RefreshCw} onClick={recheck}>
                    Check status again
                  </Button>
                  <Button variant="secondary" icon={LogOut} onClick={() => logout()}>
                    Sign out
                  </Button>
                </div>
              </>
            )}
          </DataState>
        </div>
      </div>
    </div>
  )
}
