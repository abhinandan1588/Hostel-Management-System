import axios from 'axios'

/**
 * Single axios instance for the whole app.
 *
 * - attaches the access token to every request
 * - unwraps the backend's {success, message, data, meta} envelope
 * - transparently refreshes an expired access token once, then replays the
 *   original request
 * - never stores secrets other than the tokens themselves
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const STORAGE_KEYS = {
  access: 'hms.accessToken',
  refresh: 'hms.refreshToken',
  user: 'hms.user',
}

export const tokenStore = {
  getAccess: () => localStorage.getItem(STORAGE_KEYS.access),
  getRefresh: () => localStorage.getItem(STORAGE_KEYS.refresh),
  getUser: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.user)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  set: ({ accessToken, refreshToken, user }) => {
    if (accessToken) localStorage.setItem(STORAGE_KEYS.access, accessToken)
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.refresh, refreshToken)
    if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
  },
  setUser: (user) => {
    if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
  },
  clear: () => {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
  },
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess()
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Let the browser set the multipart boundary itself.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

/** Normalised error shape used by every page and form. */
export class ApiError extends Error {
  constructor({ message, status, errors, isNetwork = false }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors || null
    this.isNetwork = isNetwork
  }

  /** First field-level message, useful for inline form errors. */
  fieldMessage(field) {
    const value = this.errors?.[field]
    if (!value) return null
    return Array.isArray(value) ? value[0] : String(value)
  }
}

function toApiError(error) {
  if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
    const cancelled = new ApiError({ message: 'Request cancelled', status: 0 })
    cancelled.cancelled = true
    return cancelled
  }
  if (!error.response) {
    return new ApiError({
      message: 'Cannot reach the server. Check your connection and try again.',
      status: 0,
      isNetwork: true,
    })
  }
  const { status, data } = error.response
  return new ApiError({
    message: data?.message || defaultMessageFor(status),
    status,
    errors: data?.errors,
  })
}

function defaultMessageFor(status) {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'The requested item could not be found.'
  if (status === 409) return 'That action conflicts with existing data.'
  if (status === 413) return 'The file you selected is too large.'
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.'
  if (status >= 500) return 'Something went wrong on the server. Please try again.'
  return 'The request could not be completed.'
}

/* --------------------------------------------------------------------------
 * Token refresh: a single in-flight refresh is shared by all queued requests.
 * ------------------------------------------------------------------------ */
let refreshPromise = null
const sessionExpiredHandlers = new Set()

/** Register a callback fired when the session can no longer be recovered. */
export function onSessionExpired(handler) {
  sessionExpiredHandlers.add(handler)
  return () => sessionExpiredHandlers.delete(handler)
}

function notifySessionExpired() {
  tokenStore.clear()
  sessionExpiredHandlers.forEach((handler) => {
    try {
      handler()
    } catch {
      /* a broken listener must not block the others */
    }
  })
}

async function refreshAccessToken() {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) throw new Error('No refresh token')
  const response = await axios.post(
    `${BASE_URL}/auth/refresh`,
    {},
    { headers: { Authorization: `Bearer ${refreshToken}` } },
  )
  const accessToken = response.data?.data?.access_token
  if (!accessToken) throw new Error('Refresh failed')
  tokenStore.set({ accessToken })
  return accessToken
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {}
    const status = error.response?.status

    const canRetry =
      status === 401 &&
      !original._retried &&
      !original.skipAuth &&
      !String(original.url || '').includes('/auth/refresh') &&
      !String(original.url || '').includes('/auth/login') &&
      tokenStore.getRefresh()

    if (canRetry) {
      original._retried = true
      try {
        refreshPromise = refreshPromise || refreshAccessToken().finally(() => {
          refreshPromise = null
        })
        const accessToken = await refreshPromise
        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` }
        return api(original)
      } catch {
        notifySessionExpired()
        return Promise.reject(
          new ApiError({
            message: 'Your session has expired. Please sign in again.',
            status: 401,
          }),
        )
      }
    }

    if (status === 401 && !original.skipAuth) {
      notifySessionExpired()
    }

    return Promise.reject(toApiError(error))
  },
)

/* --------------------------------------------------------------------------
 * Envelope helpers used by the service modules
 * ------------------------------------------------------------------------ */

/** Returns just `data` from the response envelope. */
export async function request(config) {
  const response = await api.request(config)
  return response.data?.data
}

/** Returns `{ data, meta, message }` for paginated endpoints. */
export async function requestWithMeta(config) {
  const response = await api.request(config)
  return {
    data: response.data?.data,
    meta: response.data?.meta || null,
    message: response.data?.message,
  }
}

/** Returns the raw response (for blob downloads). */
export function requestRaw(config) {
  return api.request(config)
}

export const get = (url, params, config = {}) => request({ method: 'get', url, params, ...config })
export const getPage = (url, params, config = {}) =>
  requestWithMeta({ method: 'get', url, params, ...config })
export const post = (url, data, config = {}) => request({ method: 'post', url, data, ...config })
export const put = (url, data, config = {}) => request({ method: 'put', url, data, ...config })
export const patch = (url, data, config = {}) => request({ method: 'patch', url, data, ...config })
export const del = (url, config = {}) => request({ method: 'delete', url, ...config })

export default api
