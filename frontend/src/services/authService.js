import { get, patch, post, tokenStore } from './apiClient'

export const authService = {
  login: (identifier, password) => post('/auth/login', { identifier, password }, { skipAuth: true }),
  register: (payload) => post('/auth/register', payload, { skipAuth: true }),
  logout: () => post('/auth/logout'),
  me: () => get('/auth/me'),
  forgotPassword: (email) => post('/auth/forgot-password', { email }, { skipAuth: true }),
  resetPassword: (payload) => post('/auth/reset-password', payload, { skipAuth: true }),
  changePassword: (payload) => post('/auth/change-password', payload),
  updateProfile: (payload) => patch('/auth/profile', payload),
  uploadPhoto: (file) => {
    const form = new FormData()
    form.append('photo', file)
    return post('/auth/profile/photo', form)
  },
  meta: () => get('/meta', undefined, { skipAuth: true }),
}

export { tokenStore }
