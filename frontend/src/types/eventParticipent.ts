import type { UserSummary } from './user'

export type ParticipantStatus = 'pending' | 'approved' | 'rejected'

// EventParticipentResource (spelling matches the backend resource name)
export interface EventParticipentResource {
  id: number
  status: ParticipantStatus
  registered_at: string
  approved_at: string | null
  email_notify: boolean
  user: UserSummary
}
