import { apiRequest } from './client'
import type { AlbumResource, AlbumsIndexResponse } from '../types/album'

export function listAlbums(): Promise<AlbumsIndexResponse> {
  return apiRequest<AlbumsIndexResponse>('/albums')
}

export function getAlbum(id: number | string): Promise<AlbumResource> {
  return apiRequest<AlbumResource>(`/albums/${id}`)
}

export interface CreateAlbumPayload {
  name: string
  event_media_ids?: number[]
}

export function createAlbum(payload: CreateAlbumPayload): Promise<AlbumResource> {
  return apiRequest<AlbumResource>('/albums', { method: 'POST', body: payload })
}

export function renameAlbum(id: number | string, name: string): Promise<AlbumResource> {
  return apiRequest<AlbumResource>(`/albums/${id}`, { method: 'PATCH', body: { name } })
}

export function deleteAlbum(id: number | string): Promise<null> {
  return apiRequest<null>(`/albums/${id}`, { method: 'DELETE' })
}

export function addPhotosToAlbum(id: number | string, eventMediaIds: number[]): Promise<AlbumResource> {
  return apiRequest<AlbumResource>(`/albums/${id}/photos`, { method: 'POST', body: { event_media_ids: eventMediaIds } })
}

export function removePhotoFromAlbum(id: number | string, mediaId: number | string): Promise<null> {
  return apiRequest<null>(`/albums/${id}/photos/${mediaId}`, { method: 'DELETE' })
}
