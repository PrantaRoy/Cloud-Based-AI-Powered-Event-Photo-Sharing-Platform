import type { EventMediaResource } from './eventMedia'

// One entry per event that has photos - computed on read by the backend,
// not a stored row.
export interface AutoAlbum {
  event_id: number
  event_name: string
  event_date: string
  cover_url: string | null
  photo_count: number
}

// AlbumResource - custom, user-created albums.
export interface AlbumResource {
  id: number
  name: string
  photo_count: number
  cover_url: string | null
  media?: EventMediaResource[]
  created_at: string
  updated_at: string
}

export interface AlbumsIndexResponse {
  auto: AutoAlbum[]
  custom: AlbumResource[]
}
