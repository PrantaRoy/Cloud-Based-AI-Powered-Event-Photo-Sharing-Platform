import { Link } from 'react-router-dom'
import { useEventsList } from '../../hooks/useEventsList'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { Spinner } from '../../components/common/Spinner'
import { Button } from '../../components/common/Button'
import { formatDate } from '../../lib/format'

export function MyEventsPage() {
  const { events, loading, error, hasMore, loadMore } = useEventsList({ scope: 'mine' })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-black">My Events</h1>
      {error && <ErrorBanner message={error} />}
      {loading && events.length === 0 ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState title="You haven't joined any events yet" />
      ) : (
        <>
          <div className="flex flex-col divide-y divide-gray-200 border border-gray-300">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-4 p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-gray-300 bg-gray-100">
                  {event.thumbnail_url ? (
                    <img src={event.thumbnail_url} alt={event.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-400">No image</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-black">{event.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(event.event_date)} · {event.venue}
                  </p>
                  <p className="text-xs text-gray-500">Created by {event.creator?.name}</p>
                  {event.my_registered_at && <p className="text-xs text-gray-500">Joined on {formatDate(event.my_registered_at)}</p>}
                </div>
                <Link
                  to={`/dashboard/events/${event.id}`}
                  className="border border-gray-400 px-3 py-1.5 text-xs text-black hover:bg-gray-100"
                >
                  Details
                </Link>
              </div>
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
