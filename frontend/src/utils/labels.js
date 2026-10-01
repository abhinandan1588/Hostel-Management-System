/**
 * Enum -> human label + badge tone.
 *
 * Health and status information always carries a text label and icon hint, so
 * meaning never depends on colour alone (accessibility requirement).
 */

import { humanize } from './format'

export const ATTENDANCE = {
  PRESENT: { label: 'Present', tone: 'success', icon: 'check' },
  ABSENT: { label: 'Absent', tone: 'danger', icon: 'x' },
  LEAVE: { label: 'Leave', tone: 'info', icon: 'calendar' },
  LATE: { label: 'Late', tone: 'warning', icon: 'clock' },
  NOT_MARKED: { label: 'Not marked', tone: 'neutral', icon: 'minus' },
}

export const HEALTH = {
  HEALTHY: { label: 'Healthy', tone: 'success', icon: 'heart' },
  FEELING_UNWELL: { label: 'Feeling unwell', tone: 'warning', icon: 'thermometer' },
  SICK: { label: 'Sick', tone: 'danger', icon: 'thermometer' },
  MEDICAL_OBSERVATION: { label: 'Medical observation', tone: 'danger', icon: 'stethoscope' },
  HOSPITALIZED: { label: 'Hospitalized', tone: 'danger', icon: 'hospital' },
}

export const HEALTH_SEVERITY = {
  LOW: { label: 'Low', tone: 'neutral' },
  MEDIUM: { label: 'Medium', tone: 'warning' },
  HIGH: { label: 'High', tone: 'danger' },
  CRITICAL: { label: 'Critical', tone: 'danger' },
}

export const RECOVERY = {
  ONGOING: { label: 'Ongoing', tone: 'warning' },
  RECOVERING: { label: 'Recovering', tone: 'info' },
  RECOVERED: { label: 'Recovered', tone: 'success' },
}

export const SCHOOL_STATUS = {
  WENT_TO_SCHOOL: { label: 'Went to school', tone: 'success', icon: 'school' },
  RETURNED_FROM_SCHOOL: { label: 'Returned from school', tone: 'info', icon: 'home' },
  DID_NOT_GO: { label: 'Did not go', tone: 'danger', icon: 'x' },
  ON_LEAVE: { label: 'On leave', tone: 'warning', icon: 'calendar' },
  SCHOOL_HOLIDAY: { label: 'School holiday', tone: 'neutral', icon: 'sun' },
  NOT_MARKED: { label: 'Not marked', tone: 'neutral', icon: 'minus' },
}

export const STUDENT_STATUS = {
  IN_HOSTEL: { label: 'In hostel', tone: 'success' },
  RETURNED_TO_HOSTEL: { label: 'Returned to hostel', tone: 'success' },
  AT_SCHOOL: { label: 'At school', tone: 'info' },
  OUTSIDE_WITH_PERMISSION: { label: 'Outside with permission', tone: 'warning' },
  ON_LEAVE: { label: 'On leave', tone: 'warning' },
  MEDICAL_FACILITY: { label: 'Medical facility', tone: 'danger' },
}

