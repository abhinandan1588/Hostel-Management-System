import { Link } from 'react-router-dom'
import { Building2, HeartPulse, ShieldCheck, Utensils } from 'lucide-react'

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Verified access only',
    text: 'Parents are verified by the hostel office before any student information is shared.',
  },
  {
    icon: HeartPulse,
    title: 'Health kept transparent',
    text: 'Attendance, health updates and school movement are recorded by wardens every day.',
  },
  {
    icon: Utensils,
    title: 'See the daily routine',
    text: "Meal photos, study time and the full daily timeline, all in one place.",
  },
]

/** Split-screen wrapper shared by every authentication page. */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Marketing / context panel - desktop only */}
      <aside className="relative hidden w-1/2 flex-col justify-between bg-brand-800 p-10 text-white lg:flex xl:w-[55%]">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold">Hostel Manager</p>
              <p className="text-xs text-brand-200">Student monitoring platform</p>
            </div>
          </div>

          <h2 className="mt-14 max-w-lg text-3xl leading-snug font-bold xl:text-4xl">
            Reliable daily records for wardens. Real transparency for parents.
          </h2>
          <p className="mt-4 max-w-md text-brand-100">
            One place for attendance, health updates, meals, school movement and academic progress.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex max-w-md gap-3.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <item.icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-brand-200">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-brand-300">
          Student and parent data is private. Access is role based and every administrative action is
          logged.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex w-full flex-col justify-center px-4 py-10 sm:px-8 lg:w-1/2 xl:w-[45%]">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold text-slate-900">Hostel Manager</p>
              <p className="text-xs text-slate-500">Student monitoring platform</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="muted mt-1.5">{subtitle}</p>}

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}

          <p className="mt-10 text-center text-xs text-slate-400">
            Need help? Contact the hostel office.{' '}
            <Link to="/login" className="font-medium text-brand-700 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default AuthShell
