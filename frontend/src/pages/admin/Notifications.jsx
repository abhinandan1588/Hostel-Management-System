import { useCallback, useMemo, useState } from 'react'
import { Bell, BellRing, CheckCheck } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
  ConfirmDialog,
  DataState,
  PageHeader,
  Pagination,
  SelectField,
  SkeletonRows,
} from '../../components/common'
import { NotificationList } from '../../components/notifications/NotificationPanel'
import { useApi, usePagination } from '../../hooks'
import { notificationService } from '../../services'
import { optionsFrom } from '../../utils/labels'

const NOTIFICATION_TYPES = [
  'HEALTH_ALERT',
  'ATTENDANCE_ALERT',
  'SCHOOL_STATUS',
  'PROGRESS_UPDATE',
  'MEAL_UPDATE',
  'ANNOUNCEMENT',
  'SUGGESTION_REPLY',
  'ACCOUNT_VERIFICATION',
  'EMERGENCY_ALERT',
  'ACTIVITY_UPDATE',
  'GENERAL',
]

export default function AdminNotifications() {
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [type, setType] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [markAllBusy, setMarkAllBusy] = useState(false)

  const query = useMemo(
    () => ({
      ...(unreadOnly ? { unread_only: true } : {}),
      ...(type ? { type } : {}),
      page,
      per_page: perPage,
    }),
    [unreadOnly, type, page, perPage],
  )

  const fetcher = useCallback(() => notificationService.list(query), [query])
  const { data: notifications, meta, loading, error, reload, refresh } = useApi(fetcher)

  const unreadCount = meta?.unread_count ?? 0

  const handleMarkRead = async (notification) => {
    try {
      await notificationService.markRead(notification.id)
      toast.success('Marked as read.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleMarkAllRead = async () => {
    setMarkAllBusy(true)
    try {
      await notificationService.markAllRead()
      toast.success('All notifications marked as read.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setMarkAllBusy(false)
    }
  }

  const handleDelete = async () => {
    setActionBusy(true)
    try {
      await notificationService.remove(deleteTarget.id)
      toast.success('Notification removed.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'} in your inbox`
            : 'Your inbox is up to date'
        }
        actions={
          <Button
            variant="secondary"
            icon={CheckCheck}
            loading={markAllBusy}
            disabled={unreadCount === 0}
            onClick={handleMarkAllRead}
          >
            Mark all read
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <SelectField
              label="Type"
              placeholder="All types"
              className="w-full sm:w-64"
              options={optionsFrom(NOTIFICATION_TYPES)}
              value={type}
              onChange={(event) => {
                setType(event.target.value)
                reset()
              }}
            />
            <CheckboxField
              label="Show unread only"
              className="pb-2.5"
              checked={unreadOnly}
              onChange={(event) => {
                setUnreadOnly(event.target.checked)
                reset()
              }}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Inbox"
          subtitle="Alerts raised by the hostel system for administrators"
          icon={unreadCount > 0 ? BellRing : Bell}
        />
        <CardBody>
          <DataState
            loading={loading}
            error={error}
            data={notifications}
            onRetry={reload}
            loadingLabel="Loading notifications…"
            skeleton={<SkeletonRows rows={6} />}
            emptyIcon={Bell}
            emptyTitle="No notifications"
            emptyMessage={
              unreadOnly || type
                ? 'Nothing matches the current filters.'
                : 'Health, attendance and account updates will appear here.'
            }
          >
            {(rows) => (
              <>
                <NotificationList
                  notifications={rows}
                  unreadCount={unreadCount}
                  onMarkRead={handleMarkRead}
                  onDelete={(notification) => setDeleteTarget(notification)}
                  onMarkAllRead={handleMarkAllRead}
                />
                <Pagination
                  meta={meta}
                  page={page}
                  onPageChange={setPage}
                  perPage={perPage}
                  onPerPageChange={(size) => {
                    setPerPage(size)
                    reset()
                  }}
                />
              </>
            )}
          </DataState>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={actionBusy}
        title="Remove notification?"
        message={
          deleteTarget
            ? `“${deleteTarget.title}” will be removed from your inbox. The underlying record is not affected.`
            : ''
        }
        confirmLabel="Remove"
      />
    </>
  )
}
