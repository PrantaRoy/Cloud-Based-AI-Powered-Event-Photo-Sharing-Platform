import { useEffect, useState } from 'react'
import { Spinner } from '../../components/common/Spinner'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { EmptyState } from '../../components/common/EmptyState'
import { SelfieSearchPanel } from '../../components/photos/SelfieSearchPanel'
import { listEvents } from '../../api/events'
import { ApiError, normalizePaginated } from '../../api/client'
import type { EventResource } from '../../types/event'

/**
 * "Search My Photos" — the selfie search is per-event (the matcher runs
 * against one event's face index), so this page lists the events the user
 * has joined and opens a search panel for the one they pick.
 */
export function SearchPhotosPage() {
  const [events, setEvents] = useState<EventResource[]>([])
  const [selected, setSelected] = useState<EventResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    listEvents({ scope: 'mine' })
      .then((payload) => {
        const joined = normalizePaginated(payload).items.filter((e) => e.my_status === 'approved')
        setEvents(joined)
        setSelected((prev) => (prev ? joined.find((e) => e.id === prev.id) ?? null : null))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your events.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-black">Search My Photos</h1>
        <p className="text-sm text-gray-600">
          Pick an event you've joined, then upload a selfie to find the photos you appear in.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {events.length === 0 ? (
        <EmptyState
          title="No joined events yet"
          description="Join an event (or scan its QR code) to search its photos."
        />
      ) : !selected ? (
        <ul className="flex flex-col border border-gray-300">
          {events.map((event) => (
            <li key={event.id} className="border-b border-gray-200 last:border-b-0">
              <button
                onClick={() => setSelected(event)}
                className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-gray-100"
              >
                <span className="text-sm font-medium text-black">{event.name}</span>
                <span className="text-xs text-gray-500">{event.venue}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setSelected(null)}
            className="self-start text-sm text-black underline hover:no-underline"
          >
            ← All events
          </button>
          <h2 className="text-base font-semibold text-black">{selected.name}</h2>
          <SelfieSearchPanel
            eventId={selected.id}
            consented={selected.my_consent_facial_matching ?? false}
            onConsentChange={load}
          />
        </div>
      )}
    </div>
  )
}
