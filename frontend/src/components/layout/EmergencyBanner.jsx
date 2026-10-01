import { useCallback, useEffect, useState } from 'react'
import { Siren, X } from 'lucide-react'
import { toast } from 'react-toastify'

import { emergencyService } from '../../services'
import { labelOf } from '../../utils/labels'
import { timeAgo } from '../../utils/format'

/**
 * Visually prominent banner for active emergency alerts. Shown to parents and
 * students only, so ordinary announcements never look like an emergency.
 */
export function EmergencyBanner() {
  const [alerts, setAlerts] = useState([])
  const [dismissed, setDismissed] = useState(() => new Set())

  const load = useCallback(() => {
    emergencyService
      .mine()
      .then((data) => setAlerts(Array.isArray(data) ? data : []))
      .catch(() => setAlerts([]))
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [load])

  const acknowledge = async (alert) => {
    try {
      await emergencyService.acknowledge(alert.id)
      toast.success('Alert acknowledged. The hostel office has been informed.')
      setDismissed((current) => new Set(current).add(alert.id))
    } catch (error) {
      toast.error(error.message)
    }
  }

  const visible = alerts.filter((alert) => !dismissed.has(alert.id))
  if (!visible.length) return null

  return (
    <div className="space-y-2 px-3 pt-3 sm:px-4" role="alert" aria-live="assertive">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className="flex flex-wrap items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3.5 shadow-sm"
        >
          <span className="inline-flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-xl bg-red-600 text-white">
            <Siren className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-wider text-red-700 uppercase">
              Emergency · {labelOf('emergency', alert.alert_type)}
            </p>
            <p className="text-sm font-bold text-red-900">{alert.title}</p>
            <p className="mt-0.5 text-sm text-red-800">{alert.message}</p>
            <p className="mt-1 text-[11px] text-red-600">
              {timeAgo(alert.created_at)}
              {alert.student_name ? ` · regarding ${alert.student_name}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => acknowledge(alert)}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              I have seen this
            </button>
            <button
              type="button"
              onClick={() => setDismissed((current) => new Set(current).add(alert.id))}
              className="rounded-lg p-1.5 text-red-500 hover:bg-red-100"
              aria-label="Hide this alert"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default EmergencyBanner
