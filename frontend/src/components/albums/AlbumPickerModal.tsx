import { useEffect, useState } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { ErrorBanner } from '../common/ErrorBanner'
import { Spinner } from '../common/Spinner'
import { PhotoGrid } from '../photos/PhotoGrid'
import { listEvents } from '../../api/events'
import { listEventPhotos } from '../../api/media'
import { ApiError, normalizePaginated } from '../../api/client'
import type { EventResource } from '../../types/event'
import type { EventMediaResource } from '../../types/eventMedia'

interface AlbumPickerModalProps {
  onClose: () => void
  onSubmit: (params: { name?: string; eventMediaIds: number[] }) => Promise<void>
  mode: 'create' | 'add'
  submitLabel?: string
}

/**
 * Shared modal for both "create a new album from an event's photos"
 * (mode="create", used by MyPhotosPage) and "add more photos to an
 * existing album" (mode="add", used by AlbumDetailPage) - lets the user
 * pick an event, then multi-select its photos.
 */
export function AlbumPickerModal({ onClose, onSubmit, mode, submitLabel }: AlbumPickerModalProps) {
  const [events, setEvents] = useState<EventResource[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [photos, setPhotos] = useState<EventMediaResource[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listEvents({ scope: 'all' })
      .then((payload) => setEvents(normalizePaginated(payload).items))
      .catch(() => setError('Failed to load events.'))
      .finally(() => setEventsLoading(false))
  }, [])

  useEffect(() => {
    if (selectedEventId === null) {
      setPhotos([])
      return
    }
    setPhotosLoading(true)
    listEventPhotos(selectedEventId)
      .then((payload) => setPhotos(normalizePaginated(payload).items))
      .catch(() => setError('Failed to load photos for this event.'))
      .finally(() => setPhotosLoading(false))
  }, [selectedEventId])

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (mode === 'create' && name.trim() === '') {
      setError('Album name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ name: mode === 'create' ? name.trim() : undefined, eventMediaIds: Array.from(selectedIds) })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={mode === 'create' ? 'New album' : 'Add photos'} onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        {error && <ErrorBanner message={error} />}
        {mode === 'create' && <Input label="Album name" value={name} onChange={(e) => setName(e.target.value)} />}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Event</label>
          {eventsLoading ? (
            <Spinner />
          ) : (
            <select
              value={selectedEventId ?? ''}
              onChange={(e) => {
                setSelectedEventId(e.target.value ? Number(e.target.value) : null)
                setSelectedIds(new Set())
              }}
              className="border border-gray-300 px-3 py-2 text-sm text-black"
            >
              <option value="">Select an event…</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {photosLoading && <Spinner />}
        {!photosLoading && selectedEventId !== null && photos.length === 0 && (
          <p className="text-sm text-gray-500">No photos for this event yet.</p>
        )}
        {!photosLoading && photos.length > 0 && (
          <PhotoGrid photos={photos} selectable selectedIds={selectedIds} onToggleSelect={toggleSelect} />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || selectedIds.size === 0}>
            {saving ? 'Saving…' : (submitLabel ?? 'Save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
