import { apiRequest } from './client'
import type { EventParticipentResource, ParticipantStatus } from '../types/eventParticipent'

export function listParticipants(eventId: number | string): Promise<EventParticipentResource[]> {
  return apiRequest<EventParticipentResource[]>(`/events/${eventId}/participants`)
}

export function joinEvent(eventId: number | string, emailNotify?: boolean): Promise<EventParticipentResource> {
  return apiRequest<EventParticipentResource>(`/events/${eventId}/participants`, {
    method: 'POST',
    body: emailNotify === undefined ? {} : { email_notify: emailNotify },
  })
}

export function updateParticipantStatus(
  eventId: number | string,
  participantId: number | string,
  status: ParticipantStatus,
): Promise<EventParticipentResource> {
  return apiRequest<EventParticipentResource>(`/events/${eventId}/participants/${participantId}`, {
    method: 'PATCH',
    body: { status },
  })
}
