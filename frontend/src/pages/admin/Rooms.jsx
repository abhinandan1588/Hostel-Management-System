import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  BedDouble,
  Building2,
  ChevronDown,
  ChevronRight,
  DoorOpen,
  Home,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
  ConfirmDialog,
  DataState,
  EmptyState,
  FormErrors,
  Modal,
  PageHeader,
  Section,
  SelectField,
  SkeletonCards,
  SkeletonRows,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { OccupancyChart } from '../../components/dashboard/Charts'
import { StatCard } from '../../components/dashboard/StatCard'
import { useApi } from '../../hooks'
import { roomService, studentService } from '../../services'
import { formatPercent } from '../../utils/format'

const ROOM_FIELDS = [
  'building',
  'floor',
  'room_number',
  'capacity',
  'room_type',
  'bed_count',
  'notes',
  'is_active',
]

const ROOM_TYPES = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'DORMITORY', label: 'Dormitory' },
  { value: 'DELUXE', label: 'Deluxe' },
  { value: 'ACCESSIBLE', label: 'Accessible' },
  { value: 'SICK_BAY', label: 'Sick bay' },
]

/** Shared mutation runner: toast on both outcomes, then refresh the page data. */
function useAction(refresh) {
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async (fn, message, done) => {
      setBusy(true)
      try {
        await fn()
        toast.success(message)
        done?.()
        await refresh?.()
        return true
      } catch (error) {
        toast.error(error.message)
        return false
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )
  return { busy, run }
}

/* ---------------------------------------------------------------- room form */

function RoomForm({ room, onDone, onCancel }) {
  const isEdit = Boolean(room)
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      building: room?.building || 'Main Block',
      floor: room?.floor ?? 1,
      room_number: room?.room_number || '',
      capacity: room?.capacity ?? 4,
      room_type: room?.room_type || '',
      bed_count: '',
      notes: room?.notes || '',
      is_active: room ? room.is_active : true,
    },
  })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      const payload = {
        building: values.building.trim(),
        floor: Number(values.floor),
        room_number: values.room_number.trim(),
        capacity: Number(values.capacity),
        room_type: values.room_type || null,
        notes: values.notes?.trim() || null,
        is_active: Boolean(values.is_active),
      }
      if (!isEdit) {
        payload.bed_count =
          values.bed_count === '' || values.bed_count === null
            ? Number(values.capacity)
            : Number(values.bed_count)
      }
      if (isEdit) {
        await roomService.update(room.id, payload)
        toast.success('Room updated.')
      } else {
        await roomService.create(payload)
        toast.success('Room created.')
      }
      await onDone()
    } catch (error) {
      toast.error(error.message)
      if (!applyServerErrors(error, setError, ROOM_FIELDS)) setServerError(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={ROOM_FIELDS} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Building"
          required
          placeholder="Main Block"
          error={errors.building?.message}
          {...register('building', { required: 'Enter the building name.' })}
        />
        <TextField
          label="Floor"
          type="number"
          min={0}
          max={100}
          required
          error={errors.floor?.message}
          {...register('floor', {
            required: 'Enter the floor number.',
            min: { value: 0, message: 'Floor cannot be negative.' },
          })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Room number"
          required
          placeholder="101"
          error={errors.room_number?.message}
          {...register('room_number', { required: 'Enter the room number.' })}
        />
        <TextField
          label="Capacity"
          type="number"
          min={1}
          max={50}
          required
          hint="How many students the room can hold."
          error={errors.capacity?.message}
          {...register('capacity', {
            required: 'Enter the capacity.',
            min: { value: 1, message: 'Capacity must be at least 1.' },
          })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Room type"
          placeholder="Not specified"
          options={ROOM_TYPES}
          error={errors.room_type?.message}
          {...register('room_type')}
        />
        {!isEdit && (
          <TextField
            label="Beds to create"
            type="number"
            min={0}
            max={50}
            hint="Leave blank to create one bed per place in the capacity."
            error={errors.bed_count?.message}
            {...register('bed_count')}
          />
        )}
      </div>
      <TextArea label="Notes" rows={3} error={errors.notes?.message} {...register('notes')} />
      {isEdit && (
        <CheckboxField
          label="Room is in service"
          hint="Turn this off while a room is under maintenance."
          {...register('is_active')}
        />
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {isEdit ? 'Save changes' : 'Create room'}
        </Button>
      </div>
    </form>
  )
}

/* ----------------------------------------------------------------- bed form */

function BedForm({ room, bed, onDone, onCancel }) {
  const isEdit = Boolean(bed)
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      bed_number: bed?.bed_number || '',
      notes: bed?.notes || '',
      is_active: bed ? bed.is_active : true,
    },
  })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      if (isEdit) {
        await roomService.updateBed(bed.id, {
          bed_number: values.bed_number.trim(),
          notes: values.notes?.trim() || null,
          is_active: Boolean(values.is_active),
        })
        toast.success('Bed updated.')
      } else {
        await roomService.createBed({
          room_id: room.id,
          bed_number: values.bed_number.trim(),
          notes: values.notes?.trim() || null,
        })
        toast.success('Bed added.')
      }
      await onDone()
    } catch (error) {
      toast.error(error.message)
      if (!applyServerErrors(error, setError, ['bed_number', 'notes', 'is_active', 'room_id'])) {
        setServerError(error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <FormErrors error={serverError} ignoreFields={['bed_number', 'notes', 'is_active', 'room_id']} />
      <TextField
        label="Bed number"
        required
        placeholder="1"
        error={errors.bed_number?.message}
        {...register('bed_number', { required: 'Enter the bed number.' })}
      />
      <TextArea label="Notes" rows={2} error={errors.notes?.message} {...register('notes')} />
      {isEdit && (
        <CheckboxField
          label="Bed is usable"
          hint="Turn this off while a bed is broken or reserved."
          {...register('is_active')}
        />
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {isEdit ? 'Save bed' : 'Add bed'}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------- assign a bed */

function AssignBedForm({ student, onDone, onCancel }) {
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fetcher = useCallback(() => roomService.availableBeds(), [])
  const { data: beds, loading, error, reload } = useApi(fetcher)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { bed_id: '' } })

  const submit = async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await studentService.assignBed(student.id, Number(values.bed_id))
      toast.success(`${student.full_name} assigned a bed.`)
      await onDone()
    } catch (err) {
      toast.error(err.message)
      if (!applyServerErrors(err, setError, ['bed_id'])) setServerError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DataState
      loading={loading}
      error={error}
      data={beds}
      onRetry={reload}
      loadingLabel="Loading available beds…"
      emptyIcon={BedDouble}
      emptyTitle="No free beds"
      emptyMessage="Every bed is occupied. Add a room or release a bed first."
    >
      {(rows) => (
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <FormErrors error={serverError} ignoreFields={['bed_id']} />
          <SelectField
            label={`Bed for ${student.full_name}`}
            required
            placeholder="Select a bed"
            options={rows.map((bed) => ({
              value: bed.id,
              label: `${bed.room?.label || `Room ${bed.room?.room_number || ''}`} · Bed ${bed.bed_number}`,
            }))}
            error={errors.bed_id?.message}
            {...register('bed_id', { required: 'Choose a bed.' })}
          />
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" icon={BedDouble} loading={submitting}>
              Assign bed
            </Button>
          </div>
        </form>
      )}
    </DataState>
  )
}

/* ------------------------------------------------------------- room card --- */

function RoomCard({ room, onEdit, onDelete, onAddBed, onEditBed, onDeleteBed }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <DoorOpen className="h-4 w-4 text-brand-700" aria-hidden="true" />
            {room.label || `Room ${room.room_number}`}
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {room.occupied_beds}/{room.total_beds} beds occupied · capacity {room.capacity}
            {room.room_type ? ` · ${room.room_type.replace(/_/g, ' ').toLowerCase()}` : ''}
          </p>
          {!room.is_active && <span className="badge-neutral mt-1.5">Out of service</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => onAddBed(room)}
            aria-label={`Add a bed to ${room.label || room.room_number}`}
          >
            Bed
          </Button>
          <button
            type="button"
            onClick={() => onEdit(room)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
            aria-label={`Edit ${room.label || room.room_number}`}
            title="Edit room"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(room)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
            aria-label={`Delete ${room.label || room.room_number}`}
            title="Delete room"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {room.notes && <p className="mt-2 text-xs text-slate-500">{room.notes}</p>}

      {room.beds?.length ? (
        <ul className="mt-3 space-y-1.5">
          {room.beds.map((bed) => (
            <li
              key={bed.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <BedDouble className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                Bed {bed.bed_number}
              </span>
              {bed.student ? (
                <Link
                  to={`/admin/students/${bed.student.id}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-slate-800 hover:text-brand-700"
                >
                  <Avatar src={bed.student.profile_photo} name={bed.student.full_name} size="xs" />
                  <span className="truncate">
                    {bed.student.full_name}
                    <span className="ml-1 text-slate-400">{bed.student.student_code}</span>
                  </span>
                </Link>
              ) : (
                <span className="min-w-0 flex-1 text-xs text-slate-400">Empty</span>
              )}
              {!bed.is_active && <span className="badge-neutral">Unusable</span>}
              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onEditBed(room, bed)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-brand-700"
                  aria-label={`Edit bed ${bed.bed_number} in ${room.label || room.room_number}`}
                  title="Edit bed"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteBed(room, bed)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Delete bed ${bed.bed_number} in ${room.label || room.room_number}`}
                  title="Delete bed"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          No beds yet. Add at least one bed so students can be assigned here.
        </p>
      )}
    </article>
  )
}

/* ---------------------------------------------------- unassigned students -- */

function UnassignedPanel({ onAssign }) {
  const fetcher = useCallback(() => studentService.list({ unassigned: true, per_page: 100 }), [])
  const { data, meta, loading, error, reload } = useApi(fetcher)

  return (
    <Card>
      <CardHeader
        title="Students without a bed"
        subtitle={
          meta?.total
            ? `${meta.total} student${meta.total === 1 ? '' : 's'} waiting for an allocation`
            : 'Everyone with no bed assigned'
        }
        icon={Users}
      />
      <CardBody>
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={reload}
          skeleton={<SkeletonRows rows={3} />}
          loadingLabel="Loading students…"
          emptyIcon={BedDouble}
          emptyTitle="Everyone has a bed"
          emptyMessage="Every active student is allocated to a bed."
        >
          {(rows) => (
            <ul className="divide-y divide-slate-100">
              {rows.map((student) => (
                <li key={student.id} className="flex flex-wrap items-center gap-2.5 py-2.5">
                  <Avatar src={student.profile_photo} name={student.full_name} size="sm" />
                  <Link
                    to={`/admin/students/${student.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-brand-700"
                  >
                    {student.full_name}
                    <span className="block truncate text-xs text-slate-400">
                      {student.student_code}
                      {student.student_class ? ` · ${student.student_class}` : ''}
                    </span>
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={UserPlus}
                    onClick={() => onAssign(student)}
                    aria-label={`Assign a bed to ${student.full_name}`}
                  >
                    Assign bed
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </CardBody>
    </Card>
  )
}

/* ================================================================= page == */

export default function AdminRooms() {
  const [collapsed, setCollapsed] = useState({})
  const [roomForm, setRoomForm] = useState(null)
  const [bedForm, setBedForm] = useState(null)
  const [assigning, setAssigning] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [unassignedKey, setUnassignedKey] = useState(0)

  const summaryFetcher = useCallback(() => roomService.summary(), [])
  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    reload: reloadSummary,
    refresh: refreshSummary,
  } = useApi(summaryFetcher)

  const treeFetcher = useCallback(() => roomService.tree(), [])
  const {
    data: tree,
    loading: treeLoading,
    error: treeError,
    reload: reloadTree,
    refresh: refreshTree,
  } = useApi(treeFetcher)

  const refreshAll = useCallback(async () => {
    setUnassignedKey((current) => current + 1)
    await Promise.all([refreshTree(), refreshSummary()])
  }, [refreshTree, refreshSummary])

  const { busy, run } = useAction(refreshAll)

  const toggle = (key) => setCollapsed((current) => ({ ...current, [key]: !current[key] }))

  return (
    <>
      <PageHeader
        title="Rooms & beds"
        subtitle="Buildings, floors, rooms and bed allocation"
        actions={
          <Button icon={Plus} onClick={() => setRoomForm({ room: null })}>
            Add room
          </Button>
        }
      />

      {/* ------------------------------------------------------- occupancy */}
      <DataState
        loading={summaryLoading}
        error={summaryError}
        data={summary}
        onRetry={reloadSummary}
        isEmpty={false}
        skeleton={<SkeletonCards count={4} />}
      >
        {(data) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Total rooms"
                value={data.summary?.total_rooms}
                icon={DoorOpen}
                tone="brand"
              />
              <StatCard
                label="Occupied beds"
                value={`${data.summary?.occupied_beds ?? 0}/${data.summary?.total_beds ?? 0}`}
                icon={BedDouble}
                tone="info"
                hint={`${formatPercent(data.summary?.occupancy_rate)} occupancy`}
              />
              <StatCard
                label="Available beds"
                value={data.summary?.available_beds}
                icon={Home}
                tone="success"
              />
              <StatCard
                label="Unassigned students"
                value={data.summary?.unassigned_students}
                icon={Users}
                tone="warning"
                highlight
              />
            </div>

            <Section title="Occupancy by building" subtitle="Occupied vs available beds" icon={Building2}>
              <OccupancyChart data={data.by_building} />
            </Section>
          </div>
        )}
      </DataState>

      {/* ------------------------------------------------------------ tree */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Hostel layout"
              subtitle="Expand a building to see its floors, rooms and beds"
              icon={Building2}
              action={
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => setRoomForm({ room: null })}>
                  Add room
                </Button>
              }
            />
            <CardBody>
              <DataState
                loading={treeLoading}
                error={treeError}
                data={tree?.buildings}
                onRetry={reloadTree}
                skeleton={<SkeletonRows rows={5} />}
                loadingLabel="Loading hostel layout…"
                emptyIcon={Building2}
                emptyTitle="No rooms yet"
                emptyMessage="Add your first room to start allocating beds to students."
                emptyAction={
                  <Button icon={Plus} onClick={() => setRoomForm({ room: null })}>
                    Add room
                  </Button>
                }
              >
                {(buildings) => (
                  <div className="space-y-3">
                    {buildings.map((building) => {
                      const buildingKey = `b:${building.building}`
                      const buildingOpen = !collapsed[buildingKey]
                      const roomCount = building.floors.reduce(
                        (total, floor) => total + floor.rooms.length,
                        0,
                      )
                      return (
                        <section
                          key={buildingKey}
                          className="overflow-hidden rounded-2xl border border-slate-200"
                        >
                          <h3>
                            <button
                              type="button"
                              onClick={() => toggle(buildingKey)}
                              aria-expanded={buildingOpen}
                              className="flex w-full items-center gap-2 bg-slate-50 px-3.5 py-3 text-left hover:bg-slate-100"
                            >
                              {buildingOpen ? (
                                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
                              )}
                              <Building2 className="h-4 w-4 text-brand-700" aria-hidden="true" />
                              <span className="flex-1 text-sm font-bold text-slate-900">
                                {building.building || 'Unnamed building'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {building.floors.length} floor
                                {building.floors.length === 1 ? '' : 's'} · {roomCount} room
                                {roomCount === 1 ? '' : 's'}
                              </span>
                            </button>
                          </h3>

                          {buildingOpen && (
                            <div className="space-y-3 p-3">
                              {building.floors.map((floor) => {
                                const floorKey = `${buildingKey}:f:${floor.floor}`
                                const floorOpen = !collapsed[floorKey]
                                return (
                                  <section key={floorKey} className="rounded-xl border border-slate-100">
                                    <h4>
                                      <button
                                        type="button"
                                        onClick={() => toggle(floorKey)}
                                        aria-expanded={floorOpen}
                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
                                      >
                                        {floorOpen ? (
                                          <ChevronDown
                                            className="h-3.5 w-3.5 text-slate-400"
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <ChevronRight
                                            className="h-3.5 w-3.5 text-slate-400"
                                            aria-hidden="true"
                                          />
                                        )}
                                        <span className="flex-1 text-sm font-semibold text-slate-700">
                                          Floor {floor.floor}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          {floor.rooms.length} room
                                          {floor.rooms.length === 1 ? '' : 's'}
                                        </span>
                                      </button>
                                    </h4>
                                    {floorOpen && (
                                      <div className="grid gap-3 p-3 pt-0 sm:grid-cols-2">
                                        {floor.rooms.length ? (
                                          floor.rooms.map((room) => (
                                            <RoomCard
                                              key={room.id}
                                              room={room}
                                              onEdit={(target) => setRoomForm({ room: target })}
                                              onDelete={(target) =>
                                                setConfirm({ kind: 'room', room: target })
                                              }
                                              onAddBed={(target) =>
                                                setBedForm({ room: target, bed: null })
                                              }
                                              onEditBed={(target, bed) =>
                                                setBedForm({ room: target, bed })
                                              }
                                              onDeleteBed={(target, bed) =>
                                                setConfirm({ kind: 'bed', room: target, bed })
                                              }
                                            />
                                          ))
                                        ) : (
                                          <EmptyState
                                            className="sm:col-span-2"
                                            icon={DoorOpen}
                                            title="No rooms on this floor"
                                            message="Add a room to this floor to start allocating beds."
                                          />
                                        )}
                                      </div>
                                    )}
                                  </section>
                                )
                              })}
                            </div>
                          )}
                        </section>
                      )
                    })}
                  </div>
                )}
              </DataState>
            </CardBody>
          </Card>
        </div>

        {/* Remounting on `unassignedKey` re-fetches the list after any allocation change. */}
        <UnassignedPanel key={unassignedKey} onAssign={(student) => setAssigning(student)} />
      </div>

      {/* ---------------------------------------------------------- modals */}
      <Modal
        open={Boolean(roomForm)}
        onClose={() => setRoomForm(null)}
        title={roomForm?.room ? `Edit ${roomForm.room.label || roomForm.room.room_number}` : 'Add a room'}
        description={
          roomForm?.room
            ? 'Changing the capacity does not add or remove beds — manage beds individually.'
            : 'Beds are created automatically so you can allocate students straight away.'
        }
      >
        {roomForm && (
          <RoomForm
            key={roomForm.room?.id || 'new-room'}
            room={roomForm.room}
            onDone={async () => {
              setRoomForm(null)
              await refreshAll()
            }}
            onCancel={() => setRoomForm(null)}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(bedForm)}
        onClose={() => setBedForm(null)}
        title={bedForm?.bed ? `Edit bed ${bedForm.bed.bed_number}` : 'Add a bed'}
        description={
          bedForm?.room
            ? `In ${bedForm.room.label || `Room ${bedForm.room.room_number}`}`
            : undefined
        }
        size="sm"
      >
        {bedForm && (
          <BedForm
            key={bedForm.bed?.id || `new-bed-${bedForm.room?.id}`}
            room={bedForm.room}
            bed={bedForm.bed}
            onDone={async () => {
              setBedForm(null)
              await refreshAll()
            }}
            onCancel={() => setBedForm(null)}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title="Assign a bed"
        description="Only free beds are listed."
        size="sm"
      >
        {assigning && (
          <AssignBedForm
            student={assigning}
            onDone={async () => {
              setAssigning(null)
              await refreshAll()
            }}
            onCancel={() => setAssigning(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === 'room'}
        onClose={() => setConfirm(null)}
        loading={busy}
        title="Delete this room?"
        message={`${confirm?.room?.label || 'This room'} and its beds will be removed. Rooms with students still assigned cannot be deleted — release those beds first.`}
        confirmLabel="Delete room"
        requireTyped="DELETE"
        onConfirm={() =>
          run(() => roomService.remove(confirm.room.id), 'Room deleted.', () => setConfirm(null))
        }
      />

      <ConfirmDialog
        open={confirm?.kind === 'bed'}
        onClose={() => setConfirm(null)}
        loading={busy}
        title="Delete this bed?"
        message={`Bed ${confirm?.bed?.bed_number} in ${confirm?.room?.label || 'this room'} will be removed. An occupied bed cannot be deleted — release it first.`}
        confirmLabel="Delete bed"
        onConfirm={() =>
          run(() => roomService.removeBed(confirm.bed.id), 'Bed deleted.', () => setConfirm(null))
        }
      />
    </>
  )
}
