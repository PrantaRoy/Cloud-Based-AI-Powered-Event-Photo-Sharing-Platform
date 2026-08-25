import { apiRequest } from './client'
import type { EventMediaResource } from '../types/eventMedia'
import type { PaginatedPayload } from '../types/api'

export function listEventPhotos(eventId: number | string, page?: number): Promise<PaginatedPayload<EventMediaResource>> {
  const qs = page ? `?page=${page}` : ''
  return apiRequest<PaginatedPayload<EventMediaResource>>(`/events/${eventId}/photos${qs}`)
}

export function uploadEventPhoto(eventId: number | string, file: File): Promise<EventMediaResource> {
  const formData = new FormData()
  formData.append('photo', file)
  return apiRequest<EventMediaResource>(`/events/${eventId}/photos`, { method: 'POST', body: formData, isFormData: true })
}

export function deleteEventPhoto(eventId: number | string, mediaId: number | string): Promise<null> {
  return apiRequest<null>(`/events/${eventId}/photos/${mediaId}`, { method: 'DELETE' })
}
