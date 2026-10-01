import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EmptyState } from '../common/States'
import { formatDate, humanize } from '../../utils/format'
import { CHART_COLORS, HEALTH_CHART_COLORS, labelOf } from '../../utils/labels'

const AXIS = { fontSize: 11, fill: '#64748b' }
const GRID = '#e2e8f0'

function ChartFrame({ children, height = 260 }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function NoData({ message = 'No data recorded for this period yet.' }) {
  return <EmptyState title="Nothing to chart" message={message} className="py-8" />
}

/** Stacked daily attendance counts (admin dashboard). */
export function AttendanceTrendChart({ data, height = 260 }) {
  if (!data?.length) return <NoData />
  const rows = data.map((row) => ({ ...row, label: formatDate(row.date, { withYear: false }) }))
  return (
    <ChartFrame height={height}>
      <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
          formatter={(value, name) => [value, labelOf('attendance', name)]}
        />
        <Legend formatter={(value) => labelOf('attendance', value)} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="PRESENT" stackId="a" fill={CHART_COLORS.present} radius={[0, 0, 0, 0]} />
        <Bar dataKey="LATE" stackId="a" fill={CHART_COLORS.late} />
        <Bar dataKey="LEAVE" stackId="a" fill={CHART_COLORS.leave} />
        <Bar dataKey="ABSENT" stackId="a" fill={CHART_COLORS.absent} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  )
}

/** Monthly attendance percentage line (parent/student dashboards). */
export function MonthlyAttendanceChart({ data, height = 240 }) {
  if (!data?.length) return <NoData />
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
          formatter={(value) => [`${value}%`, 'Attendance']}
        />
        <Line
          type="monotone"
          dataKey="percentage"
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          dot={{ r: 3, fill: CHART_COLORS.primary }}
          activeDot={{ r: 5 }}
          name="Attendance"
        />
      </LineChart>
    </ChartFrame>
  )
}

/** Health status doughnut. Legend text carries the meaning, not just colour. */
export function HealthDonutChart({ data, height = 240 }) {
  const rows = (data || []).filter((row) => row.count > 0)
  if (!rows.length) return <NoData message="No health records yet." />
  return (
    <ChartFrame height={height}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="count"
          nameKey="label"
          innerRadius="52%"
          outerRadius="80%"
          paddingAngle={2}
        >
          {rows.map((row) => (
            <Cell key={row.status} fill={HEALTH_CHART_COLORS[row.status] || CHART_COLORS.muted} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ChartFrame>
  )
}

/** Hostel occupancy per building. */
export function OccupancyChart({ data, height = 240 }) {
  if (!data?.length) return <NoData message="No rooms have been added yet." />
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="building" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="occupied" name="Occupied" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
        <Bar dataKey="available" name="Available" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  )
}

/** Weekly school attendance counts. */
export function SchoolAttendanceChart({ data, height = 240 }) {
  if (!data?.length) return <NoData />
  const rows = data.map((row) => ({ ...row, label: formatDate(row.date, { withYear: false }) }))
  return (
    <ChartFrame height={height}>
      <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
          formatter={(value, name) => [value, labelOf('school', name)]}
        />
        <Legend formatter={(value) => labelOf('school', value)} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="WENT_TO_SCHOOL" stackId="a" fill={CHART_COLORS.present} />
        <Bar dataKey="RETURNED_FROM_SCHOOL" stackId="a" fill={CHART_COLORS.accent} />
        <Bar dataKey="DID_NOT_GO" stackId="a" fill={CHART_COLORS.absent} />
        <Bar dataKey="ON_LEAVE" stackId="a" fill={CHART_COLORS.late} />
        <Bar dataKey="SCHOOL_HOLIDAY" stackId="a" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  )
}

/** Subject-wise average percentage. */
export function SubjectChart({ data, height = 260 }) {
  if (!data?.length) return <NoData message="No exam results recorded yet." />
  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
        <YAxis
          type="category"
          dataKey="subject"
          width={104}
          tick={AXIS}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
          formatter={(value) => [`${value}%`, 'Average']}
        />
        <Bar dataKey="average_percentage" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ChartFrame>
  )
}

/** Exam-by-exam percentage trend. */
export function AcademicTrendChart({ data, height = 260 }) {
  if (!data?.length) return <NoData message="No exam results recorded yet." />
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="exam_name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
          formatter={(value, _name, entry) => [`${value}%`, entry?.payload?.subject || 'Result']}
        />
        <Line
          type="monotone"
          dataKey="percentage"
          stroke={CHART_COLORS.accent}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          name="Percentage"
        />
      </LineChart>
    </ChartFrame>
  )
}

/** Progress categories as a radar (overall shape at a glance). */
export function ProgressRadarChart({ items, height = 280 }) {
  const rows = (items || []).filter((item) => item.score !== null && item.score !== undefined)
  if (rows.length < 3) return <NoData message="Progress scores have not been recorded yet." />
  return (
    <ChartFrame height={height}>
      <RadarChart data={rows.map((item) => ({ subject: item.category, score: item.score }))}>
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }}
          formatter={(value) => [`${value}%`, 'Score']}
        />
        <Radar
          dataKey="score"
          stroke={CHART_COLORS.primary}
          fill={CHART_COLORS.primary}
          fillOpacity={0.25}
        />
      </RadarChart>
    </ChartFrame>
  )
}

/** Month-over-month progress comparison per category. */
export function ProgressHistoryChart({ history, categories, height = 260 }) {
  if (!history?.length) return <NoData message="Not enough history for a comparison yet." />
  const slugs = (categories || [])
    .filter((category) => history.some((row) => row[category.slug] !== undefined))
    .slice(0, 5)
  if (!slugs.length) return <NoData message="Not enough history for a comparison yet." />
  const palette = [
    CHART_COLORS.primary,
    CHART_COLORS.accent,
    CHART_COLORS.present,
    CHART_COLORS.late,
    CHART_COLORS.secondary,
  ]
  return (
    <ChartFrame height={height}>
      <LineChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
        <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {slugs.map((category, index) => (
          <Line
            key={category.slug}
            type="monotone"
            dataKey={category.slug}
            name={category.name || humanize(category.slug)}
            stroke={palette[index % palette.length]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartFrame>
  )
}
