import { useCallback, useMemo, useState } from 'react'
import { BellRing, Siren } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  Card,
  CheckboxField,
  DataState,
  PageHeader,
  Pagination,
  SkeletonRows,
} from '../../components/common'
import { NotificationList } from '../../components/notifications/NotificationPanel'
import { useApi, usePagination } from '../../hooks'
import { emergencyService, notificationService, parentPortalService } from '../../services'
import { timeAgo } from '../../utils/format'
import { labelOf } from '../../utils/labels'

export default function ParentNotifications() {
  const { page, perPage, setPage, setPerPage, reset } = usePagination(20)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [acknowledging, setAcknowledging] = useState(null)

  const query = useMemo(() => ({ page, per_page: perPage }), [page, perPage])
  const fetcher = useCallback(() => parentPortalService.notifications(query), [query])
  const { data, meta, loading, error, reload, refresh } = useApi(fetcher)

  const visible = useMemo(
    () => (unreadOnly ? (data || []).filter((item) => !item.is_read) : data || []),
    [data, unreadOnly],
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

  const remove = async (notification) => {
    try {
      await notificationService.remove(notification.id)
      toast.success('Notification removed.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const acknowledge = async (alert) => {
    setAcknowledging(alert.id)
    try {
      await emergencyService.acknowledge(alert.id)
      toast.success('Acknowledged. The hostel office has been informed.')
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAcknowledging(null)
    }
  }

  const alerts = meta?.emergency_alerts || []
  const unreadCount = meta?.unread_count || 0

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount
            ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
            : 'Updates about your children'
        }
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={markAllRead}>
              Mark all read
            </Button>
          ) : null
        }
      />

      {/* ---------------------------------------------------- emergency alerts */}
      {alerts.length > 0 && (
        <section className="mb-4 space-y-2" aria-label="Emergency alerts">
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
                  {timeAgo(alert.created_at)}
                  {alert.student_name ? ` · regarding ${alert.student_name}` : ''} · sent by{' '}
                  {alert.created_by}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                loading={acknowledging === alert.id}
                onClick={() => acknowledge(alert)}
              >
                Acknowledge
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* ------------------------------------------------------------- filter */}
      <Card className="card-pad mb-4">
        <CheckboxField
          label="Show unread only"
          checked={unreadOnly}
          onChange={(event) => setUnreadOnly(event.target.checked)}
          hint={
            unreadOnly
              ? 'Showing unread notifications on this page only.'
              : 'Showing every notification on this page.'
          }
        />
      </Card>

      <Card className="card-pad">
        <DataState
          loading={loading}
          error={error}
          data={visible}
          onRetry={reload}
          loadingLabel="Loading notifications…"
          skeleton={<SkeletonRows rows={6} />}
          emptyIcon={BellRing}
          emptyTitle={unreadOnly ? 'Nothing unread' : 'No notifications'}
          emptyMessage={
            unreadOnly
              ? 'You have read every notification on this page.'
              : 'Updates about attendance, health, meals, school and progress will appear here.'
          }
        >
          {(rows) => (
            <NotificationList
              notifications={rows}
              onMarkRead={markRead}
              onDelete={remove}
              onMarkAllRead={markAllRead}
              unreadCount={unreadCount}
            />
          )}
        </DataState>

        {/* Outside DataState so filtering to unread never traps you on a page. */}
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
      </Card>
    </>
  )
}
