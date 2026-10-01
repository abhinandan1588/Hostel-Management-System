import { useCallback, useMemo, useState } from 'react'
import { Bell, Siren } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CheckboxField,
  DataState,
  EmptyState,
  PageHeader,
  Pagination,
  SkeletonRows,
} from '../../components/common'
import { NotificationList } from '../../components/notifications/NotificationPanel'
import { useApi, usePagination } from '../../hooks'
import { emergencyService, notificationService, studentPortalService } from '../../services'
import { timeAgo } from '../../utils/format'
import { labelOf } from '../../utils/labels'

/**
 * The student's notification inbox plus any emergency alert addressed to them.
 */
export default function StudentNotifications() {
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [busyAlertId, setBusyAlertId] = useState(null)
  const [acknowledged, setAcknowledged] = useState(() => new Set())

  const query = useMemo(() => ({ page, per_page: perPage }), [page, perPage])
  const fetcher = useCallback(() => studentPortalService.notifications(query), [query])
  const { data: notifications, meta, loading, error, reload, refresh } = useApi(fetcher)

  const visible = useMemo(
    () => (unreadOnly ? (notifications || []).filter((item) => !item.is_read) : notifications || []),
    [notifications, unreadOnly],
  )

  const markRead = async (notification) => {
    try {
      await notificationService.markRead(notification.id)
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead()
      toast.success('All notifications marked as read.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const removeNotification = async (notification) => {
    try {
      await notificationService.remove(notification.id)
      toast.success('Notification removed.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const acknowledgeAlert = async (alert) => {
    setBusyAlertId(alert.id)
    try {
      await emergencyService.acknowledge(alert.id)
      toast.success('Acknowledged. The hostel office knows you have seen this.')
      setAcknowledged((current) => new Set(current).add(alert.id))
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyAlertId(null)
    }
  }

  const alerts = meta?.emergency_alerts || []
  const unreadCount = meta?.unread_count ?? 0

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount
            ? `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`
            : 'You are up to date'
        }
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={markAllRead}>
              Mark all read
            </Button>
          ) : null
        }
      />

      {/* Emergency alerts ------------------------------------------------ */}
      {alerts.length > 0 && (
        <section className="mb-4 space-y-2.5" aria-label="Emergency alerts">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-wrap items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3.5"
              role="alert"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                <Siren className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold tracking-wider text-red-700 uppercase">
                  Emergency · {labelOf('emergency', alert.alert_type)}
                </p>
                <p className="text-sm font-bold text-red-900">{alert.title}</p>
                <p className="mt-0.5 text-sm whitespace-pre-line text-red-800">{alert.message}</p>
                <p className="mt-1 text-[11px] text-red-600">
                  {timeAgo(alert.created_at)} · sent by {alert.created_by}
                </p>
              </div>
              <div className="shrink-0">
                {acknowledged.has(alert.id) ? (
                  <span className="badge-success">Acknowledged</span>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={busyAlertId === alert.id}
                    onClick={() => acknowledgeAlert(alert)}
                  >
                    I have seen this
                  </Button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <Card>
        <CardHeader
          title="Inbox"
          subtitle={meta ? `${meta.total} in total` : undefined}
          icon={Bell}
          action={
            <CheckboxField
              label="Unread only"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
            />
          }
        />
        <CardBody className="pt-0">
          <DataState
            loading={loading}
            error={error}
            onRetry={reload}
            data={notifications}
            loadingLabel="Loading notifications…"
            skeleton={<SkeletonRows rows={5} className="py-4" />}
            emptyIcon={Bell}
            emptyTitle="No notifications"
            emptyMessage="Updates about attendance, health, meals and progress will appear here."
          >
            <div className="pt-4">
              {unreadOnly && !visible.length ? (
                <EmptyState
                  icon={Bell}
                  title="Nothing unread on this page"
                  message="Turn off the unread filter to see the rest of your inbox."
                />
              ) : (
                <NotificationList
                  notifications={visible}
                  onMarkRead={markRead}
                  onDelete={removeNotification}
                  onMarkAllRead={markAllRead}
                  unreadCount={unreadCount}
                />
              )}
              <Pagination
                meta={meta}
                page={page}
                onPageChange={setPage}
                perPage={perPage}
                onPerPageChange={(value) => {
                  setPerPage(value)
                  reset()
                }}
              />
            </div>
          </DataState>
        </CardBody>
      </Card>
    </>
  )
}
