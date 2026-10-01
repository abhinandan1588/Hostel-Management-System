import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  BedDouble,
  CalendarCheck,
  GraduationCap,
  ListChecks,
  School,
  TrendingUp,
  UserRoundX,
} from 'lucide-react'

import {
  Avatar,
  Card,
  DataState,
  PageHeader,
  SkeletonCards,
  StatusBadge,
} from '../../components/common'
import { useApi } from '../../hooks'
import { parentPortalService } from '../../services'

const QUICK_LINKS = [
  { key: 'daily-activity', label: 'Daily activity', icon: ListChecks },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'progress', label: 'Progress', icon: TrendingUp },
]

export default function ParentChildren() {
  const fetcher = useCallback(() => parentPortalService.children(), [])
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <>
      <PageHeader
        title="My children"
        subtitle={
          data?.length
            ? `${data.length} ${data.length === 1 ? 'child' : 'children'} linked to your account`
            : 'Records linked to your account by the hostel office'
        }
      />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        loadingLabel="Loading your children…"
        skeleton={<SkeletonCards count={2} />}
        emptyIcon={UserRoundX}
        emptyTitle="No child linked yet"
        emptyMessage="The hostel office has not linked a child to your account yet. Once a warden links your child's record you will see their details here."
      >
        {(children) => (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="card-pad">
                <div className="flex items-start gap-3">
                  <Avatar src={child.profile_photo} name={child.full_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/parent/children/${child.id}`}
                      className="block truncate text-base font-bold text-slate-900 hover:text-brand-700"
                    >
                      {child.full_name}
                    </Link>
                    <p className="muted truncate">Student ID {child.student_code}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge kind="studentStatus" value={child.current_status} />
                      <StatusBadge
                        kind="attendance"
                        value={child.today_attendance}
                        fallback="Attendance not marked"
                      />
                      <StatusBadge kind="health" value={child.health_status} />
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Class
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-800">
                      <GraduationCap className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      {child.student_class || 'Not recorded'}
                      {child.section ? ` · ${child.section}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      School
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm break-words text-slate-800">
                      <School className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      {child.school_name || 'Not recorded'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Room / bed
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-800">
                      <BedDouble className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      {child.room_number
                        ? `${child.room_number}${child.bed_number ? ` · Bed ${child.bed_number}` : ''}`
                        : 'Not assigned'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Record status
                    </dt>
                    <dd className="mt-0.5">
                      <StatusBadge kind="verification" value={child.verification_status} />
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
                  <Link
                    to={`/parent/children/${child.id}`}
                    className="btn-primary w-full sm:w-auto"
                  >
                    View profile
                  </Link>
                  {QUICK_LINKS.map((link) => (
                    <Link
                      key={link.key}
                      to={`/parent/children/${child.id}/${link.key}`}
                      className="btn-secondary w-full sm:w-auto"
                    >
                      <link.icon className="h-4 w-4" aria-hidden="true" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </DataState>

      <p className="muted mt-5">
        These records are maintained by hostel staff. If something looks wrong, send a suggestion
        from the Suggestions page and the office will review it.
      </p>
    </>
  )
}
