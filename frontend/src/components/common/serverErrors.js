/**
 * Map a backend 422 response onto React Hook Form fields.
 *
 * Kept out of Form.jsx so that file only exports components (React Fast Refresh
 * requires component-only modules).
 */
export function applyServerErrors(error, setError, knownFields = []) {
  if (!error?.errors) return false
  let mapped = false
  Object.entries(error.errors).forEach(([field, messages]) => {
    if (knownFields.length && !knownFields.includes(field)) return
    setError(field, {
      type: 'server',
      message: Array.isArray(messages) ? messages[0] : String(messages),
    })
    mapped = true
  })
  return mapped
}

export default applyServerErrors
