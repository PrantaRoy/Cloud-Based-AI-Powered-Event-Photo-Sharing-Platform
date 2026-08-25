import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'
import { PhotoGrid } from '../../components/photos/PhotoGrid'
import { AlbumPickerModal } from '../../components/albums/AlbumPickerModal'
import { addPhotosToAlbum, deleteAlbum, getAlbum, removePhotoFromAlbum, renameAlbum } from '../../api/albums'
import { ApiError } from '../../api/client'
import type { AlbumResource } from '../../types/album'

export function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [album, setAlbum] = useState<AlbumResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showAddPhotos, setShowAddPhotos] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    getAlbum(id)
      .then((a) => {
        setAlbum(a)
        setNameDraft(a.name)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load album.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleRename() {
    if (!id || nameDraft.trim() === '') return
    try {
      const updated = await renameAlbum(id, nameDraft.trim())
      setAlbum(updated)
      setRenaming(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Rename failed.')
    }
  }

  async function handleDeleteAlbum() {
    if (!id) return
    if (!confirm('Delete this album? Photos themselves will not be deleted.')) return
    try {
      await deleteAlbum(id)
      navigate('/dashboard/photos', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete album.')
    }
  }

  async function handleRemovePhoto(mediaId: number) {
    if (!id) return
    try {
      await removePhotoFromAlbum(id, mediaId)
      setAlbum((prev) => (prev ? { ...prev, media: prev.media?.filter((m) => m.id !== mediaId) } : prev))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove photo.')
    }
  }

  if (loading) return <Spinner />
  if (error && !album) return <ErrorBanner message={error} />
  if (!album) return null

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between">
        {renaming ? (
          <div className="flex items-center gap-2">
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
            <Button onClick={handleRename}>Save</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setRenaming(false)
                setNameDraft(album.name)
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <h1 className="text-lg font-semibold text-black">{album.name}</h1>
        )}
        {!renaming && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRenaming(true)}>
              Rename
            </Button>
            <Button variant="secondary" onClick={() => setShowAddPhotos(true)}>
              Add photos
            </Button>
            <Button variant="danger" onClick={handleDeleteAlbum}>
              Delete album
            </Button>
          </div>
        )}
      </div>

      {!album.media || album.media.length === 0 ? (
        <EmptyState title="No photos in this album yet" />
      ) : (
        <PhotoGrid photos={album.media} onDelete={handleRemovePhoto} />
      )}

      {showAddPhotos && (
        <AlbumPickerModal
          mode="add"
          submitLabel="Add photos"
          onClose={() => setShowAddPhotos(false)}
          onSubmit={async ({ eventMediaIds }) => {
            if (!id) return
            await addPhotosToAlbum(id, eventMediaIds)
            load()
          }}
        />
      )}
    </div>
  )
}