export const VERIFICATION = {
  PENDING: { label: 'Pending', tone: 'warning' },
  VERIFIED: { label: 'Verified', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
}

export const ACCOUNT_STATUS = {
  PENDING_VERIFICATION: { label: 'Pending verification', tone: 'warning' },
  ACTIVE: { label: 'Active', tone: 'success' },
  BLOCKED: { label: 'Blocked', tone: 'danger' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
}

export const MEAL = {
  BREAKFAST: { label: 'Breakfast', time: 'Morning' },
  LUNCH: { label: 'Lunch', time: 'Midday' },
  EVENING_SNACK: { label: 'Evening snack', time: 'Evening' },
  DINNER: { label: 'Dinner', time: 'Night' },
}

export const SUGGESTION_STATUS = {
  NEW: { label: 'New', tone: 'info' },
  UNDER_REVIEW: { label: 'Under review', tone: 'warning' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
}

export const SUGGESTION_CATEGORIES = [
  'FOOD',
  'STUDY',
  'HEALTH',
  'ROOM',
  'DISCIPLINE',
  'ACTIVITIES',
  'SCHOOL',
  'GENERAL',
  'OTHER',
]

export const NOTIFICATION_PRIORITY = {
  LOW: { label: 'Low', tone: 'neutral' },
  NORMAL: { label: 'Normal', tone: 'info' },
  HIGH: { label: 'High', tone: 'warning' },
  URGENT: { label: 'Urgent', tone: 'danger' },
}

export const EMERGENCY_TYPES = {
  MEDICAL_EMERGENCY: { label: 'Medical emergency' },
  HOSTEL_EMERGENCY: { label: 'Hostel emergency' },
  SCHOOL_EMERGENCY: { label: 'School emergency' },
  NATURAL_DISASTER: { label: 'Natural disaster' },
  IMPORTANT_ANNOUNCEMENT: { label: 'Important announcement' },
}

export const ANNOUNCEMENT_AUDIENCE = {
  ALL_PARENTS: { label: 'All parents' },
  ALL_STUDENTS: { label: 'All students' },
  EVERYONE: { label: 'Everyone' },
  SPECIFIC_STUDENT: { label: 'A specific student' },
  SPECIFIC_CLASS: { label: 'A specific class' },
}

export const ACTIVITY_TYPES = [
  'WAKE_UP',
  'BREAKFAST',
  'LEFT_FOR_SCHOOL',
  'RETURNED_FROM_SCHOOL',
  'LUNCH',
  'STUDY',
  'OUTDOOR_ACTIVITY',
  'EVENING_SNACK',
  'DINNER',
  'PRAYER',
  'LIGHTS_OUT',
  'OTHER',
]

const MAPS = {
  attendance: ATTENDANCE,
  health: HEALTH,
  severity: HEALTH_SEVERITY,
  recovery: RECOVERY,
  school: SCHOOL_STATUS,
  studentStatus: STUDENT_STATUS,
  verification: VERIFICATION,
  account: ACCOUNT_STATUS,
  meal: MEAL,
  suggestion: SUGGESTION_STATUS,
  priority: NOTIFICATION_PRIORITY,
  emergency: EMERGENCY_TYPES,
  audience: ANNOUNCEMENT_AUDIENCE,
}

/** Look up `{label, tone}` for a value, falling back to a humanised label. */
export function describe(kind, value) {
  const map = MAPS[kind] || {}
  const entry = value ? map[value] : map.NOT_MARKED
  if (entry) return { tone: 'neutral', ...entry }
  return { label: value ? humanize(value) : 'Not recorded', tone: 'neutral' }
}

export function labelOf(kind, value) {
  return describe(kind, value).label
}

export function toneOf(kind, value) {
  return describe(kind, value).tone
}

/** Options array for a <select>, from an enum map or list of codes. */
export function optionsFrom(source, kind) {
  if (Array.isArray(source)) {
    return source.map((value) => ({ value, label: kind ? labelOf(kind, value) : humanize(value) }))
  }
  return Object.entries(source || {}).map(([value, meta]) => ({
    value,
    label: meta.label || humanize(value),
  }))
}

/** Chart colours, kept consistent across every dashboard. */
export const CHART_COLORS = {
  present: '#059669',
  absent: '#dc2626',
  leave: '#2563eb',
  late: '#d97706',
  primary: '#4338ca',
  secondary: '#818cf8',
  accent: '#0ea5e9',
  muted: '#94a3b8',
}

export const HEALTH_CHART_COLORS = {
  HEALTHY: '#059669',
  FEELING_UNWELL: '#d97706',
  SICK: '#dc2626',
  MEDICAL_OBSERVATION: '#b91c1c',
  HOSPITALIZED: '#7f1d1d',
}
