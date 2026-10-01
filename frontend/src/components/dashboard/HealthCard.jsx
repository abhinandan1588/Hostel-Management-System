import { Activity, HeartPulse, Stethoscope, Thermometer, TriangleAlert } from 'lucide-react'

import { formatDateTime } from '../../utils/format'
import { describe } from '../../utils/labels'
import { Badge, StatusBadge } from '../common/Primitives'

const TONE_SHELL = {
  success: 'border-emerald-200 bg-emerald-50',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-red-200 bg-red-50',
  info: 'border-sky-200 bg-sky-50',
  neutral: 'border-slate-200 bg-slate-50',
}

const TONE_ICON = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-600',
  info: 'bg-sky-500',
  neutral: 'bg-slate-400',
}

/**
 * Current health status panel.
 *
 * Status is conveyed with an icon, a text label and colour together - never
 * colour alone.
 */
export function HealthCard({ health, className = '' }) {
  const status = health?.status || 'HEALTHY'
  const meta = describe('health', status)
  const record = health?.record
  const Icon = status === 'HEALTHY' ? HeartPulse : status === 'HOSPITALIZED' ? Stethoscope : Thermometer

  return (
    <div className={`rounded-2xl border p-4 ${TONE_SHELL[meta.tone]} ${className}`}>
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${TONE_ICON[meta.tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{meta.label}</p>
            {health?.is_urgent && (
              <Badge tone="danger" icon={TriangleAlert}>
                Urgent
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            {health?.recorded_at
              ? `Last updated ${formatDateTime(health.recorded_at)}`
              : 'No health issues recorded'}
          </p>

          {record && (
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
              {record.symptoms && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-slate-500">Symptoms</dt>
                  <dd className="text-slate-800">{record.symptoms}</dd>
                </div>
              )}
              {record.temperature && (
                <div>
                  <dt className="font-semibold text-slate-500">Temperature</dt>
                  <dd className="text-slate-800">{record.temperature} °C</dd>
                </div>
              )}
              {record.medicine_given && (
                <div>
                  <dt className="font-semibold text-slate-500">Medicine given</dt>
                  <dd className="text-slate-800">{record.medicine_given}</dd>
                </div>
              )}
              {record.doctor_visited && (
                <div>
                  <dt className="font-semibold text-slate-500">Doctor</dt>
                  <dd className="text-slate-800">{record.doctor_name || 'Consulted'}</dd>
                </div>
              )}
              {record.hospital_visit && (
                <div>
                  <dt className="font-semibold text-slate-500">Hospital</dt>
                  <dd className="text-slate-800">{record.hospital_name || 'Visited'}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-slate-500">Recovery</dt>
                <dd>
                  <StatusBadge kind="recovery" value={record.recovery_status} />
                </dd>
              </div>
              {record.medical_remarks && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-slate-500">Remarks</dt>
                  <dd className="text-slate-800">{record.medical_remarks}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}

/** One entry in a student's health history. */
export function HealthHistoryItem({ record, actions }) {
  const meta = describe('health', record.status)
  return (
    <li className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
      <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${TONE_ICON[meta.tone]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="health" value={record.status} />
            <StatusBadge kind="severity" value={record.severity} />
            <StatusBadge kind="recovery" value={record.recovery_status} />
          </div>
          <p className="text-xs text-slate-400">{formatDateTime(record.recorded_at)}</p>
        </div>
        {record.symptoms && <p className="mt-1.5 text-sm text-slate-700">{record.symptoms}</p>}
        {record.description && <p className="mt-0.5 text-xs text-slate-500">{record.description}</p>}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {record.temperature && (
            <span className="inline-flex items-center gap-1">
              <Thermometer className="h-3 w-3" aria-hidden="true" />
              {record.temperature} °C
            </span>
          )}
          {record.medicine_given && (
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3" aria-hidden="true" />
              {record.medicine_given}
            </span>
          )}
          {record.doctor_visited && <span>Doctor: {record.doctor_name || 'Yes'}</span>}
          {record.hospital_visit && <span>Hospital: {record.hospital_name || 'Yes'}</span>}
          <span>Recorded by {record.recorded_by}</span>
        </div>
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </li>
  )
}

export default HealthCard
