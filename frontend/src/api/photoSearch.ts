import { apiRequest } from './client'
import type { EventMediaResource } from '../types/eventMedia'

export interface PhotoSearchResponse {
  matches: EventMediaResource[]
  // 'ok' | 'unavailable' (pipeline off) | 'no_face_detected_in_selfie' | ...
  status: string
}

/**
 * Run a selfie search for one event. `consent` must be sent (true) on the
 * first search — the backend records it on the membership and hard-blocks
 * (403) without it.
 */
export function searchEventPhotosBySelfie(
  eventId: number | string,
  file: File,
  consent?: boolean,
): Promise<PhotoSearchResponse> {
  const formData = new FormData()
  formData.append('selfie', file)
  if (consent) formData.append('consent', '1')
  return apiRequest<PhotoSearchResponse>(`/events/${eventId}/photo-search`, {
    method: 'POST',
    body: formData,
    isFormData: true,
  })
}

/** Previously computed matches for this event — a cheap read, no re-search. */
export function listMyEventMatches(eventId: number | string): Promise<PhotoSearchResponse> {
  return apiRequest<PhotoSearchResponse>(`/events/${eventId}/photo-search/mine`)
}

/** Withdraw facial-matching consent for this event and delete stored matches. */
export function withdrawFacialConsent(eventId: number | string): Promise<null> {
  return apiRequest<null>(`/events/${eventId}/photo-search/consent`, { method: 'DELETE' })
}
