import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'
import { PhotoGrid } from '../../components/photos/PhotoGrid'
import { PhotoUploadButton } from '../../components/photos/PhotoUploadButton'
import { SelfieSearchPanel } from '../../components/photos/SelfieSearchPanel'
import { EventShareButton } from '../../components/events/EventShareButton'
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
    getEvent(id)
      .then(async (eventData) => {
        setEvent(eventData)

        // Only fetch the gallery for people allowed to see it (organiser or
        // an approved participant) - the backend now 403s everyone else, and
        // there's no point round-tripping just to discard the result.
        const canManage =
          user !== null && (user.role === 'admin' || user.id === eventData.organiser?.id || user.id === eventData.creator?.id)
        if (canManage || eventData.my_status === 'approved') {
          const photosPayload = await listEventPhotos(id)
          setPhotos(normalizePaginated(photosPayload).items)
        } else {
          setPhotos([])
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load event.'))
      .finally(() => setLoading(false))
  }, [id, user])

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
  const isApproved = event.my_status === 'approved'
  const isPending = event.my_status === 'pending'
  const canUpload = canManage || isApproved

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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canManage ? null : isApproved ? (
              <Button variant="success" disabled>
                ✓ Joined
              </Button>
            ) : isPending ? (
              <span className="border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                Join request pending approval
              </span>
            ) : (
              <Button onClick={handleJoin} disabled={joining}>
                {joining ? 'Joining…' : 'Join event'}
              </Button>
            )}
            <EventShareButton
              event={event}
              label="Share / QR"
              className="border border-gray-400 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-black">Photos</h2>
          {canUpload ? (
            <PhotoUploadButton onUpload={handleUpload} />
          ) : isPending ? (
            <p className="text-sm text-gray-500">You can add photos once the organiser approves your request.</p>
          ) : null}
        </div>
        {canUpload ? (
          photos.length === 0 ? (
            <EmptyState title="No photos yet" />
          ) : (
            <PhotoGrid
              photos={photos}
              onDelete={handleDeletePhoto}
              canDelete={(photo) => canManage || photo.uploaded_by.id === user?.id}
            />
          )
        ) : isPending ? (
          <p className="text-sm text-gray-500">Photos will be visible once your join request is approved.</p>
        ) : (
          <p className="text-sm text-gray-500">Join this event to see its photos.</p>
        )}
      </div>

      {(isApproved || canManage) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-black">Find my photos</h2>
          <p className="text-sm text-gray-600">
            Upload a selfie to find the photos from this event that you appear in.
          </p>
          <SelfieSearchPanel
            eventId={event.id}
            consented={event.my_consent_facial_matching ?? false}
            onConsentChange={load}
          />
        </div>
      )}
    </div>
  )
}
