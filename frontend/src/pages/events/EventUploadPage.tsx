import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Spinner } from '../../components/common/Spinner'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { EmptyState } from '../../components/common/EmptyState'
import { PhotoGrid } from '../../components/photos/PhotoGrid'
import { PhotoUploadButton } from '../../components/photos/PhotoUploadButton'
import { SelfieSearchPanel } from '../../components/photos/SelfieSearchPanel'
import { getEvent } from '../../api/events'
import { joinEvent } from '../../api/participants'
import { listEventPhotos, uploadEventPhoto } from '../../api/media'
import { ApiError, normalizePaginated } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import type { EventResource } from '../../types/event'
import type { EventMediaResource } from '../../types/eventMedia'

type Phase = 'working' | 'ready' | 'pending' | 'error'

/**
 * QR-code landing page. The event QR encodes `/e/:slug/upload`, so scanning it
 * lands the visitor here: sign in if needed, auto-send a join request if they
 * are not a member yet, then let approved members add photos straight away.
 */
export function EventUploadPage() {
  const { slug } = useParams<{ slug: string }>()
  const { isAuthenticated, isLoading } = useAuth()
  const [phase, setPhase] = useState<Phase>('working')
  const [event, setEvent] = useState<EventResource | null>(null)
  const [photos, setPhotos] = useState<EventMediaResource[]>([])
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const loadPhotos = useCallback((id: string) => {
    listEventPhotos(id)
      .then((payload) => setPhotos(normalizePaginated(payload).items))
      .catch(() => {
        /* gallery is best-effort */
      })
  }, [])

  useEffect(() => {
    if (!slug || !isAuthenticated || startedRef.current) return
    startedRef.current = true

    async function run(eventSlug: string) {
      try {
        let current = await getEvent(eventSlug)

        if (!current.my_status) {
          try {
            await joinEvent(eventSlug)
          } catch (err) {
            // A concurrent join (or an existing membership) returns 422 -
            // re-fetch and trust the resulting status.
            if (!(err instanceof ApiError && err.statusCode === 422)) throw err
          }
          current = await getEvent(eventSlug)
        }

        setEvent(current)
        if (current.my_status === 'approved') {
          setPhase('ready')
          loadPhotos(eventSlug)
        } else {
          setPhase('pending')
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong.')
        setPhase('error')
      }
    }

    run(slug)
  }, [slug, isAuthenticated, loadPhotos])

  async function handleUpload(file: File) {
    if (!slug) return
    try {
      await uploadEventPhoto(slug, file)
      loadPhotos(slug)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.')
    }
  }

  function reloadEvent() {
    if (!slug) return
    getEvent(slug).then(setEvent).catch(() => { /* keep the current copy */ })
  }

  if (isLoading) {
    return (
      <Shell>
        <Spinner />
      </Shell>
    )
  }

  if (!slug) return <Navigate to="/" replace />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: { pathname: `/e/${slug}/upload` } }} />
  }

  const eventPath = `/dashboard/events/${slug}`

  return (
    <Shell>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {phase === 'working' && (
        <div className="flex flex-col items-center gap-3 py-6 text-sm text-gray-500">
          <Spinner />
          Setting up your access…
        </div>
      )}

      {phase === 'error' && !error && <ErrorBanner message="This event could not be opened." />}

      {phase === 'pending' && (
        <div className="flex flex-col gap-3">
          <h1 className="text-lg font-semibold text-black">Request sent</h1>
          <p className="text-sm text-gray-600">
            Your request to join {event ? <strong>{event.name}</strong> : 'this event'} has been sent. You can add
            photos once an organiser approves you.
          </p>
          <Link to={eventPath} className="text-sm text-black underline hover:no-underline">
            Open event page
          </Link>
        </div>
      )}

      {phase === 'ready' && event && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-gray-400">Add your photos</p>
            <h1 className="text-lg font-semibold text-black">{event.name}</h1>
          </div>

          <PhotoUploadButton onUpload={handleUpload} />

          {photos.length === 0 ? (
            <EmptyState title="No photos yet" />
          ) : (
            <PhotoGrid photos={photos} />
          )}

          <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">Find my photos</p>
            <SelfieSearchPanel
              eventId={event.id}
              consented={event.my_consent_facial_matching ?? false}
              onConsentChange={reloadEvent}
            />
          </div>

          <Link to={eventPath} className="text-sm text-black underline hover:no-underline">
            Open event page
          </Link>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md border border-gray-300 p-6">{children}</div>
    </div>
  )
}
