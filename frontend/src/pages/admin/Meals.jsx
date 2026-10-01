import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Camera, Images, Pencil, Save, Trash2, Upload, Utensils } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataState,
  DateStepper,
  FormErrors,
  ImagePicker,
  Modal,
  PageHeader,
  Section,
  SkeletonCards,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { MealCard, MealGallery, PhotoLightbox } from '../../components/meals/MealCard'
import { useApi } from '../../hooks'
import { mealService } from '../../services'
import { formatDate, formatDateTime, shiftDate, todayISO } from '../../utils/format'
import { MEAL, labelOf } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

const FORM_FIELDS = ['name', 'food_items', 'served_at', 'remarks']

/** "12:30:00" -> "12:30" for <input type="time">. */
const toTimeInput = (value) => (value ? String(value).slice(0, 5) : '')

function MealForm({ slot, submitting, onSubmit, onCancel }) {
  const meal = slot.meal
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: meal?.name || labelOf('meal', slot.meal_type),
      food_items: (meal?.food_items || []).join('\n'),
      served_at: toTimeInput(meal?.served_at),
      remarks: meal?.remarks || '',
    },
  })

  const submit = async (values) => {
    setServerError(null)
    const payload = {
      name: values.name?.trim() || null,
      food_items: values.food_items
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      served_at: values.served_at || null,
      remarks: values.remarks?.trim() || null,
    }
    const result = await onSubmit(payload)
    if (result?.error) {
      const mapped = applyServerErrors(result.error, setError, FORM_FIELDS)
      if (!mapped) setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={FORM_FIELDS} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Meal name"
          placeholder={labelOf('meal', slot.meal_type)}
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Served at"
          type="time"
          error={errors.served_at?.message}
          {...register('served_at')}
        />
      </div>

      <TextArea
        label="Food items"
        rows={5}
        required
        placeholder={'Idli\nSambar\nCoconut chutney\nBanana'}
        hint="One item per line. Parents see this list exactly as you type it."
        error={errors.food_items?.message}
        {...register('food_items', {
          validate: (value) =>
            value
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean).length > 0 || 'List at least one food item.',
        })}
      />

      <TextArea
        label="Remarks"
        rows={2}
        hint="Anything worth noting: a special menu, a festival meal, a shortage."
        error={errors.remarks?.message}
        {...register('remarks')}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {slot.recorded ? 'Save changes' : 'Record meal'}
        </Button>
      </div>
    </form>
  )
}

