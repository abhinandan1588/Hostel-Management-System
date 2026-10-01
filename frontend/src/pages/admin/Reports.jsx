import { useCallback, useMemo, useState } from 'react'
import {
  BedDouble,
  BookOpen,
  CalendarCheck,
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  School,
  Table2,
  Users,
  Utensils,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
  DataState,
  EmptyState,
  PageHeader,
  SelectField,
  SkeletonCards,
  SkeletonRows,
  TextField,
} from '../../components/common'
import { useApi } from '../../hooks'
import { reportService, studentService } from '../../services'
import { formatNumber, monthName, shiftDate, todayISO } from '../../utils/format'
import { HEALTH, VERIFICATION, optionsFrom } from '../../utils/labels'
import { downloadBlob } from '../../utils/download'

const NOW = new Date()

const YEAR_OPTIONS = [0, 1, 2].map((offset) => {
  const year = NOW.getFullYear() - offset
  return { value: year, label: String(year) }
})

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: monthName(index + 1),
}))

/** Which parameters each report accepts, plus presentation metadata. */
const REPORTS = {
  'daily-attendance': {
    icon: CalendarCheck,
    description: 'Hostel attendance for a single day, student by student.',
    params: ['date'],
  },
  'monthly-attendance': {
    icon: CalendarRange,
    description: 'Attendance percentage per student for a whole month.',
    params: ['year', 'month'],
  },
  'student-progress': {
    icon: BookOpen,
    description: 'Development scores and academic averages.',
    params: ['student_id', 'student_class'],
  },
  health: {
    icon: HeartPulse,
    description: 'Health records raised in a date range.',
    params: ['start_date', 'end_date', 'status'],
  },
  meals: {
    icon: Utensils,
    description: 'Meals served and photographed in a date range.',
    params: ['start_date', 'end_date'],
  },
  'school-attendance': {
    icon: School,
    description: 'School departures and returns in a date range.',
    params: ['start_date', 'end_date', 'student_class'],
  },
  'parent-list': {
    icon: Users,
    description: 'Parent directory with verification state.',
    params: ['verification_status'],
  },
  'student-list': {
    icon: Users,
    description: 'Student directory with class, room and guardian.',
    params: ['student_class', 'include_inactive'],
  },
  'hostel-occupancy': {
    icon: BedDouble,
    description: 'Rooms, beds and current occupancy. No parameters needed.',
    params: [],
  },
}

