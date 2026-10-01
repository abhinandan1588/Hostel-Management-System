import { useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, HeartPulse, Lock, ShieldCheck, TriangleAlert } from 'lucide-react'

import {
  Avatar,
  Card,
  DataState,
  Loader,
  PageHeader,
  Section,
} from '../../components/common'
import { HealthCard, HealthHistoryItem } from '../../components/dashboard/HealthCard'
import { useApi } from '../../hooks'
import { parentPortalService } from '../../services'
import { formatDateTime } from '../../utils/format'

function ChildSwitcher({ items, value, onChange, id = 'health-child' }) {
  if (!items?.length || items.length < 2) return null
  return (
    <Card className="card-pad mb-4">
      <label htmlFor={id} className="label">
        Viewing records for
      </label>
      <select
        id={id}
        className="input sm:hidden"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {items.map((child) => (
          <option key={child.id} value={child.id}>
            {child.full_name}
            {child.student_class ? ` · Class ${child.student_class}` : ''}
          </option>
        ))}
      </select>
      <div className="hidden flex-wrap gap-2 sm:flex" role="group" aria-label="Choose a child">
        {items.map((child) => {
          const active = String(child.id) === String(value)
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onChange(String(child.id))}
              aria-pressed={active}
              className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Avatar src={child.profile_photo} name={child.full_name} size="xs" />
              {child.full_name}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

export default function ParentChildHealth() {
  const { id } = useParams()
  const navigate = useNavigate()

  const fetcher = useCallback(() => parentPortalService.health(id), [id])
  const { data, loading, error, reload } = useApi(fetcher)

  const siblingsFetcher = useCallback(() => parentPortalService.children(), [])
  const { data: siblings } = useApi(siblingsFetcher)
  const child = siblings?.find((item) => String(item.id) === String(id))

  return (
    <>
      <PageHeader
        title="Health"
        subtitle={child?.full_name ? `${child.full_name} · current status and history` : 'Current status and history'}
        actions={
          <Link to={`/parent/children/${id}`} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Profile
          </Link>
        }
      />

      <ChildSwitcher
        items={siblings}
        value={id}
        onChange={(nextId) => navigate(`/parent/children/${nextId}/health`)}
      />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<Loader label="Loading health records…" />}
      >
        {(payload) => {
          const current = payload.current
          const timeline = payload.timeline || []

          return (
            <div className="space-y-4">
              {current?.is_urgent && (
                <div
                  className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3.5"
                  role="alert"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                    <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-red-900">
                      This needs your attention
                    </p>
                    <p className="mt-0.5 text-sm text-red-800">
                      {child?.full_name || 'Your child'} is currently marked as{' '}
                      {current.label?.toLowerCase() || 'unwell'}. The hostel office has been
                      notified and staff are monitoring the situation. Call the hostel if you need
                      an update.
                    </p>
                    {current.recorded_at && (
                      <p className="mt-1 text-[11px] text-red-600">
                        Last updated {formatDateTime(current.recorded_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Section title="Current health status" icon={HeartPulse}>
                <HealthCard health={current} />
              </Section>

              <Section
                title="Health history"
                subtitle={
                  timeline.length
                    ? `${timeline.length} record${timeline.length === 1 ? '' : 's'}`
                    : 'Nothing recorded yet'
                }
                icon={ShieldCheck}
              >
                {timeline.length ? (
                  <ul>
                    {timeline.map((record) => (
                      <HealthHistoryItem key={record.id} record={record} />
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    No health issues have ever been recorded for {child?.full_name || 'your child'}.
                  </p>
                )}
              </Section>

              <Card className="card-pad">
                <p className="flex items-start gap-2 text-xs text-slate-500">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Health records are created and updated only by hostel staff and are visible only
                  to guardians the hostel office has verified. You cannot edit these records; send a
                  suggestion if something needs correcting.
                </p>
              </Card>
            </div>
          )
        }}
      </DataState>
    </>
  )
}
