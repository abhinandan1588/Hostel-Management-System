/** Resolve a stored relative media path into a browser-usable URL. */

const MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE_URL || '/api/media'

export function mediaUrl(relativePath) {
  if (!relativePath) return null
  if (/^(https?:)?\/\//.test(relativePath) || relativePath.startsWith('blob:')) {
    return relativePath
  }
  return `${MEDIA_BASE.replace(/\/$/, '')}/${String(relativePath).replace(/^\//, '')}`
}

export const MAX_UPLOAD_BYTES = Number(import.meta.env.VITE_MAX_UPLOAD_BYTES || 8 * 1024 * 1024)

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/**
 * Client-side pre-check before uploading. The backend validates again -
 * this only gives the user faster feedback.
 */
export function validateImageFile(file) {
  if (!file) return 'Please choose a file.'
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Choose a PNG, JPG, WEBP or GIF image.'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Image must be smaller than ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`
  }
  return null
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
