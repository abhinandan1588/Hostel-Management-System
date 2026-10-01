import { useCallback, useMemo } from 'react'
import { Megaphone, Paperclip } from 'lucide-react'

import {
  Badge,
  Card,
  DataState,
  PageHeader,
  SkeletonRows,
} from '../../components/common'
import { useApi } from '../../hooks'
import { studentPortalService } from '../../services'
import { formatDate, formatDateTime, parseApiDate } from '../../utils/format'
import { labelOf } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

/** Notices from the hostel office, newest first. Read-only. */
export default function StudentAnnouncements() {
  const fetcher = useCallback(() => studentPortalService.announcements(), [])
  const { data, loading, error, reload } = useApi(fetcher)

  const announcements = useMemo(() => {
    const rows = Array.isArray(data) ? [...data] : []
    // Newest first.
    return rows.sort((a, b) => {
      const first = parseApiDate(a.created_at || a.start_date)?.getTime() || 0
      const second = parseApiDate(b.created_at || b.start_date)?.getTime() || 0
      return second - first
    })
  }, [data])

  return (
    <>
      <PageHeader title="Announcements" subtitle="Notices from the hostel office" />

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        data={announcements}
        loadingLabel="Loading announcements…"
        skeleton={
          <Card className="card-pad">
            <SkeletonRows rows={4} />
          </Card>
        }
        emptyIcon={Megaphone}
        emptyTitle="No announcements"
        emptyMessage="When the hostel office posts a notice for you, it will appear here."
      >
        <ul className="space-y-3">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <Card as="article" className="card-pad">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="min-w-0 text-base font-bold text-slate-900">
                    {announcement.title}
                  </h2>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Badge tone="info">{labelOf('audience', announcement.audience)}</Badge>
                    {announcement.is_current ? (
                      <Badge tone="success">Current</Badge>
                    ) : (
                      <Badge tone="neutral">Past</Badge>
                    )}
                  </div>
                </div>

                {announcement.description && (
                  <p className="mt-2 text-sm whitespace-pre-line text-slate-700">
                    {announcement.description}
                  </p>
                )}

                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
                  <div className="flex gap-1.5">
                    <dt className="font-semibold">From</dt>
                    <dd>{formatDate(announcement.start_date)}</dd>
                  </div>
                  {announcement.end_date && (
                    <div className="flex gap-1.5">
                      <dt className="font-semibold">Until</dt>
                      <dd>{formatDate(announcement.end_date)}</dd>
                    </div>
                  )}
                  {announcement.target_class && (
                    <div className="flex gap-1.5">
                      <dt className="font-semibold">Class</dt>
                      <dd>{announcement.target_class}</dd>
                    </div>
                  )}
                  {announcement.target_student_name && (
                    <div className="flex gap-1.5">
                      <dt className="font-semibold">For</dt>
                      <dd>{announcement.target_student_name}</dd>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <dt className="font-semibold">Posted</dt>
                    <dd>
                      {formatDateTime(announcement.created_at)}
                      {announcement.created_by ? ` by ${announcement.created_by}` : ''}
                    </dd>
                  </div>
                </dl>

                {announcement.attachment && (
                  <a
                    href={mediaUrl(announcement.attachment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary btn-sm mt-3 inline-flex"
                  >
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                    Open attachment
                  </a>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </DataState>
    </>
  )
}
