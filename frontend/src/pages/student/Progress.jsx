import { useCallback, useMemo } from 'react'
import { Award, BookOpen, CalendarCheck, Info, Radar, TrendingUp } from 'lucide-react'

import {
  Card,
  CardBody,
  CardHeader,
  DataState,
  EmptyState,
  PageHeader,
  ProgressBar,
  Section,
  SkeletonCards,
} from '../../components/common'
import {
  AcademicTrendChart,
  MonthlyAttendanceChart,
  ProgressHistoryChart,
  ProgressRadarChart,
  SubjectChart,
} from '../../components/dashboard/Charts'
import { MiniStat } from '../../components/dashboard/StatCard'
import { useApi } from '../../hooks'
import { studentPortalService } from '../../services'
import { formatDate, formatDateTime, formatPercent, monthLabel } from '../../utils/format'

/**
 * The student's own progress: warden scores, exam results and attendance.
 * Everything is read-only - marks and scores are entered by staff.
 */
export default function StudentProgress() {
  const fetcher = useCallback(() => studentPortalService.progress(), [])
  const { data, loading, error, reload } = useApi(fetcher)

  const historyCategories = useMemo(
    () =>
      (data?.categories?.items || []).map((item) => ({
        slug: item.slug,
        name: item.category,
      })),
    [data],
  )

  return (
    <>
      <PageHeader title="My progress" subtitle="Scores, exam results and attendance" />

      <div
        className="mb-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
        role="note"
      >
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          Your warden records progress scores and your exam marks. This page is for viewing only -
          ask a warden if you think something is missing.
        </p>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        data={data}
        isEmpty={(value) => !value}
        emptyTitle="No progress data yet"
        emptyMessage="Scores and exam results appear here once staff record them."
        loadingLabel="Loading your progress…"
        skeleton={<SkeletonCards count={4} />}
      >
        {(overview) => {
          const categories = overview.categories
          const attendance = overview.attendance
          const exams = overview.academic_trend || []

          return (
            <div className="space-y-4 sm:space-y-5">
              {/* Headline numbers ------------------------------------- */}
              <section aria-label="Progress summary">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MiniStat
                    label="Overall progress"
                    value={formatPercent(categories?.overall)}
                    icon={TrendingUp}
                    tone="brand"
                  />
                  <MiniStat
                    label="Attendance overall"
                    value={formatPercent(attendance?.percentage)}
                    icon={CalendarCheck}
                    tone="success"
                  />
                  <MiniStat
                    label="Subjects graded"
                    value={overview.subjects?.length ?? 0}
                    icon={BookOpen}
                    tone="info"
                  />
                  <MiniStat
                    label="Exam results"
                    value={exams.length}
                    icon={Award}
                    tone="neutral"
                  />
                </div>
              </section>

              {/* Category scores -------------------------------------- */}
              <Card>
                <CardHeader
                  title="Progress by category"
                  subtitle={
                    categories?.period
                      ? `${monthLabel(categories.period.year, categories.period.month)} scores`
                      : 'Latest recorded scores'
                  }
                  icon={TrendingUp}
                />
                <CardBody>
                  {categories?.items?.length ? (
                    <>
                      <ProgressBar
                        label="Overall"
                        value={categories.overall}
                        className="mb-4 border-b border-slate-100 pb-4"
                      />
                      <div className="space-y-3.5">
                        {categories.items.map((item) => (
                          <div key={item.category_id ?? item.slug}>
                            <ProgressBar label={item.category} value={item.score} />
                            {item.remarks && (
                              <p className="mt-1 text-xs text-slate-500">{item.remarks}</p>
                            )}
                            {item.updated_at && (
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                Updated {formatDateTime(item.updated_at)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={TrendingUp}
                      title="No scores yet"
                      message="Your warden records progress scores each month. They will appear here."
                    />
                  )}
                </CardBody>
              </Card>

              {/* Charts ---------------------------------------------- */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Section
                  title="Progress shape"
                  subtitle="All categories at a glance"
                  icon={Radar}
                >
                  <ProgressRadarChart items={categories?.items} />
                </Section>

                <Section title="Subject averages" subtitle="Across all exams" icon={BookOpen}>
                  <SubjectChart data={overview.subjects} />
                </Section>

                <Section title="Exam trend" subtitle="Percentage per exam" icon={Award}>
                  <AcademicTrendChart data={exams} />
                </Section>

                <Section
                  title="Attendance trend"
                  subtitle="Last six months"
                  icon={CalendarCheck}
                >
                  <MonthlyAttendanceChart data={attendance?.monthly_trend} />
                </Section>

                <Section
                  title="Month-on-month progress"
                  subtitle="How each category has moved"
                  icon={TrendingUp}
                  className="lg:col-span-2"
                >
                  <ProgressHistoryChart
                    history={overview.progress_history}
                    categories={historyCategories}
                  />
                </Section>
              </div>

              {/* Exam results table --------------------------------- */}
              <Card>
                <CardHeader
                  title="Exam results"
                  subtitle={
                    exams.length
                      ? `${exams.length} result${exams.length === 1 ? '' : 's'} recorded`
                      : 'Nothing recorded yet'
                  }
                  icon={Award}
                />
                <CardBody className="pt-0">
                  {exams.length ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <caption className="sr-only">My exam results</caption>
                        <thead>
                          <tr>
                            <th scope="col">Exam</th>
                            <th scope="col">Subject</th>
                            <th scope="col">Date</th>
                            <th scope="col">Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exams.map((exam, index) => (
                            <tr key={`${exam.label}-${exam.subject}-${index}`}>
                              <td className="font-medium text-slate-800">
                                {exam.exam_name || exam.label}
                              </td>
                              <td className="whitespace-nowrap">{exam.subject || '—'}</td>
                              <td className="whitespace-nowrap">{formatDate(exam.exam_date)}</td>
                              <td className="font-semibold whitespace-nowrap tabular-nums">
                                {formatPercent(exam.percentage, 1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Award}
                      title="No exam results yet"
                      message="Marks appear here once your school results are entered by staff."
                    />
                  )}
                </CardBody>
              </Card>

              {/* Attendance breakdown ------------------------------- */}
              <Section
                title="Attendance breakdown"
                subtitle="All records so far"
                icon={CalendarCheck}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Present', value: attendance?.PRESENT, tone: 'text-emerald-700 bg-emerald-50' },
                    { label: 'Absent', value: attendance?.ABSENT, tone: 'text-red-700 bg-red-50' },
                    { label: 'Leave', value: attendance?.LEAVE, tone: 'text-sky-700 bg-sky-50' },
                    { label: 'Late', value: attendance?.LATE, tone: 'text-amber-700 bg-amber-50' },
                  ].map((cell) => (
                    <div key={cell.label} className={`rounded-xl px-3 py-2.5 text-center ${cell.tone}`}>
                      <p className="text-lg font-bold tabular-nums">{cell.value ?? 0}</p>
                      <p className="text-[11px] font-semibold">{cell.label}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )
        }}
      </DataState>
    </>
  )
}
