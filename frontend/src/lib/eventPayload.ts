import type { EventFormData } from '../types/event'

export interface EventFormState {
  name: string
  eventDate: string
  venue: string
  latitude: number | null
  longitude: number | null
  privacy: string
  startTime: string
  endTime: string
  regAutoApprove: boolean
}

/**
 * Turns the form's local state into the API payload. Empty datetime fields
 * are sent as `null` (the backend's `nullable|date` rules reject `""`), and
 * coordinates are only included when both are present.
 */
export function buildEventPayload(state: EventFormState): EventFormData {
  return {
    name: state.name,
    event_date: state.eventDate,
    venue: state.venue,
    privacy: state.privacy,
    latitude: state.latitude ?? null,
    longitude: state.longitude ?? null,
    start_time: state.startTime ? state.startTime : null,
    end_time: state.endTime ? state.endTime : null,
    reg_auto_approve: state.regAutoApprove,
  }
}
