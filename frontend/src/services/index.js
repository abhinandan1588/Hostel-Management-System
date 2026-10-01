/**
 * All HTTP access lives in this folder. Components and pages never call axios
 * directly - they import a service function from here.
 */

import { del, get, getPage, patch, post, put, requestRaw } from './apiClient'

export { authService } from './authService'
export { ApiError, onSessionExpired, tokenStore } from './apiClient'

/* ------------------------------------------------------------------ admin */
export const adminService = {
  dashboard: () => get('/admin/dashboard'),
  summary: () => get('/admin/summary'),
  search: (q) => get('/admin/search', { q }),
  auditLogs: (params) => getPage('/admin/audit-logs', params),
  profile: () => get('/admin/profile'),
  updateProfile: (payload) => patch('/admin/profile', payload),
  settings: () => get('/admin/settings'),
  listAdmins: () => get('/admin/admins'),
  createAdmin: (payload) => post('/admin/admins', payload),
}

/* --------------------------------------------------------------- students */
export const studentService = {
  list: (params) => getPage('/students', params),
  filterOptions: () => get('/students/filter-options'),
  get: (id) => get(`/students/${id}`),
  overview: (id, params) => get(`/students/${id}/overview`, params),
  create: (payload) => post('/students', payload),
  update: (id, payload) => patch(`/students/${id}`, payload),
  uploadPhoto: (id, file) => {
    const form = new FormData()
    form.append('photo', file)
    return post(`/students/${id}/photo`, form)
  },
  verify: (id) => post(`/students/${id}/verify`),
  block: (id, reason) => post(`/students/${id}/block`, { reason }),
  unblock: (id) => post(`/students/${id}/unblock`),
  archive: (id, reason) => del(`/students/${id}`, { data: { reason } }),
  restore: (id) => post(`/students/${id}/restore`),
  linkParent: (id, payload) => post(`/students/${id}/parents`, payload),
  unlinkParent: (id, parentId) => del(`/students/${id}/parents/${parentId}`),
  assignBed: (id, bedId) => put(`/students/${id}/bed`, { bed_id: bedId }),
  createAccount: (id, payload) => post(`/students/${id}/account`, payload),
  revokeAccount: (id) => del(`/students/${id}/account`),
  changeStatus: (id, payload) => post(`/students/${id}/status`, payload),
  statusHistory: (id) => get(`/students/${id}/status-history`),
}

/* ---------------------------------------------------------------- parents */
export const parentService = {
  list: (params) => getPage('/parents', params),
  get: (id) => get(`/parents/${id}`),
  review: (id) => get(`/parents/${id}/review`),
  children: (id) => get(`/parents/${id}/children`),
  suggestions: (id) => getPage(`/parents/${id}/suggestions`),
  lookup: (params) => getPage('/parents/lookup', params),
  verify: (id) => post(`/parents/${id}/verify`),
  reject: (id, reason) => post(`/parents/${id}/reject`, { reason }),
  block: (id, reason) => post(`/parents/${id}/block`, { reason }),
  unblock: (id) => post(`/parents/${id}/unblock`),
  update: (id, payload) => patch(`/parents/${id}`, payload),
  remove: (id) => del(`/parents/${id}`),
  uploadDocument: (id, file) => {
    const form = new FormData()
    form.append('document', file)
    return post(`/parents/${id}/document`, form)
  },
}

/* ------------------------------------------------------------------ rooms */
export const roomService = {
  list: (params) => get('/rooms', params),
  tree: () => get('/rooms/tree'),
  summary: () => get('/rooms/summary'),
  get: (id) => get(`/rooms/${id}`),
  create: (payload) => post('/rooms', payload),
  update: (id, payload) => patch(`/rooms/${id}`, payload),
  remove: (id) => del(`/rooms/${id}`),
  beds: (params) => get('/beds', params),
  availableBeds: () => get('/beds', { available_only: true }),
  createBed: (payload) => post('/beds', payload),
  updateBed: (id, payload) => patch(`/beds/${id}`, payload),
  removeBed: (id) => del(`/beds/${id}`),
}

