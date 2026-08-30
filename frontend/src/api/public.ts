import { apiRequest, buildQueryString } from './client'
import type { EventResource, EventStatusGroup } from '../types/event'

export interface PublicStats {
  events: number
  participants: number
  photos: number
  faces: number
}

export function getPublicStats(): Promise<PublicStats> {
  return apiRequest<PublicStats>('/events/public/stats')
}

export interface ListPublicEventsParams {
  statusGroup?: EventStatusGroup
  q?: string
  lat?: number
  lng?: number
  limit?: number
}

// Unauthenticated event list backing the public landing page. Returns a
// plain array (not paginated) capped at `limit` on the server.
export function listPublicEvents(params: ListPublicEventsParams = {}): Promise<EventResource[]> {
  const qs = buildQueryString({
    status_group: params.statusGroup,
    q: params.q,
    lat: params.lat,
    lng: params.lng,
    limit: params.limit,
  })
  return apiRequest<EventResource[]>(`/events/public${qs}`)
}
