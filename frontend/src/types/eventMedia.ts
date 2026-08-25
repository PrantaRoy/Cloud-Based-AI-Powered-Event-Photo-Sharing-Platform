import type { UserSummary } from './user'

// EventMediaResource
export interface EventMediaResource {
  id: number
  file_name: string
  url: string
  thumbnail_url: string | null
  processing_status: string
  uploaded_by: UserSummary
  created_at: string
}
