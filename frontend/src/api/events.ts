import { apiRequest, buildQueryString } from './client'
import type { EventFormData, EventResource, EventScope, EventStatusGroup } from '../types/event'
import type { PaginatedPayload } from '../types/api'

export interface ListEventsParams {
  scope?: EventScope
  statusGroup?: EventStatusGroup
  page?: number
}

export function listEvents(params: ListEventsParams = {}): Promise<PaginatedPayload<EventResource>> {
  const qs = buildQueryString({
    scope: params.scope,
    status_group: params.statusGroup,
    page: params.page,
  })
  return apiRequest<PaginatedPayload<EventResource>>(`/events${qs}`)
}

export function getEvent(id: number | string): Promise<EventResource> {
  return apiRequest<EventResource>(`/events/${id}`)
}

export function createEvent(payload: EventFormData): Promise<EventResource> {
  return apiRequest<EventResource>('/events', { method: 'POST', body: payload })
}

export function updateEvent(id: number | string, payload: Partial<EventFormData>): Promise<EventResource> {
  return apiRequest<EventResource>(`/events/${id}`, { method: 'PATCH', body: payload })
}

export function deleteEvent(id: number | string): Promise<null> {
  return apiRequest<null>(`/events/${id}`, { method: 'DELETE' })
}

export function updateEventThumbnail(id: number | string, file: File): Promise<EventResource> {
  const formData = new FormData()
  formData.append('thumbnail', file)
  return apiRequest<EventResource>(`/events/${id}/thumbnail`, { method: 'POST', body: formData, isFormData: true })
}
