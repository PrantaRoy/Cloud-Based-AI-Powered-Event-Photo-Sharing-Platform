import { Link } from 'react-router-dom'
import type { EventResource } from '../../types/event'
import { formatDate } from '../../lib/format'

export function EventCard({ event }: { event: EventResource }) {
  return (
    <div className="flex flex-col border border-gray-300">
      <div className="flex h-36 items-center justify-center border-b border-gray-300 bg-gray-100">
        {event.thumbnail_url ? (
          <img src={event.thumbnail_url} alt={event.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-gray-400">No image</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm font-semibold text-black">{event.name}</h3>
        <p className="text-xs text-gray-600">{formatDate(event.event_date)}</p>
        <p className="text-xs text-gray-600">{event.venue}</p>
        <p className="text-xs text-gray-500">Organised by {event.organiser?.name ?? event.creator?.name}</p>
        <div className="mt-auto pt-2">
          <Link
            to={`/dashboard/events/${event.id}`}
            className="inline-block border border-gray-400 px-3 py-1.5 text-xs text-black hover:bg-gray-100"
          >
            Details
          </Link>
        </div>
      </div>
    </div>
  )
}
