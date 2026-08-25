import { useState } from 'react'
import { useEventsList } from '../../hooks/useEventsList'
import { EventCard } from '../../components/events/EventCard'
import { EventStatusFilter } from '../../components/events/EventStatusFilter'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { Spinner } from '../../components/common/Spinner'
import { Button } from '../../components/common/Button'
import type { EventStatusGroup } from '../../types/event'

export function AllEventsPage() {
  const [statusGroup, setStatusGroup] = useState<EventStatusGroup | 'all'>('all')
  const { events, loading, error, hasMore, loadMore } = useEventsList({
    scope: 'all',
    statusGroup: statusGroup === 'all' ? undefined : statusGroup,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-black">All Events</h1>
        <EventStatusFilter value={statusGroup} onChange={setStatusGroup} />
      </div>

      {error && <ErrorBanner message={error} />}

      {loading && events.length === 0 ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState title="No events found" description="Try a different filter." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={loadMore} disabled={loading}>
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
