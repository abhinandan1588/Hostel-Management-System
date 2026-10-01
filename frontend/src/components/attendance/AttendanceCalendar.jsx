import { parseApiDate } from '../../utils/format'
import { describe } from '../../utils/labels'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const CELL_STYLES = {
  PRESENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ABSENT: 'bg-red-100 text-red-800 border-red-200',
  LEAVE: 'bg-sky-100 text-sky-800 border-sky-200',
  LATE: 'bg-amber-100 text-amber-800 border-amber-200',
}

const CELL_MARKS = { PRESENT: 'P', ABSENT: 'A', LEAVE: 'L', LATE: 'T' }

/**
 * Month grid of attendance.
 *
 * Each day shows a letter code as well as a colour so the calendar remains
 * readable without relying on colour perception.
 */
export function AttendanceCalendar({ calendar, className = '' }) {
  if (!calendar?.days?.length) return null

  const first = parseApiDate(calendar.days[0].date)
  // Monday-first grid.
  const leadingBlanks = first ? (first.getDay() + 6) % 7 : 0

  return (
    <div className={className}>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <div key={day} className="pb-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
            {day}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <div key={`blank-${index}`} aria-hidden="true" />
        ))}

        {calendar.days.map((day) => {
          const style = CELL_STYLES[day.status] || 'bg-slate-50 text-slate-400 border-slate-200'
          const meta = describe('attendance', day.status)
          return (
            <div
              key={day.date}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs ${style}`}
              title={`${day.date}: ${meta.label}`}
            >
              <span className="font-semibold tabular-nums">{day.day}</span>
              <span className="text-[9px] font-bold">{CELL_MARKS[day.status] || '·'}</span>
              <span className="sr-only">{meta.label}</span>
            </div>
          )
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
        {Object.entries(CELL_MARKS).map(([status, mark]) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[9px] font-bold ${CELL_STYLES[status]}`}
            >
              {mark}
            </span>
            {describe('attendance', status).label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[9px] font-bold text-slate-400">
            ·
          </span>
          Not marked
        </li>
      </ul>
    </div>
  )
}

/** Present / absent / leave / late tiles for a period summary. */
export function AttendanceSummaryGrid({ summary, className = '' }) {
  if (!summary) return null
  const cells = [
    { label: 'Present', value: summary.present, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Absent', value: summary.absent, tone: 'text-red-700 bg-red-50' },
    { label: 'Leave', value: summary.leave, tone: 'text-sky-700 bg-sky-50' },
    { label: 'Late', value: summary.late, tone: 'text-amber-700 bg-amber-50' },
  ]
  return (
    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${className}`}>
      {cells.map((cell) => (
        <div key={cell.label} className={`rounded-xl px-3 py-2.5 text-center ${cell.tone}`}>
          <p className="text-lg font-bold tabular-nums">{cell.value ?? 0}</p>
          <p className="text-[11px] font-semibold">{cell.label}</p>
        </div>
      ))}
    </div>
  )
}

export default AttendanceCalendar
