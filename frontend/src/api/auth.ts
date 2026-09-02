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

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

// POST /api/register -> same { user, token } shape as login. The backend
// (Fortify CreateNewUser) validates name, a unique email, and a confirmed
// password meeting Password::default() (min 8 chars).
export function register(payload: RegisterPayload): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/register', { method: 'POST', body: payload })
}

export function logout(): Promise<null> {
  return apiRequest<null>('/logout', { method: 'POST' })
}
