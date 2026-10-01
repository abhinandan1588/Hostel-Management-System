import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Images, Utensils } from 'lucide-react'

import {
  Avatar,
  Card,
  DataState,
  DateStepper,
  Loader,
  PageHeader,
  Section,
} from '../../components/common'
import { MealCard, MealGallery, PhotoLightbox } from '../../components/meals/MealCard'
import { useApi } from '../../hooks'
import { parentPortalService } from '../../services'
import { formatLongDate, shiftDate, todayISO } from '../../utils/format'

function ChildSwitcher({ items, value, onChange, id = 'meals-child' }) {
  if (!items?.length || items.length < 2) return null
  return (
    <Card className="card-pad mb-4">
      <label htmlFor={id} className="label">
        Viewing records for
      </label>
      <select
        id={id}
        className="input sm:hidden"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {items.map((child) => (
          <option key={child.id} value={child.id}>
            {child.full_name}
            {child.student_class ? ` · Class ${child.student_class}` : ''}
          </option>
        ))}
      </select>
      <div className="hidden flex-wrap gap-2 sm:flex" role="group" aria-label="Choose a child">
        {items.map((child) => {
          const active = String(child.id) === String(value)
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onChange(String(child.id))}
              aria-pressed={active}
              className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Avatar src={child.profile_photo} name={child.full_name} size="xs" />
              {child.full_name}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

export default function ParentChildMeals() {
  const { id } = useParams()
  const navigate = useNavigate()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [lightbox, setLightbox] = useState(null)

  const query = useMemo(
    () => ({ date, start_date: shiftDate(date, -6), end_date: date }),
    [date],
  )
  const fetcher = useCallback(() => parentPortalService.meals(id, query), [id, query])
  const { data, loading, error, reload } = useApi(fetcher)

  const siblingsFetcher = useCallback(() => parentPortalService.children(), [])
  const { data: siblings } = useApi(siblingsFetcher)
  const child = siblings?.find((item) => String(item.id) === String(id))

  return (
    <>
      <PageHeader
        title="Meals"
        subtitle={`${child?.full_name ? `${child.full_name} · ` : ''}${formatLongDate(date)}`}
        actions={
          <Link to={`/parent/children/${id}`} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Profile
          </Link>
        }
      />

      <ChildSwitcher
        items={siblings}
        value={id}
        onChange={(nextId) => navigate(`/parent/children/${nextId}/meals`)}
      />

      <Card className="card-pad mb-4">
        <p className="label">Choose a day</p>
        <DateStepper value={date} onChange={setDate} max={today} />
      </Card>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={reload}
        isEmpty={false}
        skeleton={<Loader label="Loading meals…" />}
      >
        {(payload) => {
          const slots = payload.today?.slots || []
          const history = payload.history || []

          return (
            <div className="space-y-4">
              <Section
                title="Meals served"
                subtitle={formatLongDate(payload.today?.date || date)}
                icon={Utensils}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {slots.map((slot) => (
                    <MealCard
                      key={slot.meal_type}
                      slot={slot}
                      onPhotoClick={(photo, meal) => setLightbox({ photo, meal })}
                    />
                  ))}
                </div>
              </Section>

              <Section
                title="Recent meal photos"
                subtitle="Last seven days"
                icon={Images}
              >
                <MealGallery
                  meals={history}
                  onPhotoClick={(photo, meal) => setLightbox({ photo, meal })}
                />
              </Section>

              <p className="muted">
                Meals are the same for every student in the hostel. Photos are uploaded by hostel
                staff after each meal is served.
              </p>
            </div>
          )
        }}
      </DataState>

      <PhotoLightbox
        photo={lightbox?.photo}
        meal={lightbox?.meal}
        onClose={() => setLightbox(null)}
      />
    </>
  )
}
