import { useId } from 'react'

/**
 * Form field primitives shared by every form. They accept React Hook Form's
 * `register()` spread and render accessible labels, hints and error messages.
 */

function FieldShell({ id, label, error, hint, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  )
}

export function TextField({
  label,
  error,
  hint,
  required,
  className,
  type = 'text',
  inputClassName = '',
  ...rest
}) {
  const generated = useId()
  const id = rest.id || `field-${generated}`
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <input
        id={id}
        type={type}
        className={`input ${error ? 'input-error' : ''} ${inputClassName}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  )
}

export function TextArea({ label, error, hint, required, className, rows = 4, ...rest }) {
  const generated = useId()
  const id = rest.id || `field-${generated}`
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <textarea
        id={id}
        rows={rows}
        className={`input ${error ? 'input-error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  )
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  options = [],
  placeholder,
  children,
  ...rest
}) {
  const generated = useId()
  const id = rest.id || `field-${generated}`
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <select
        id={id}
        className={`input ${error ? 'input-error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value ?? option} value={option.value ?? option}>
            {option.label ?? option}
          </option>
        ))}
        {children}
      </select>
    </FieldShell>
  )
}

export function CheckboxField({ label, hint, error, className = '', ...rest }) {
  const generated = useId()
  const id = rest.id || `field-${generated}`
  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
          {...rest}
        />
        <label htmlFor={id} className="text-sm text-slate-700">
          {label}
        </label>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="hint">{hint}</p>}
    </div>
  )
}

/** Radio group used for attendance/status pickers. */
export function RadioGroup({ label, name, value, onChange, options, error, className = '' }) {
  return (
    <fieldset className={className}>
      {label && <legend className="label">{label}</legend>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value
          return (
            <label
              key={option.value}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="h-3.5 w-3.5 text-brand-700 focus:ring-brand-500"
              />
              {option.label}
            </label>
          )
        })}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Render backend field errors (422) that have no matching form field. */
export function FormErrors({ error, ignoreFields = [] }) {
  if (!error) return null
  const fieldErrors = error.errors || {}
  const extras = Object.entries(fieldErrors).filter(([field]) => !ignoreFields.includes(field))
  if (!extras.length && !error.message) return null
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm" role="alert">
      <p className="font-semibold text-red-800">{error.message}</p>
      {extras.length > 0 && (
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-red-700">
          {extras.map(([field, messages]) => (
            <li key={field}>
              <span className="font-medium capitalize">{field.replace(/_/g, ' ')}</span>:{' '}
              {Array.isArray(messages) ? messages.join(' ') : String(messages)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// `applyServerErrors` lives in ./serverErrors.js so this module only exports
// components (a Fast Refresh requirement). It is re-exported from the barrel.
