import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { Spinner } from '../../components/common/Spinner'
import { PhotoUploadButton } from '../../components/photos/PhotoUploadButton'
import { deleteEvent, getEvent, updateEvent, updateEventThumbnail } from '../../api/events'
import { ApiError } from '../../api/client'
import type { EventResource } from '../../types/event'
import type { FieldErrors } from '../../types/api'

export function EventEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [venue, setVenue] = useState('')
  const [privacy, setPrivacy] = useState('public')
  const [regAutoApprove, setRegAutoApprove] = useState(false)

  const [errors, setErrors] = useState<FieldErrors | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    getEvent(id)
      .then((e) => {
        setEvent(e)
        setName(e.name)
        setEventDate(e.event_date.slice(0, 10))
        setVenue(e.venue)
        setPrivacy(e.privacy)
        setRegAutoApprove(e.reg_auto_approve)
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load event.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    if (!id) return
    setSaving(true)
    setGeneralError(null)
    setErrors(null)
    try {
      const updated = await updateEvent(id, {
        name,
        event_date: eventDate,
        venue,
        privacy,
        reg_auto_approve: regAutoApprove,
      })
      setEvent(updated)
    } catch (err) {
      if (err instanceof ApiError) {
        setGeneralError(err.message)
        setErrors(err.fieldErrors)
      } else {
        setGeneralError('Something went wrong.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleThumbnailUpload(file: File) {
    if (!id) return
    try {
      const updated = await updateEventThumbnail(id, file)
      setEvent(updated)
    } catch (err) {
      setGeneralError(err instanceof ApiError ? err.message : 'Thumbnail upload failed.')
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm('Delete this event? This cannot be undone.')) return
    try {
      await deleteEvent(id)
      navigate('/dashboard/events/organised', { replace: true })
    } catch (err) {
      setGeneralError(err instanceof ApiError ? err.message : 'Failed to delete event.')
    }
  }

  if (loading) return <Spinner />
  if (loadError) return <ErrorBanner message={loadError} />
  if (!event) return null

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-lg font-semibold text-black">Edit event</h1>
      {generalError && <ErrorBanner message={generalError} />}

      <div className="flex items-center gap-4 border border-gray-300 p-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-gray-300 bg-gray-100">
          {event.thumbnail_url ? (
            <img src={event.thumbnail_url} alt={event.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-gray-400">No image</span>
          )}
        </div>
        <PhotoUploadButton onUpload={handleThumbnailUpload} label="Change thumbnail" />
      </div>

      <div className="flex flex-col gap-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors?.name?.[0]} />
        <Input
          label="Date"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          error={errors?.event_date?.[0]}
        />
        <Input label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} error={errors?.venue?.[0]} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Privacy</label>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm text-black"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={regAutoApprove} onChange={(e) => setRegAutoApprove(e.target.checked)} />
          Auto-approve registrations
        </label>
      </div>

      <div className="flex justify-between border-t border-gray-200 pt-4">
        <Button variant="danger" onClick={handleDelete}>
          Delete event
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
