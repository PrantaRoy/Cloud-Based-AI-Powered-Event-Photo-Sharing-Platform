import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'
import { PhotoGrid } from '../../components/photos/PhotoGrid'
import { PhotoUploadButton } from '../../components/photos/PhotoUploadButton'
import { getEvent } from '../../api/events'
import { deleteEventPhoto, listEventPhotos, uploadEventPhoto } from '../../api/media'
import { joinEvent } from '../../api/participants'
import { ApiError, normalizePaginated } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../lib/format'
import type { EventResource } from '../../types/event'
import type { EventMediaResource } from '../../types/eventMedia'

export function EventDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [event, setEvent] = useState<EventResource | null>(null)
  const [photos, setPhotos] = useState<EventMediaResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    Promise.all([getEvent(id), listEventPhotos(id)])
      .then(([eventData, photosPayload]) => {
        setEvent(eventData)
        setPhotos(normalizePaginated(photosPayload).items)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load event.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleJoin() {
    if (!id) return
    setJoining(true)
    try {
      await joinEvent(id)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join event.')
    } finally {
      setJoining(false)
    }
  }

  async function handleUpload(file: File) {
    if (!id) return
    try {
      await uploadEventPhoto(id, file)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.')
    }
  }

  async function handleDeletePhoto(mediaId: number) {
    if (!id) return
    if (!confirm('Delete this photo?')) return
    try {
      await deleteEventPhoto(id, mediaId)
      setPhotos((prev) => prev.filter((p) => p.id !== mediaId))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete photo.')
    }
  }

  if (loading) return <Spinner />
  if (error && !event) return <ErrorBanner message={error} />
  if (!event) return null

  const canManage = user !== null && (user.role === 'admin' || user.id === event.organiser?.id || user.id === event.creator?.id)
  const canUpload = canManage || event.my_registered_at !== null

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-col gap-4 border border-gray-300 p-4 sm:flex-row">
        <div className="flex h-40 w-full shrink-0 items-center justify-center border border-gray-300 bg-gray-100 sm:w-56">
          {event.thumbnail_url ? (
            <img src={event.thumbnail_url} alt={event.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-gray-400">No image</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-lg font-semibold text-black">{event.name}</h1>
          <p className="text-sm text-gray-600">
            {formatDate(event.event_date)} · {event.venue}
          </p>
          <p className="text-sm text-gray-600">Status: {event.status}</p>
          <p className="text-sm text-gray-500">Organised by {event.organiser?.name}</p>
          <p className="text-sm text-gray-500">
            {event.participants_count} participants · {event.media_count} photos
          </p>
          <div className="mt-2">
            {event.my_registered_at ? (
              <p className="text-sm text-gray-600">Joined on {formatDate(event.my_registered_at)}</p>
            ) : (
              <Button onClick={handleJoin} disabled={joining}>
                {joining ? 'Joining…' : 'Join event'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-black">Photos</h2>
          {canUpload && <PhotoUploadButton onUpload={handleUpload} />}
        </div>
        {photos.length === 0 ? (
          <EmptyState title="No photos yet" />
        ) : (
          <PhotoGrid
            photos={photos}
            onDelete={handleDeletePhoto}
            canDelete={(photo) => canManage || photo.uploaded_by.id === user?.id}
          />
        )}
      </div>
    </div>
  )
}
