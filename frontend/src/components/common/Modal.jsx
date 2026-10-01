import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

import { useBodyScrollLock, useEscapeKey } from '../../hooks'
import { Button } from './Primitives'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

/**
 * Accessible modal dialog: focus is moved inside on open, Escape and the
 * backdrop close it, and body scrolling is locked while it is open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}) {
  const titleId = useId()
  const panelRef = useRef(null)

  useEscapeKey(() => onClose?.(), open)
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector(
        'input:not([type="hidden"]), select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
      )
      ;(focusable || panelRef.current)?.focus?.()
    }, 30)
    return () => clearTimeout(timer)
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-[var(--shadow-float)] sm:rounded-2xl ${SIZES[size]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {description && <p className="muted mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Confirmation dialog for destructive actions.
 *
 * Pass `requireTyped="DELETE"` for irreversible operations - the confirm button
 * stays disabled until the phrase is typed exactly.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  requireTyped,
  children,
}) {
  const [typed, setTyped] = useState('')
  const [wasOpen, setWasOpen] = useState(open)

  // Clear the typed confirmation as the dialog closes (state adjusted during
  // render rather than in an effect, so there is no extra render pass).
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open && typed !== '') setTyped('')
  }

  const blocked = Boolean(requireTyped) && typed.trim() !== requireTyped

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading} disabled={blocked}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          {message && <p className="text-sm text-slate-600">{message}</p>}
          {children}
          {requireTyped && (
            <label className="block">
              <span className="label">
                Type <span className="font-mono font-bold">{requireTyped}</span> to confirm
              </span>
              <input
                className="input"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                aria-label={`Type ${requireTyped} to confirm`}
              />
            </label>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default Modal
