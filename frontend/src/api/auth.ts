import { apiRequest } from './client'
import type { UserProfile } from '../types/user'

export interface CheckEmailResponse {
  exists: boolean
}

export interface LoginResponse {
  user: UserProfile
  token: string
}

export function checkEmail(email: string): Promise<CheckEmailResponse> {
  return apiRequest<CheckEmailResponse>('/check-email', { method: 'POST', body: { email } })
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/login', { method: 'POST', body: { email, password } })
}

export function logout(): Promise<null> {
  return apiRequest<null>('/logout', { method: 'POST' })
}
