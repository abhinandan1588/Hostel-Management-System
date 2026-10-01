import { useCallback, useMemo, useState } from 'react'
import { Images, Info } from 'lucide-react'

import {
  Card,
  CardBody,
  CardHeader,
  DataState,
  DateStepper,
  PageHeader,
  SkeletonCards,
} from '../../components/common'
import { MealCard, MealGallery, PhotoLightbox } from '../../components/meals/MealCard'
import { useApi } from '../../hooks'
import { studentPortalService } from '../../services'
import { formatDate, formatLongDate, shiftDate, todayISO } from '../../utils/format'

/**
 * What was served, with the photos the kitchen uploaded. Read-only.
 */
export default function StudentMeals() {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [lightbox, setLightbox] = useState(null)

  const query = useMemo(
    () => ({ date, start_date: shiftDate(date, -6), end_date: date }),
    [date],
  )

  const fetcher = useCallback(() => studentPortalService.meals(query), [query])
  const { data, loading, error, reload } = useApi(fetcher)

  const openPhoto = (photo, meal) => setLightbox({ photo, meal })

  return (
    <>
      <PageHeader
        title="Meals"
        subtitle={formatLongDate(date)}
        actions={<DateStepper value={date} onChange={setDate} max={today} />}
      />

      <div
        className="mb-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
        role="note"
      >
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          The kitchen records each meal and uploads photos. Tap a photo to see it larger. To give
          feedback about the food, use <strong>Report an Issue</strong>.
        </p>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        data={data}
        isEmpty={(value) => !value}
        emptyTitle="No meals recorded"
        emptyMessage="Nothing has been recorded for this day yet."
        loadingLabel="Loading meals…"
        skeleton={<SkeletonCards count={4} />}
      >
        {(meals) => (
          <div className="space-y-4">
            <section aria-label={`Meals on ${formatDate(date)}`}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(meals.today?.slots || []).map((slot) => (
                  <MealCard key={slot.meal_type} slot={slot} onPhotoClick={openPhoto} />
                ))}
              </div>
            </section>

            <Card>
              <CardHeader
                title="Recent meal photos"
                subtitle={`${formatDate(shiftDate(date, -6))} – ${formatDate(date)}`}
                icon={Images}
              />
              <CardBody>
                <MealGallery meals={meals.history} onPhotoClick={openPhoto} />
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>

      <PhotoLightbox
        photo={lightbox?.photo}
        meal={lightbox?.meal}
        onClose={() => setLightbox(null)}
      />
    </>
  )
}