/* ------------------------------------------------------------- attendance */
export const attendanceService = {
  list: (params) => getPage('/attendance', params),
  sheet: (params) => get('/attendance/sheet', params),
  today: () => get('/attendance/today'),
  trend: (params) => get('/attendance/trend', params),
  record: (payload) => post('/attendance', payload),
  bulkRecord: (payload) => post('/attendance/bulk', payload),
  update: (id, payload) => patch(`/attendance/${id}`, payload),
  remove: (id) => del(`/attendance/${id}`),
  forStudent: (studentId, params) => getPage(`/attendance/${studentId}`, params),
  summary: (studentId, params) => get(`/attendance/${studentId}/summary`, params),
  calendar: (studentId, params) => get(`/attendance/${studentId}/calendar`, params),
  studentTrend: (studentId, params) => get(`/attendance/${studentId}/trend`, params),
}

/* ----------------------------------------------------------------- health */
export const healthService = {
  list: (params) => getPage('/health', params),
  overview: () => get('/health/overview'),
  create: (payload) => post('/health', payload),
  update: (id, payload) => patch(`/health/${id}`, payload),
  markRecovered: (id, remarks) => post(`/health/${id}/recovered`, { remarks }),
  remove: (id) => del(`/health/${id}`),
  forStudent: (studentId) => get(`/health/${studentId}`),
  current: (studentId) => get(`/health/${studentId}/current`),
}

/* ------------------------------------------------------------------ meals */
export const mealService = {
  list: (params) => get('/meals', params),
  today: () => get('/meals/today'),
  forDate: (date) => get(`/meals/${date}`),
  stats: (params) => get('/meals/stats', params),
  save: (payload) => post('/meals', payload),
  update: (id, payload) => patch(`/meals/id/${id}`, payload),
  remove: (id) => del(`/meals/id/${id}`),
  uploadPhotos: (id, files, caption) => {
    const form = new FormData()
    Array.from(files).forEach((file) => form.append('photos', file))
    if (caption) form.append('caption', caption)
    return post(`/meals/id/${id}/photos`, form)
  },
  removePhoto: (photoId) => del(`/meals/photos/${photoId}`),
}

/* ------------------------------------------------------- school tracking */
export const schoolService = {
  list: (params) => getPage('/school-attendance', params),
  sheet: (params) => get('/school-attendance/sheet', params),
  weekly: (params) => get('/school-attendance/weekly', params),
  record: (payload) => post('/school-attendance', payload),
  update: (id, payload) => patch(`/school-attendance/${id}`, payload),
  markReturned: (id, time) => post(`/school-attendance/${id}/returned`, { actual_return_time: time }),
  remove: (id) => del(`/school-attendance/${id}`),
  forStudent: (studentId, params) => getPage(`/school-attendance/student/${studentId}`, params),
  today: (studentId, params) => get(`/school-attendance/student/${studentId}/today`, params),
}

/* ------------------------------------------------------------- activities */
export const activityService = {
  list: (params) => getPage('/activities', params),
  stats: (params) => get('/activities/stats', params),
  recent: () => get('/activities/recent'),
  create: (payload) => post('/activities', payload),
  generateRoutine: (payload) => post('/activities/generate-routine', payload),
  bulkComplete: (payload) => post('/activities/bulk-complete', payload),
  update: (id, payload) => patch(`/activities/${id}`, payload),
  complete: (id, activityTime) => post(`/activities/${id}/complete`, { activity_time: activityTime }),
  confirm: (id) => post(`/activities/${id}/confirm`),
  remove: (id) => del(`/activities/${id}`),
  timeline: (studentId, params) => get(`/activities/${studentId}`, params),
  range: (studentId, params) => getPage(`/activities/${studentId}/range`, params),
}

/* --------------------------------------------------------------- progress */
export const progressService = {
  categories: () => get('/progress/categories'),
  academic: (params) => getPage('/progress/academic', params),
  createAcademic: (payload) => post('/progress/academic', payload),
  updateAcademic: (id, payload) => patch(`/progress/academic/${id}`, payload),
  removeAcademic: (id) => del(`/progress/academic/${id}`),
  saveScore: (payload) => post('/progress', payload),
  saveScores: (payload) => post('/progress/bulk', payload),
  removeScore: (id) => del(`/progress/${id}`),
  overview: (studentId) => get(`/progress/student/${studentId}`),
  current: (studentId, params) => get(`/progress/student/${studentId}/current`, params),
  history: (studentId, params) => get(`/progress/student/${studentId}/history`, params),
}

