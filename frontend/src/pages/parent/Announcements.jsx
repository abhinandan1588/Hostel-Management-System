import { useCallback, useMemo } from 'react'
import { CalendarRange, Megaphone, Paperclip } from 'lucide-react'

import {
  Badge,
  Card,
  DataState,
  PageHeader,
  SkeletonRows,
} from '../../components/common'
import { useApi } from '../../hooks'
import { parentPortalService } from '../../services'
import { formatDate, formatDateTime } from '../../utils/format'
import { labelOf } from '../../utils/labels'
import { mediaUrl } from '../../utils/media'

export default function ParentAnnouncements() {
  const fetcher = useCallback(() => parentPortalService.announcements(), [])
  const { data, loading, error, reload } = useApi(fetcher)

  // Newest first, using the publish date when present.
  const sorted = useMemo(() => {
    const rows = Array.isArray(data) ? [...data] : []
    return rows.sort((a, b) => {
      const left = a.start_date || a.created_at || ''
      const right = b.start_date || b.created_at || ''
      return right.localeCompare(left)
    })
  }, [data])

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Notices from the hostel office for guardians"
      />

      <DataState
        loading={loading}
        error={error}
        data={sorted}
        onRetry={reload}
        loadingLabel="Loading announcements…"
        skeleton={
          <Card className="card-pad">
            <SkeletonRows rows={4} />
          </Card>
        }
        emptyIcon={Megaphone}
        emptyTitle="No announcements"
        emptyMessage="When the hostel office publishes a notice for guardians it will appear here."
      >
        {(rows) => (
          <div className="space-y-3">
            {rows.map((announcement) => (
              <Card key={announcement.id} className="card-pad">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <Megaphone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-base font-bold text-slate-900">{announcement.title}</h2>
                      {announcement.is_current ? (
                        <Badge tone="success">Current</Badge>
                      ) : (
                        <Badge tone="neutral">Past</Badge>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="info">{labelOf('audience', announcement.audience)}</Badge>
                      {announcement.target_student_name && (
                        <Badge tone="neutral">{announcement.target_student_name}</Badge>
                      )}
                      {announcement.target_class && (
                        <Badge tone="neutral">Class {announcement.target_class}</Badge>
                      )}
                    </div>

                    <p className="mt-2.5 text-sm whitespace-pre-line text-slate-700">
                      {announcement.description}
                    </p>

                    {announcement.attachment && (
                      <a
                        href={mediaUrl(announcement.attachment)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                        Open attachment
                      </a>
                    )}

                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <CalendarRange className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        <dt className="font-semibold">Valid</dt>
                        <dd>
                          {announcement.start_date ? formatDate(announcement.start_date) : 'Always'}
                          {announcement.end_date ? ` – ${formatDate(announcement.end_date)}` : ''}
                        </dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="font-semibold">Posted</dt>
                        <dd>{formatDateTime(announcement.created_at)}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="font-semibold">By</dt>
                        <dd>{announcement.created_by}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DataState>
    </>
  )
}
