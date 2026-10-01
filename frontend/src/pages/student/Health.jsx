import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, HeartPulse, Info } from 'lucide-react'

import {
  Card,
  CardBody,
  CardHeader,
  DataState,
  EmptyState,
  PageHeader,
  SkeletonRows,
} from '../../components/common'
import { HealthCard, HealthHistoryItem } from '../../components/dashboard/HealthCard'
import { useApi } from '../../hooks'
import { studentPortalService } from '../../services'
import { formatDateTime } from '../../utils/format'
import { labelOf } from '../../utils/labels'

/**
 * The student's own health record, read-only.
 *
 * Health records are clinical entries kept by hostel staff. A student who feels
 * unwell reports it through "Report an Issue" (or tells a warden directly) and
 * staff then create the record.
 */
export default function StudentHealth() {
  const fetcher = useCallback(() => studentPortalService.health(), [])
  const { data, loading, error, reload } = useApi(fetcher)

  return (
    <>
      <PageHeader
        title="My health"
        subtitle="Recorded and maintained by hostel staff"
        actions={
          <Link to="/student/report-issue" className="btn-primary">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Report feeling unwell
          </Link>
        }
      />

      <div
        className="mb-4 flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3"
        role="note"
      >
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-700" aria-hidden="true" />
        <p className="text-sm text-brand-900">
          Only hostel staff can add or change a health record. If you are feeling unwell right now,
          tell a warden straight away - you can also send a note from{' '}
          <Link to="/student/report-issue" className="font-semibold underline">
            Report an Issue
          </Link>
          .
        </p>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        data={data}
        isEmpty={(value) => !value}
        emptyTitle="No health information"
        emptyMessage="Your health record has not been set up yet."
        loadingLabel="Loading your health record…"
        skeleton={
          <Card className="card-pad">
            <SkeletonRows rows={4} />
          </Card>
        }
      >
        {(health) => (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Current status"
                subtitle={
                  health.current?.recorded_at
                    ? `Last updated ${formatDateTime(health.current.recorded_at)}`
                    : 'No health issues recorded'
                }
                icon={HeartPulse}
              />
              <CardBody>
                <HealthCard health={health.current} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Health history"
                subtitle={
                  health.timeline?.length
                    ? `${health.timeline.length} record${health.timeline.length === 1 ? '' : 's'}`
                    : 'Nothing recorded yet'
                }
              />
              <CardBody className="pt-0">
                {health.timeline?.length ? (
                  <ul>
                    {health.timeline.map((record) => (
                      <HealthHistoryItem key={record.id} record={record} />
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={HeartPulse}
                    title={`You are marked as ${labelOf('health', health.current?.status).toLowerCase()}`}
                    message="No health records have been created for you yet."
                  />
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>
    </>
  )
}
