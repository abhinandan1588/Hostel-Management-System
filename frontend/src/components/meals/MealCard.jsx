import { Clock, ImageOff, Utensils, X } from 'lucide-react'

import { formatTime } from '../../utils/format'
import { MEAL } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

/** One meal slot: items, serving time, remarks and photo thumbnails. */
export function MealCard({ slot, onPhotoClick, actions, className = '' }) {
  const meal = slot.meal
  const label = slot.label || MEAL[slot.meal_type]?.label || slot.meal_type

  return (
    <article className={`card overflow-hidden ${className}`}>
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Utensils className="h-4 w-4 text-brand-700" aria-hidden="true" />
            {label}
          </h3>
          {meal?.served_at && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatTime(meal.served_at)}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>

      <div className="px-4 py-3">
        {!slot.recorded || !meal ? (
          <p className="muted py-2">Not recorded yet.</p>
        ) : (
          <>
            {meal.food_items?.length > 0 ? (
              <ul className="mb-3 flex flex-wrap gap-1.5">
                {meal.food_items.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted mb-3">No food items listed.</p>
            )}

            {meal.photos?.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {meal.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onPhotoClick?.(photo, meal)}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200"
                  >
                    <img
                      src={mediaUrl(photo.file_path)}
                      alt={photo.caption || `${label} photo`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
                No photos uploaded
              </p>
            )}

            {meal.remarks && <p className="mt-3 text-xs text-slate-500">{meal.remarks}</p>}
          </>
        )}
      </div>
    </article>
  )
}

/** Lightbox for a meal photo. */
export function PhotoLightbox({ photo, meal, onClose }) {
  if (!photo) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Meal photo"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Close photo"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <figure className="max-h-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
        <img
          src={mediaUrl(photo.file_path)}
          alt={photo.caption || 'Meal photo'}
          className="max-h-[80vh] w-auto rounded-2xl object-contain"
        />
        <figcaption className="mt-3 text-center text-sm text-white/80">
          {meal?.name || ''}
          {meal?.date ? ` · ${meal.date}` : ''}
          {photo.caption ? ` · ${photo.caption}` : ''}
        </figcaption>
      </figure>
    </div>
  )
}

/** Grid of meal photos across several days. */
export function MealGallery({ meals, onPhotoClick }) {
  const photos = (meals || []).flatMap((meal) =>
    (meal.photos || []).map((photo) => ({ ...photo, meal })),
  )
  if (!photos.length) {
    return <p className="muted py-4">No meal photos in this period.</p>
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onPhotoClick?.(photo, photo.meal)}
          className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left"
        >
          <span className="block aspect-square overflow-hidden">
            <img
              src={mediaUrl(photo.file_path)}
              alt={photo.caption || `${photo.meal.name} photo`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </span>
          <span className="block px-2.5 py-2">
            <span className="block truncate text-xs font-semibold text-slate-800">
              {MEAL[photo.meal.meal_type]?.label || photo.meal.meal_type}
            </span>
            <span className="block text-[11px] text-slate-500">{photo.meal.date}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export default MealCard
