import type { ApiEnvelope, FieldErrors, NormalizedPage, PaginatedPayload } from '../types/api'

const RAW_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '')

const TOKEN_STORAGE_KEY = 'eventpro_token'

// Endpoints that must be called WITHOUT a bearer token - either there's no
// token yet, or (per the plan) sending one is simply wrong for these public
// auth actions.
const UNAUTHENTICATED_PATHS = ['/login', '/register', '/check-email', '/forgot-password', '/reset-password']

function isUnauthenticatedPath(path: string): boolean {
  return UNAUTHENTICATED_PATHS.some((p) => path.startsWith(p))
}

export class ApiError extends Error {
  statusCode: number
  fieldErrors: FieldErrors | null

  constructor(message: string, statusCode: number, fieldErrors: FieldErrors | null = null) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.fieldErrors = fieldErrors
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function hasToken(): boolean {
  return getToken() !== null
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

// Judgment call beyond the plan's literal spec: a lightweight, optional
// global hook so AuthContext can clear local auth state whenever ANY
// request (not just the boot-time profile fetch) comes back 401 - e.g. a
// token that expires mid-session. Registered once by AuthProvider.
type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  isFormData?: boolean
  signal?: AbortSignal
}

/**
 * Small hand-rolled fetch wrapper (no axios/react-query, per the "very
 * basic" brief). Unwraps the backend's {status, statusCode, message, data}
 * envelope, attaches the bearer token automatically except on the public
 * auth routes, and normalizes failures into ApiError.
 *
 * IMPORTANT: never sets `credentials: 'include'`. This is a bearer-token
 * SPA and the backend's CORS config runs with supports_credentials: false -
 * that flag is for the separate cookie-based Inertia app, not this one.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, isFormData = false, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (!isUnauthenticatedPath(path)) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    signal,
  })

  let envelope: ApiEnvelope<unknown> | null = null
  try {
    envelope = (await response.json()) as ApiEnvelope<unknown>
  } catch {
    // No JSON body (e.g. a 204 No Content) - envelope stays null.
  }

  if (!response.ok) {
    if (response.status === 401 && !isUnauthenticatedPath(path)) {
      unauthorizedHandler?.()
    }

    const message = envelope?.message ?? `Request failed with status ${response.status}`
    const fieldErrors =
      response.status === 422 && envelope?.data && typeof envelope.data === 'object'
        ? (envelope.data as FieldErrors)
        : null
    throw new ApiError(message, response.status, fieldErrors)
  }

  return (envelope?.data ?? null) as T
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Normalizes a paginated envelope's `data` payload, which per the plan's
 * "Notes to verify early" needs hands-on confirmation against the live
 * backend and may come back either as a flat array or as Laravel's full
 * paginator shape ({data, links, meta}). Handled generically here so
 * useEventsList and every list page work either way without changes once
 * the real shape is confirmed.
 */
export function normalizePaginated<T>(payload: PaginatedPayload<T>): NormalizedPage<T> {
  if (Array.isArray(payload)) {
    return { items: payload, nextPageUrl: null, currentPage: null, lastPage: null, total: payload.length }
  }
  return {
    items: payload.data ?? [],
    nextPageUrl: payload.links?.next ?? null,
    currentPage: payload.meta?.current_page ?? null,
    lastPage: payload.meta?.last_page ?? null,
    total: payload.meta?.total ?? null,
  }
}