const DEFAULT_PARAMS = {
  date: todayISO(),
  year: NOW.getFullYear(),
  month: NOW.getMonth() + 1,
  student_id: '',
  student_class: '',
  status: '',
  verification_status: '',
  start_date: shiftDate(todayISO(), -30),
  end_date: todayISO(),
  include_inactive: false,
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export default function AdminReports() {
  const [type, setType] = useState('daily-attendance')
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [request, setRequest] = useState(null)
  const [downloading, setDownloading] = useState(null)

  const catalogueFetcher = useCallback(() => reportService.catalogue(), [])
  const {
    data: catalogue,
    loading: catalogueLoading,
    error: catalogueError,
    reload: reloadCatalogue,
  } = useApi(catalogueFetcher)

  const optionsFetcher = useCallback(() => studentService.filterOptions(), [])
  const { data: filterOptions } = useApi(optionsFetcher)

  const studentsFetcher = useCallback(() => studentService.list({ per_page: 100 }), [])
  const { data: students } = useApi(studentsFetcher)

  const previewFetcher = useCallback(
    () => (request ? reportService.generate(request.type, request.params) : Promise.resolve(null)),
    [request],
  )
  const {
    data: preview,
    loading: previewLoading,
    error: previewError,
    reload: reloadPreview,
  } = useApi(previewFetcher)

  const definition = REPORTS[type] || { params: [] }
  const supported = definition.params

  const activeParams = useMemo(() => {
    const cleaned = {}
    supported.forEach((key) => {
      const value = params[key]
      if (value === '' || value === null || value === undefined) return
      if (key === 'include_inactive') {
        if (value) cleaned[key] = true
        return
      }
      cleaned[key] = value
    })
    return cleaned
  }, [params, supported])

  const reportName = useMemo(() => {
    const entry = (catalogue?.reports || []).find((row) => row.type === type)
    return entry?.name || type
  }, [catalogue, type])

  const formats = catalogue?.formats || ['json', 'csv', 'pdf']

  const setParam = (key, value) => setParams((current) => ({ ...current, [key]: value }))

  const runPreview = () => setRequest({ type, params: activeParams })

  const handleDownload = async (format) => {
    setDownloading(format)
    try {
      const response = await reportService.download(type, activeParams, format)
      const filename = downloadBlob(response, `${type}.${format}`)
      toast.success(`Downloaded ${filename}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDownloading(null)
    }
  }

  const extras = useMemo(() => {
    if (!preview) return []
    const skip = ['type', 'title', 'headers', 'rows', 'row_count']
    return Object.entries(preview).filter(
      ([key, value]) =>
        !skip.includes(key) &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'),
    )
  }, [preview])

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Preview any report on screen, then export it as CSV or PDF."
      />

      <Card className="mb-4">
        <CardHeader title="Choose a report" subtitle="Nine reports cover the whole hostel record" />
        <CardBody>
          <DataState
            loading={catalogueLoading}
            error={catalogueError}
            data={catalogue?.reports}
            onRetry={reloadCatalogue}
            loadingLabel="Loading report catalogue…"
            skeleton={<SkeletonCards count={6} />}
            emptyIcon={FileText}
            emptyTitle="No reports available"
            emptyMessage="The report catalogue could not be loaded."
          >
            {(reports) => (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {reports.map((report) => {
                  const meta = REPORTS[report.type] || {}
                  const Icon = meta.icon || FileText
                  const isActive = report.type === type
                  return (
                    <button
                      key={report.type}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setType(report.type)
                        setRequest(null)
                      }}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                        isActive
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isActive ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">
                          {report.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {meta.description || 'Tabular export of hostel records.'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </DataState>
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title={`${reportName} parameters`}
          subtitle={
            supported.length
              ? 'Only the filters this report supports are shown.'
              : 'This report needs no parameters.'
          }
        />
        <CardBody className="space-y-4">
          {supported.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {supported.includes('date') && (
                <TextField
                  label="Date"
                  type="date"
                  max={todayISO()}
                  value={params.date}
                  onChange={(event) => setParam('date', event.target.value)}
                />
              )}
              {supported.includes('year') && (
                <SelectField
                  label="Year"
                  options={YEAR_OPTIONS}
                  value={params.year}
                  onChange={(event) => setParam('year', Number(event.target.value))}
                />
              )}
              {supported.includes('month') && (
                <SelectField
                  label="Month"
                  options={MONTH_OPTIONS}
                  value={params.month}
                  onChange={(event) => setParam('month', Number(event.target.value))}
                />
              )}
              {supported.includes('start_date') && (
                <TextField
                  label="From"
                  type="date"
                  max={todayISO()}
                  value={params.start_date}
                  onChange={(event) => setParam('start_date', event.target.value)}
                />
              )}
              {supported.includes('end_date') && (
                <TextField
                  label="To"
                  type="date"
                  max={todayISO()}
                  value={params.end_date}
                  onChange={(event) => setParam('end_date', event.target.value)}
                />
              )}
              {supported.includes('student_id') && (
                <SelectField
                  label="Student"
                  placeholder="All students"
                  options={(students || []).map((student) => ({
                    value: student.id,
                    label: `${student.full_name} · ${student.student_code}`,
                  }))}
                  value={params.student_id}
                  onChange={(event) => setParam('student_id', event.target.value)}
                />
              )}
              {supported.includes('student_class') && (
                <SelectField
                  label="Class"
                  placeholder="All classes"
                  options={(filterOptions?.classes || []).map((value) => ({ value, label: value }))}
                  value={params.student_class}
                  onChange={(event) => setParam('student_class', event.target.value)}
                />
              )}
              {supported.includes('status') && (
                <SelectField
                  label="Health status"
                  placeholder="Any status"
                  options={optionsFrom(HEALTH)}
                  value={params.status}
                  onChange={(event) => setParam('status', event.target.value)}
                />
              )}
              {supported.includes('verification_status') && (
                <SelectField
                  label="Verification"
                  placeholder="Any status"
                  options={optionsFrom(VERIFICATION)}
                  value={params.verification_status}
                  onChange={(event) => setParam('verification_status', event.target.value)}
                />
              )}
              {supported.includes('include_inactive') && (
                <CheckboxField
                  label="Include archived students"
                  className="self-end pb-2.5"
                  checked={params.include_inactive}
                  onChange={(event) => setParam('include_inactive', event.target.checked)}
                />
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button icon={Table2} onClick={runPreview}>
              Preview
            </Button>
            {formats.includes('csv') && (
              <Button
                variant="secondary"
                icon={FileSpreadsheet}
                loading={downloading === 'csv'}
                disabled={Boolean(downloading)}
                onClick={() => handleDownload('csv')}
              >
                Export CSV
              </Button>
            )}
            {formats.includes('pdf') && (
              <Button
                variant="secondary"
                icon={Download}
                loading={downloading === 'pdf'}
                disabled={Boolean(downloading)}
                onClick={() => handleDownload('pdf')}
              >
                Export PDF
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={preview?.title || 'Preview'}
          subtitle={
            preview ? `${formatNumber(preview.row_count)} row${preview.row_count === 1 ? '' : 's'}` : undefined
          }
          icon={FileText}
          action={
            preview && (
              <Badge tone="neutral">{preview.type}</Badge>
            )
          }
        />
        <CardBody>
          <DataState
            loading={previewLoading}
            error={previewError}
            data={preview}
            onRetry={reloadPreview}
            loadingLabel="Generating report…"
            skeleton={<SkeletonRows rows={6} />}
            emptyIcon={Table2}
            emptyTitle="Nothing previewed yet"
            emptyMessage="Pick a report, set the parameters and select Preview."
          >
            {(report) =>
              report.row_count === 0 ? (
                <EmptyState
                  icon={Table2}
                  title="No records for these parameters"
                  message="Widen the date range or clear a filter, then preview again."
                />
              ) : (
                <>
                  {extras.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {extras.map(([key, value]) => (
                        <Badge key={key} tone="info">
                          {key.replace(/_/g, ' ')}: {formatCell(value)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {(report.headers || []).map((header) => (
                            <th key={header} scope="col">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(report.rows || []).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="whitespace-nowrap">
                                {formatCell(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted mt-3">
                    {formatNumber(report.row_count)} row{report.row_count === 1 ? '' : 's'} · export
                    for the full formatted file.
                  </p>
                </>
              )
            }
          </DataState>
        </CardBody>
      </Card>
    </>
  )
}