/* ---------------------------------------------------------- notifications */
export const notificationService = {
  list: (params) => getPage('/notifications', params),
  unreadCount: () => get('/notifications/unread-count'),
  markRead: (id) => post(`/notifications/${id}/read`),
  markAllRead: () => post('/notifications/read-all'),
  remove: (id) => del(`/notifications/${id}`),
}

/* ------------------------------------------------------------ suggestions */
export const suggestionService = {
  list: (params) => getPage('/suggestions', params),
  stats: () => get('/suggestions/stats'),
  get: (id) => get(`/suggestions/${id}`),
  create: (payload, attachment) => {
    if (!attachment) return post('/suggestions', payload)
    const form = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') form.append(key, value)
    })
    form.append('attachment', attachment)
    return post('/suggestions', form)
  },
  setStatus: (id, status) => patch(`/suggestions/${id}/status`, { status }),
  reply: (id, message) => post(`/suggestions/${id}/replies`, { message }),
}

/* ---------------------------------------------------------- announcements */
export const announcementService = {
  list: (params) => getPage('/announcements', params),
  mine: () => get('/announcements', { mine: true }),
  get: (id) => get(`/announcements/${id}`),
  create: (payload, attachment) => {
    if (!attachment) return post('/announcements', payload)
    const form = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') form.append(key, value)
    })
    form.append('attachment', attachment)
    return post('/announcements', form)
  },
  update: (id, payload) => patch(`/announcements/${id}`, payload),
  remove: (id) => del(`/announcements/${id}`),
}

/* -------------------------------------------------------- emergency alerts */
export const emergencyService = {
  list: (params) => getPage('/emergency-alerts', params),
  mine: () => get('/emergency-alerts'),
  get: (id) => get(`/emergency-alerts/${id}`),
  send: (payload) => post('/emergency-alerts', payload),
  resolve: (id) => post(`/emergency-alerts/${id}/resolve`),
  acknowledge: (id) => post(`/emergency-alerts/${id}/acknowledge`),
}

/* ---------------------------------------------------------------- reports */
export const reportService = {
  catalogue: () => get('/reports'),
  generate: (type, params) => get(`/reports/${type}`, params),
  download: (type, params, format) =>
    requestRaw({
      method: 'get',
      url: `/reports/${type}`,
      params: { ...params, format },
      responseType: 'blob',
    }),
}

/* ---------------------------------------------------------- parent portal */
export const parentPortalService = {
  dashboard: (studentId) => get('/parent/dashboard', studentId ? { student_id: studentId } : undefined),
  children: () => get('/parent/children'),
  child: (id) => get(`/parent/children/${id}`),
  childToday: (id) => get(`/parent/children/${id}/today`),
  dailyActivity: (id, params) => get(`/parent/children/${id}/daily-activity`, params),
  attendance: (id, params) => getPage(`/parent/children/${id}/attendance`, params),
  health: (id) => get(`/parent/children/${id}/health`),
  meals: (id, params) => get(`/parent/children/${id}/meals`, params),
  school: (id, params) => getPage(`/parent/children/${id}/school`, params),
  progress: (id) => get(`/parent/children/${id}/progress`),
  academic: (id, params) => getPage(`/parent/children/${id}/academic`, params),
  profile: () => get('/parent/profile'),
  notifications: (params) => getPage('/parent/notifications', params),
  announcements: () => get('/parent/announcements'),
  status: () => get('/parent/status'),
}

/* --------------------------------------------------------- student portal */
export const studentPortalService = {
  dashboard: () => get('/student/dashboard'),
  profile: () => get('/student/profile'),
  updateProfile: (payload) => patch('/student/profile', payload),
  routine: (params) => get('/student/routine', params),
  attendance: (params) => getPage('/student/attendance', params),
  school: (params) => getPage('/student/school', params),
  health: () => get('/student/health'),
  meals: (params) => get('/student/meals', params),
  progress: () => get('/student/progress'),
  notifications: (params) => getPage('/student/notifications', params),
  announcements: () => get('/student/announcements'),
  reportIssue: (payload) => post('/student/report-issue', payload),
}
