import type { UserSummary } from './user'

// The DB enum: active|scheduled|ongoing|finished|cancelled|archived
//   active = published/listed, scheduled = dated & upcoming, ongoing = happening now
export type EventStatus = 'active' | 'scheduled' | 'ongoing' | 'finished' | 'cancelled' | 'archived'

export type EventStatusGroup = 'upcoming' | 'ongoing' | 'archived'

export type EventScope = 'all' | 'mine' | 'organised'

// Privacy values aren't enumerated in the API contract - kept as a plain
// string so the UI doesn't hard-fail if the backend accepts more than the
// two values the create/edit forms currently offer (public/private).
export type EventPrivacy = string

// EventResource
export interface EventResource {
  id: number
  name: string
  // Unique, immutable slug + the URLs derived from it (built by the backend).
  slug: string
  public_url: string
  qr_code_url: string
  event_date: string
  venue: string
  longitude: number | null
  latitude: number | null
  privacy: EventPrivacy
  status: EventStatus
  start_time: string | null
  end_time: string | null
  reg_auto_approve: boolean
  thumbnail_url: string | null
  my_registered_at: string | null
  organiser: UserSummary
  creator: UserSummary
  participants_count: number
  media_count: number
  created_at: string
  updated_at: string
}

export interface EventFormData {
  name: string
  event_date: string
  venue: string
  privacy: EventPrivacy
  longitude?: number | null
  latitude?: number | null
  start_time?: string | null
  end_time?: string | null
  reg_auto_approve?: boolean
}
