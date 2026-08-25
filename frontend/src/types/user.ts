export interface UserSummary {
  id: number
  name: string
  email: string
}

// UserProfileResource - GET/PATCH /api/profile, also returned by /api/login.
export interface UserProfile {
  id: number
  name: string
  email: string
  role: string
  email_verified_at: string | null
  profile_photo_url: string | null
  created_at: string
  updated_at: string
}
