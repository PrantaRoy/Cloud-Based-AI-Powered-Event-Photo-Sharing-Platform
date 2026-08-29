import { Link } from 'react-router-dom'
import type { EventResource } from '../../types/event'
import { formatDate } from '../../lib/format'
import { EventShareButton } from './EventShareButton'

export function EventsTable({ events }: { events: EventResource[] }) {
  return (
    <div className="overflow-x-auto border border-gray-300">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50 text-gray-600">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Venue</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Participants</th>
            <th className="px-3 py-2 font-medium">Photos</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-gray-200 last:border-b-0">
              <td className="px-3 py-2 text-black">{event.name}</td>
              <td className="px-3 py-2 text-gray-700">{formatDate(event.event_date)}</td>
              <td className="px-3 py-2 text-gray-700">{event.venue}</td>
              <td className="px-3 py-2 text-gray-700">{event.status}</td>
              <td className="px-3 py-2 text-gray-700">{event.participants_count}</td>
              <td className="px-3 py-2 text-gray-700">{event.media_count}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-3">
                  <EventShareButton
                    event={event}
                    className="text-sm text-black underline hover:no-underline"
                  />
                  <Link
                    to={`/dashboard/events/organised/${event.id}/edit`}
                    className="text-sm text-black underline hover:no-underline"
                  >
                    Edit
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
