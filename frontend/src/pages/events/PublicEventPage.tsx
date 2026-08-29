import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { Spinner } from '../../components/common/Spinner'
import { EventSharePanel } from '../../components/events/EventSharePanel'
import { getPublicEvent } from '../../api/events'
import { ApiError } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../lib/format'
import type { EventResource } from '../../types/event'

export function PublicEventPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [event, setEvent] = useState<EventResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [restrictedName, setRestrictedName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getPublicEvent(slug)
      .then((data) => setEvent(data))
      .catch((err) => {
        if (err instanceof ApiError && err.statusCode === 403) {
          const data = err.data as { name?: string } | null
          setRestrictedName(data?.name ?? 'This event')
        } else {
          setError('Event not found.')
        }
      })
      .finally(() => setLoading(false))
  }, [slug])

  const dashboardPath = `/dashboard/events/${slug}`

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-4 text-lg font-semibold text-black">EventPro</p>

        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="border border-gray-300 p-6">
            <p className="text-sm text-gray-700">{error}</p>
          </div>
        ) : restrictedName ? (
          <div className="flex flex-col gap-3 border border-gray-300 p-6">
            <h1 className="text-base font-semibold text-black">{restrictedName}</h1>
            <p className="text-sm text-gray-600">This event is private. Sign in to view its details.</p>
            <Link
              to="/login"
              state={{ from: { pathname: dashboardPath } }}
              className="self-start border border-gray-400 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100"
            >
              Sign in
            </Link>
          </div>
        ) : event ? (
          <div className="flex flex-col gap-4 border border-gray-300 p-6">
            <div className="flex h-40 w-full items-center justify-center border border-gray-300 bg-gray-100">
              {event.thumbnail_url ? (
                <img src={event.thumbnail_url} alt={event.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">No image</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold text-black">{event.name}</h1>
              <p className="text-sm text-gray-600">
                {formatDate(event.event_date)} · {event.venue}
              </p>
              <p className="text-sm text-gray-500">Organised by {event.organiser?.name}</p>
              <p className="text-sm text-gray-500">
                {event.participants_count} participants · {event.media_count} photos
              </p>
            </div>

            {isAuthenticated ? (
              <Button onClick={() => navigate(dashboardPath)}>Open in EventPro</Button>
            ) : (
              <Link
                to="/login"
                state={{ from: { pathname: dashboardPath } }}
                className="self-start border border-gray-400 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100"
              >
                Sign in to join
              </Link>
            )}

            <div className="border-t border-gray-200 pt-4">
              <EventSharePanel event={event} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
