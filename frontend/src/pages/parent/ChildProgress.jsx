import { useCallback, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarCheck,
  LineChart,
  Radar,
  TrendingUp,
} from 'lucide-react'

import {
  Avatar,
  Card,
  DataState,
  Loader,
  PageHeader,
  Pagination,
  ProgressBar,
  Section,
  StatusBadge,
} from '../../components/common'
import {
  AcademicTrendChart,
  MonthlyAttendanceChart,
  ProgressRadarChart,
  SubjectChart,
} from '../../components/dashboard/Charts'
import { MiniStat } from '../../components/dashboard/StatCard'
import { useApi, usePagination } from '../../hooks'
import { parentPortalService } from '../../services'
import { formatDate, formatPercent } from '../../utils/format'

function ChildSwitcher({ items, value, onChange, id = 'progress-child' }) {
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

export default function ParentChildProgress() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { page, perPage, setPage, setPerPage, reset } = usePagination(10)

  const progressFetcher = useCallback(() => parentPortalService.progress(id), [id])
  const { data, loading, error, reload } = useApi(progressFetcher)

  const examQuery = useMemo(() => ({ page, per_page: perPage }), [page, perPage])
  const examFetcher = useCallback(
    () => parentPortalService.academic(id, examQuery),
    [id, examQuery],
  )
  const {
    data: exams,
    meta: examMeta,
    loading: examsLoading,
    error: examsError,
    reload: reloadExams,
  } = useApi(examFetcher)

  const siblingsFetcher = useCallback(() => parentPortalService.children(), [])
  const { data: siblings } = useApi(siblingsFetcher)
  const child = siblings?.find((item) => String(item.id) === String(id))

  return (
    <>
      <PageHeader
        title="Progress"
        subtitle={child?.full_name ? `${child.full_name} · development and exam results` : 'Development and exam results'}
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
        onChange={(nextId) => navigate(`/parent/children/${nextId}/progress`)}
      />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<Loader label="Loading progress…" />}
      >
        {(payload) => {
          const categories = payload.categories
          const attendance = payload.attendance
          const subjectAverage = payload.subjects?.length
            ? payload.subjects.reduce((total, row) => total + (row.average_percentage || 0), 0) /
              payload.subjects.length
            : null

          return (
            <div className="space-y-4">
              {/* -------------------------------------------------- headline */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MiniStat
                  label="Overall progress"
                  value={
                    categories?.overall === null || categories?.overall === undefined
                      ? '—'
                      : formatPercent(categories.overall)
                  }
                  icon={TrendingUp}
                  tone="brand"
                />
                <MiniStat
                  label="Exam average"
                  value={subjectAverage === null ? '—' : formatPercent(subjectAverage)}
                  icon={Award}
                  tone="info"
                />
                <MiniStat
                  label="Attendance"
                  value={formatPercent(attendance?.percentage)}
                  icon={CalendarCheck}
                  tone="success"
                />
                <MiniStat
                  label="Exams recorded"
                  value={examMeta?.total ?? payload.academic_trend?.length ?? 0}
                  icon={BookOpen}
                  tone="neutral"
                />
              </div>

              {/* ------------------------------------------------ categories */}
              <Section
                title="Progress by category"
                subtitle={
                  categories?.period
                    ? `${categories.period.year}-${String(categories.period.month).padStart(2, '0')} assessment by hostel staff`
                    : 'Latest assessment by hostel staff'
                }
                icon={TrendingUp}
              >
                {categories?.items?.length ? (
                  <div className="space-y-4">
                    {categories.items.map((item) => (
                      <div key={item.category_id}>
                        <ProgressBar
                          label={item.category}
                          value={item.score ?? 0}
                          showValue={item.score !== null && item.score !== undefined}
                        />
                        {item.description && (
                          <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                        )}
                        {item.remarks && (
                          <p className="mt-1 text-xs text-slate-500">{item.remarks}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No progress scores have been recorded yet.</p>
                )}
              </Section>

              {/* ---------------------------------------------------- charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Overall shape" subtitle="All categories at a glance" icon={Radar}>
                  <ProgressRadarChart items={categories?.items} />
                </Section>

                <Section title="Subject averages" subtitle="Across all exams" icon={BookOpen}>
                  <SubjectChart data={payload.subjects} />
                </Section>

                <Section title="Exam trend" subtitle="Percentage per exam" icon={LineChart}>
                  <AcademicTrendChart data={payload.academic_trend} />
                </Section>

                <Section
                  title="Monthly attendance"
                  subtitle="Last six months"
                  icon={CalendarCheck}
                >
                  <MonthlyAttendanceChart data={attendance?.monthly_trend} />
                </Section>
              </div>

              {/* --------------------------------------------- exam results */}
              <Card>
                <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
                  <h2 className="section-title flex items-center gap-2">
                    <Award className="h-4.5 w-4.5 text-brand-700" aria-hidden="true" />
                    Exam results
                  </h2>
                  <p className="muted mt-0.5">Recorded by hostel staff from the school report</p>
                </div>

                <DataState
                  loading={examsLoading}
                  error={examsError}
                  data={exams}
                  onRetry={reloadExams}
                  loadingLabel="Loading exam results…"
                  emptyIcon={Award}
                  emptyTitle="No exam results yet"
                  emptyMessage="Exam results appear here once the hostel office records them."
                >
                  {(rows) => (
                    <>
                      {/* Stacked cards on phones */}
                      <ul className="divide-y divide-slate-100 sm:hidden">
                        {rows.map((row) => (
                          <li key={row.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {row.subject}
                              </span>
                              <span className="badge-info">{row.grade || '—'}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {row.exam_name}
                              {row.exam_type ? ` · ${row.exam_type}` : ''} ·{' '}
                              {formatDate(row.exam_date)}
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-700 tabular-nums">
                              {row.marks_obtained} / {row.max_marks} ·{' '}
                              {formatPercent(row.percentage, 1)}
                            </p>
                            {row.teacher_remark && (
                              <p className="mt-1 text-xs text-slate-500">{row.teacher_remark}</p>
                            )}
                          </li>
                        ))}
                      </ul>

                      {/* Table from sm upwards */}
                      <div className="table-wrap hidden sm:block">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th scope="col">Subject</th>
                              <th scope="col">Exam</th>
                              <th scope="col">Marks</th>
                              <th scope="col">Percentage</th>
                              <th scope="col">Grade</th>
                              <th scope="col">Teacher remark</th>
                              <th scope="col">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={row.id}>
                                <td className="font-medium text-slate-900">{row.subject}</td>
                                <td>
                                  {row.exam_name}
                                  {row.exam_type && (
                                    <span className="block text-xs text-slate-400">
                                      {row.exam_type}
                                    </span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap tabular-nums">
                                  {row.marks_obtained} / {row.max_marks}
                                </td>
                                <td className="whitespace-nowrap tabular-nums">
                                  {formatPercent(row.percentage, 1)}
                                </td>
                                <td>
                                  <span className="badge-info">{row.grade || '—'}</span>
                                </td>
                                <td className="max-w-56">{row.teacher_remark || '—'}</td>
                                <td className="whitespace-nowrap">{formatDate(row.exam_date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="px-4 sm:px-5">
                        <Pagination
                          meta={examMeta}
                          page={page}
                          onPageChange={setPage}
                          perPage={perPage}
                          onPerPageChange={(size) => {
                            setPerPage(size)
                            reset()
                          }}
                        />
                      </div>
                    </>
                  )}
                </DataState>
              </Card>

              <p className="muted">
                Attendance overall:{' '}
                <StatusBadge kind="attendance" value="PRESENT" className="align-middle" />{' '}
                {attendance?.PRESENT ?? 0} ·{' '}
                <StatusBadge kind="attendance" value="ABSENT" className="align-middle" />{' '}
                {attendance?.ABSENT ?? 0} ·{' '}
                <StatusBadge kind="attendance" value="LEAVE" className="align-middle" />{' '}
                {attendance?.LEAVE ?? 0} ·{' '}
                <StatusBadge kind="attendance" value="LATE" className="align-middle" />{' '}
                {attendance?.LATE ?? 0}
              </p>
            </div>
          )
        }}
      </DataState>
    </>
  )
}
