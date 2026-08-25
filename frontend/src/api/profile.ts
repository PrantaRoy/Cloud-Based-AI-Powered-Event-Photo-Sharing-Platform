import { apiRequest } from './client'
import type { UserProfile } from '../types/user'

export function getProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/profile')
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
}

export function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  return apiRequest<UserProfile>('/profile', { method: 'PATCH', body: payload })
}

export function updateProfilePhoto(file: File): Promise<UserProfile> {
  const formData = new FormData()
  formData.append('photo', file)
  return apiRequest<UserProfile>('/profile/photo', { method: 'POST', body: formData, isFormData: true })
}

export interface ChangePasswordPayload {
  current_password: string
  password: string
  password_confirmation: string
}

export function changePassword(payload: ChangePasswordPayload): Promise<null> {
  return apiRequest<null>('/password', { method: 'PUT', body: payload })
}
