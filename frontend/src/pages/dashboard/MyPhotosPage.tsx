import { useEffect, useState } from 'react'
import { AlbumCard } from '../../components/albums/AlbumCard'
import { AlbumPickerModal } from '../../components/albums/AlbumPickerModal'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { Spinner } from '../../components/common/Spinner'
import { Button } from '../../components/common/Button'
import { createAlbum, listAlbums } from '../../api/albums'
import { ApiError } from '../../api/client'
import type { AlbumsIndexResponse } from '../../types/album'
import { formatDate } from '../../lib/format'

export function MyPhotosPage() {
  const [data, setData] = useState<AlbumsIndexResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    listAlbums()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load albums.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col gap-8">
      {error && <ErrorBanner message={error} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black">Event Albums</h2>
        {!data || data.auto.length === 0 ? (
          <EmptyState title="No event photos yet" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {data.auto.map((album) => (
              <AlbumCard
                key={album.event_id}
                title={album.event_name}
                subtitle={formatDate(album.event_date)}
                coverUrl={album.cover_url}
                photoCount={album.photo_count}
                to={`/dashboard/events/${album.event_id}`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-black">My Albums</h2>
          <Button onClick={() => setShowCreate(true)}>New album</Button>
        </div>
        {!data || data.custom.length === 0 ? (
          <EmptyState title="No custom albums yet" description="Create one from your event photos." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {data.custom.map((album) => (
              <AlbumCard
                key={album.id}
                title={album.name}
                coverUrl={album.cover_url}
                photoCount={album.photo_count}
                to={`/dashboard/albums/${album.id}`}
              />
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <AlbumPickerModal
          mode="create"
          submitLabel="Create album"
          onClose={() => setShowCreate(false)}
          onSubmit={async ({ name, eventMediaIds }) => {
            await createAlbum({ name: name ?? '', event_media_ids: eventMediaIds })
            load()
          }}
        />
      )}
    </div>
  )
}
