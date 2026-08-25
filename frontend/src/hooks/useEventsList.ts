import { useCallback, useEffect, useRef, useState } from 'react'
import { listEvents } from '../api/events'
import { ApiError, normalizePaginated } from '../api/client'
import type { EventResource, EventScope, EventStatusGroup } from '../types/event'

export interface UseEventsListParams {
  scope: EventScope
  statusGroup?: EventStatusGroup
}

export interface UseEventsListResult {
  events: EventResource[]
  loading: boolean
  error: string | null
  hasMore: boolean
  total: number | null
  refetch: () => void
  loadMore: () => void
}

/**
 * Shared list-fetching hook used by AllEventsPage, MyEventsPage, and
 * OrganisedEventsPage - same underlying GET /api/events call, different
 * fixed `scope` (and, for AllEventsPage, a variable `statusGroup` filter).
 * Paginated responses are normalized defensively via normalizePaginated()
 * since the exact envelope shape needs empirical confirmation against the
 * live backend (flat array vs Laravel's {data, links, meta} paginator).
 */
export function useEventsList({ scope, statusGroup }: UseEventsListParams): UseEventsListResult {
  const [events, setEvents] = useState<EventResource[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestId = useRef(0)

  // Reset to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1)
  }, [scope, statusGroup])

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)

    listEvents({ scope, statusGroup, page })
      .then((payload) => {
        if (id !== requestId.current) return
        const normalized = normalizePaginated(payload)
        setEvents((prev) => (page === 1 ? normalized.items : [...prev, ...normalized.items]))
        setTotal(normalized.total)
        setHasMore(
          normalized.nextPageUrl !== null ||
            (normalized.currentPage !== null && normalized.lastPage !== null && normalized.currentPage < normalized.lastPage),
        )
      })
      .catch((err) => {
        if (id !== requestId.current) return
        setError(err instanceof ApiError ? err.message : 'Failed to load events.')
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [scope, statusGroup, page, reloadToken])

  const refetch = useCallback(() => {
    setPage(1)
    setReloadToken((t) => t + 1)
  }, [])

  const loadMore = useCallback(() => {
    setPage((p) => p + 1)
  }, [])

  return { events, loading, error, hasMore, total, refetch, loadMore }
}
