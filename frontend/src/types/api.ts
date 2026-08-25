// Every backend response is wrapped in this envelope.
export interface ApiEnvelope<T> {
  status: boolean
  statusCode: number
  message: string
  data: T
}

// 422 responses put field errors in `data` as {field: [messages]}.
export type FieldErrors = Record<string, string[]>

// --- Pagination -------------------------------------------------------
//
// NOTE (per the implementation plan): the exact JSON shape of a paginated
// envelope's `data` field needs empirical verification against the live
// backend - it may be a flat array, or Laravel's full paginator shape
// ({data, links, meta}). This wasn't verified against a running backend
// during this build (see api/client.ts's normalizePaginated docstring), so
// every paginated endpoint's response is typed as PaginatedPayload<T> and
// handled defensively/generically so it tolerates either shape.

export interface LaravelPaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  path: string
  per_page: number
  to: number | null
  total: number
}

export interface LaravelPaginationLinks {
  first: string | null
  last: string | null
  prev: string | null
  next: string | null
}

export interface LaravelPaginatedShape<T> {
  data: T[]
  links?: LaravelPaginationLinks
  meta?: LaravelPaginationMeta
}

export type PaginatedPayload<T> = T[] | LaravelPaginatedShape<T>

export interface NormalizedPage<T> {
  items: T[]
  nextPageUrl: string | null
  currentPage: number | null
  lastPage: number | null
  total: number | null
}
