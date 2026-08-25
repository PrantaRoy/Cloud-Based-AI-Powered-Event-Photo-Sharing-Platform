import { apiRequest } from './client'

export interface PhotoSearchResponse {
  matches: unknown[]
  status: string
}

export function searchPhotosBySelfie(file: File): Promise<PhotoSearchResponse> {
  const formData = new FormData()
  formData.append('selfie', file)
  return apiRequest<PhotoSearchResponse>('/photo-search', { method: 'POST', body: formData, isFormData: true })
}