export default function AdminMeals() {
  const [date, setDate] = useState(todayISO())
  const [editing, setEditing] = useState(null)
  const [photoSlot, setPhotoSlot] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState([])
  const [caption, setCaption] = useState('')
  const [pickerKey, setPickerKey] = useState(0)
  const [lightbox, setLightbox] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  const isToday = date === todayISO()
  const rangeStart = shiftDate(date, -6)

  const dayFetcher = useCallback(
    () => (date === todayISO() ? mealService.today() : mealService.forDate(date)),
    [date],
  )
  const { data: day, loading, error, reload, refresh } = useApi(dayFetcher)

  const statsFetcher = useCallback(
    () => mealService.stats({ start_date: shiftDate(date, -6), end_date: date }),
    [date],
  )
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    reload: reloadStats,
    refresh: refreshStats,
  } = useApi(statsFetcher)

  const galleryFetcher = useCallback(
    () => mealService.list({ start_date: shiftDate(date, -6), end_date: date }),
    [date],
  )
  const {
    data: gallery,
    loading: galleryLoading,
    error: galleryError,
    reload: reloadGallery,
    refresh: refreshGallery,
  } = useApi(galleryFetcher)

  const refreshAll = async () => {
    await refresh()
    await refreshStats()
    await refreshGallery()
  }

  const closePhotoModal = () => {
    setPhotoSlot(null)
    setFiles([])
    setCaption('')
    setPickerKey((current) => current + 1)
  }

  const saveMeal = async (payload) => {
    setSubmitting(true)
    try {
      await mealService.save({ date, meal_type: editing.meal_type, ...payload })
      toast.success(`${labelOf('meal', editing.meal_type)} saved for ${formatDate(date)}.`)
      setEditing(null)
      await refreshAll()
      return { ok: true }
    } catch (err) {
      return { error: err }
    } finally {
      setSubmitting(false)
    }
  }

  const uploadPhotos = async () => {
    if (!files.length) {
      toast.error('Choose at least one photo to upload.')
      return
    }
    setUploading(true)
    try {
      // Photos hang off a meal record, so create the record first if needed.
      let mealId = photoSlot.meal?.id
      if (!mealId) {
        const created = await mealService.save({ date, meal_type: photoSlot.meal_type })
        mealId = created.id
      }
      const result = await mealService.uploadPhotos(mealId, files, caption.trim() || undefined)
      toast.success(`${result?.uploaded ?? files.length} photo(s) uploaded.`)
      closePhotoModal()
      await refreshAll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const runAction = async (fn, message) => {
    setActionBusy(true)
    try {
      await fn()
      toast.success(message)
      setConfirm(null)
      await refreshAll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  const activePhotoSlot = photoSlot
    ? day?.slots?.find((slot) => slot.meal_type === photoSlot.meal_type) || photoSlot
    : null

  return (
    <>
      <PageHeader
        title="Meals"
        subtitle="Record what was served and upload photos so parents can see it."
        actions={
          <DateStepper
            value={date}
            max={todayISO()}
            onChange={(value) => {
              setDate(value)
              closePhotoModal()
            }}
          />
        }
      />

      <Card className="mb-4">
        <CardHeader
          title="Last 7 days"
          subtitle={`${formatDate(rangeStart)} – ${formatDate(date)}`}
        />
        <CardBody>
          <DataState
            loading={statsLoading}
            error={statsError}
            data={stats}
            onRetry={reloadStats}
            loadingLabel="Loading meal stats…"
            isEmpty={false}
          >
            {(data) => (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {Object.keys(MEAL).map((mealType) => (
                  <div
                    key={mealType}
                    className="rounded-xl bg-slate-100 px-3 py-2.5 text-center text-slate-700"
                  >
                    <p className="text-xl font-bold tabular-nums">
                      {data.counts?.[mealType] ?? 0}
                    </p>
                    <p className="text-[11px] font-semibold">{labelOf('meal', mealType)}</p>
                  </div>
                ))}
                <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-center text-brand-800">
                  <p className="text-xl font-bold tabular-nums">{data.total_meals ?? 0}</p>
                  <p className="text-[11px] font-semibold">Meals recorded</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-emerald-700">
                  <p className="text-xl font-bold tabular-nums">{data.total_photos ?? 0}</p>
                  <p className="text-[11px] font-semibold">Photos uploaded</p>
                </div>
              </div>
            )}
          </DataState>
        </CardBody>
      </Card>

      <section aria-label="Meals for the selected day" className="mb-4">
        <h2 className="section-title mb-3">
          {isToday ? "Today's meals" : `Meals on ${formatDate(date)}`}
        </h2>
        <DataState
          loading={loading}
          error={error}
          data={day}
          onRetry={reload}
          loadingLabel="Loading the day's meals…"
          skeleton={<SkeletonCards count={4} />}
          isEmpty={(value) => !value?.slots?.length}
          emptyIcon={Utensils}
          emptyTitle="No meal slots"
          emptyMessage="No meal slots were returned for this day."
        >
          {(data) => (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.slots.map((slot) => (
                <MealCard
                  key={slot.meal_type}
                  slot={slot}
                  onPhotoClick={(photo, meal) => setLightbox({ photo, meal })}
                  actions={
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={slot.recorded ? Pencil : Save}
                        className="min-h-9"
                        onClick={() => setEditing(slot)}
                      >
                        {slot.recorded ? 'Edit' : 'Record'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Camera}
                        className="min-h-9"
                        onClick={() => {
                          setFiles([])
                          setCaption('')
                          setPickerKey((current) => current + 1)
                          setPhotoSlot(slot)
                        }}
                        aria-label={`Manage photos for ${slot.label}`}
                      />
                      {slot.recorded && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="min-h-9"
                          onClick={() => setConfirm({ kind: 'meal', slot })}
                          aria-label={`Delete the ${slot.label} record`}
                        />
                      )}
                    </>
                  }
                />
              ))}
            </div>
          )}
        </DataState>
      </section>

      <Section
        title="Recent meal photos"
        subtitle={`${formatDate(rangeStart)} – ${formatDate(date)}`}
        icon={Images}
      >
        <DataState
          loading={galleryLoading}
          error={galleryError}
          data={gallery}
          onRetry={reloadGallery}
          loadingLabel="Loading the gallery…"
          emptyIcon={Images}
          emptyTitle="No meals in this period"
          emptyMessage="Record a meal and upload photos to build the gallery."
        >
          {(meals) => (
            <MealGallery
              meals={meals}
              onPhotoClick={(photo, meal) => setLightbox({ photo, meal })}
            />
          )}
        </DataState>
      </Section>

      {/* Record / edit a meal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.label} · ${formatDate(date)}` : 'Record a meal'}
        description="Food items are shown to parents and students exactly as entered."
      >
        {editing && (
          <MealForm
            key={`${editing.meal_type}-${date}`}
            slot={editing}
            submitting={submitting}
            onSubmit={saveMeal}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Photos for one slot */}
      <Modal
        open={Boolean(activePhotoSlot)}
        onClose={closePhotoModal}
        title={activePhotoSlot ? `Photos · ${activePhotoSlot.label}` : 'Meal photos'}
        description={`Photos are visible to parents and students. ${formatDate(date)}.`}
        size="lg"
      >
        {activePhotoSlot && (
          <div className="space-y-5">
            {activePhotoSlot.meal?.photos?.length > 0 && (
              <div>
                <h3 className="label">Already uploaded</h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {activePhotoSlot.meal.photos.map((photo) => (
                    <li
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-slate-200"
                    >
                      <img
                        src={mediaUrl(photo.file_path)}
                        alt={photo.caption || `${activePhotoSlot.label} photo`}
                        className="h-28 w-full object-cover"
                        loading="lazy"
                      />
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <span className="truncate text-[11px] text-slate-500">
                          {photo.caption || formatDateTime(photo.uploaded_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'photo', photo })}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          aria-label="Delete this photo"
                          title="Delete photo"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="label">Add photos</h3>
              <ImagePicker
                key={pickerKey}
                multiple
                label="Choose meal photos"
                onChange={(selected) => setFiles(selected || [])}
              />
            </div>

            <TextField
              label="Caption (optional)"
              placeholder="Lunch served in the dining hall"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />

            {!activePhotoSlot.recorded && (
              <p className="hint">
                This meal has not been recorded yet. Uploading will create the{' '}
                {activePhotoSlot.label.toLowerCase()} record for {formatDate(date)}.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={closePhotoModal} disabled={uploading}>
                Close
              </Button>
              <Button
                icon={Upload}
                loading={uploading}
                disabled={!files.length}
                onClick={uploadPhotos}
              >
                {files.length
                  ? `Upload ${files.length} photo${files.length === 1 ? '' : 's'}`
                  : 'Upload photos'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <PhotoLightbox
        photo={lightbox?.photo}
        meal={lightbox?.meal}
        onClose={() => setLightbox(null)}
      />

      <ConfirmDialog
        open={confirm?.kind === 'photo'}
        onClose={() => setConfirm(null)}
        loading={actionBusy}
        title="Delete this photo?"
        message="The photo is removed from the meal record and from storage. Parents will no longer see it."
        confirmLabel="Delete photo"
        onConfirm={() =>
          runAction(() => mealService.removePhoto(confirm.photo.id), 'Photo deleted.')
        }
      />

      <ConfirmDialog
        open={confirm?.kind === 'meal'}
        onClose={() => setConfirm(null)}
        loading={actionBusy}
        title="Delete this meal record?"
        message={`The ${confirm?.slot?.label?.toLowerCase() || 'meal'} record for ${formatDate(
          date,
        )} and all of its photos will be deleted.`}
        confirmLabel="Delete meal"
        requireTyped="DELETE"
        onConfirm={() =>
          runAction(() => mealService.remove(confirm.slot.meal.id), 'Meal record deleted.')
        }
      />
    </>
  )
}
