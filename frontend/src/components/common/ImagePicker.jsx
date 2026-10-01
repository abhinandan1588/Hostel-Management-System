import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Trash2, Upload } from 'lucide-react'

import { formatBytes, validateImageFile } from '../../utils/media'
import { Button } from './Primitives'

/**
 * Image picker with local preview before upload.
 *
 * Validation happens here for fast feedback and again server side - the backend
 * is the authority on file type, size and content.
 */
export function ImagePicker({
  onChange,
  multiple = false,
  label = 'Choose image',
  hint = 'PNG, JPG, WEBP or GIF. Max 8 MB each.',
  className = '',
  accept = 'image/png,image/jpeg,image/webp,image/gif',
}) {
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [error, setError] = useState(null)

  // Object URLs are derived from the selection, not stored in state, and are
  // revoked when the selection changes or the picker unmounts.
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  const handleSelect = (event) => {
    const selected = Array.from(event.target.files || [])
    if (!selected.length) return
    for (const file of selected) {
      const problem = validateImageFile(file)
      if (problem) {
        setError(problem)
        event.target.value = ''
        return
      }
    }
    setError(null)
    const next = multiple ? [...files, ...selected] : selected.slice(0, 1)
    setFiles(next)
    onChange?.(multiple ? next : next[0])
    event.target.value = ''
  }

  const removeAt = (index) => {
    const next = files.filter((_, position) => position !== index)
    setFiles(next)
    onChange?.(multiple ? next : null)
  }

  const clear = () => {
    setFiles([])
    setError(null)
    onChange?.(multiple ? [] : null)
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleSelect}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {previews.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-slate-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700"
        >
          <ImagePlus className="h-7 w-7" aria-hidden="true" />
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs">{hint}</span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className={multiple ? 'grid grid-cols-2 gap-3 sm:grid-cols-3' : ''}>
            {previews.map((url, index) => (
              <figure key={url} className="relative overflow-hidden rounded-xl border border-slate-200">
                <img
                  src={url}
                  alt={`Selected image ${index + 1} preview`}
                  className={`w-full object-cover ${multiple ? 'h-28' : 'h-44'}`}
                />
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute top-1.5 right-1.5 rounded-lg bg-white/90 p-1.5 text-red-600 shadow-sm hover:bg-white"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <figcaption className="truncate px-2 py-1.5 text-[11px] text-slate-500">
                  {files[index]?.name} · {formatBytes(files[index]?.size)}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Upload} onClick={() => inputRef.current?.click()}>
              {multiple ? 'Add more' : 'Replace'}
            </Button>
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default ImagePicker
