import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { formatDate } from '../../lib/format'
import type { EventMediaResource } from '../../types/eventMedia'

interface PhotoGridProps {
  photos: EventMediaResource[]
  onDelete?: (mediaId: number) => void
  // Optional per-photo authorization check (e.g. organiser/admin OR the
  // uploader themselves). Defaults to "show delete for every photo" when
  // omitted but onDelete is provided.
  canDelete?: (photo: EventMediaResource) => boolean
  selectable?: boolean
  selectedIds?: Set<number>
  onToggleSelect?: (mediaId: number) => void
}

// Right-click / drag-save deterrent used on every gallery image and on the
// full-size preview. Not real DRM - just removes the obvious "Save image as".
const blockContextMenu = (e: MouseEvent) => e.preventDefault()

export function PhotoGrid({ photos, onDelete, canDelete, selectable, selectedIds, onToggleSelect }: PhotoGridProps) {
  const [preview, setPreview] = useState<EventMediaResource | null>(null)

  if (photos.length === 0) return null
  return (
    <div
      className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8"
      onContextMenu={blockContextMenu}
    >
      {photos.map((photo) => {
        const selected = selectedIds?.has(photo.id) ?? false
        const showDelete = onDelete !== undefined && (canDelete ? canDelete(photo) : true)
        return (
          <figure key={photo.id} className={`relative m-0 border ${selected ? 'border-black' : 'border-gray-300'}`}>
            <img
              src={photo.thumbnail_url ?? photo.url}
              alt={photo.file_name}
              draggable={false}
              onContextMenu={blockContextMenu}
              className="aspect-square w-full cursor-pointer select-none object-cover"
              onClick={() => (selectable ? onToggleSelect?.(photo.id) : setPreview(photo))}
            />
            {!selectable && photo.uploaded_by?.name && (
              <figcaption
                className="truncate px-1 py-0.5 text-[10px] leading-tight text-gray-500"
                title={`Uploaded by ${photo.uploaded_by.name}`}
              >
                {photo.uploaded_by.name}
              </figcaption>
            )}
            {selectable && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect?.(photo.id)}
                className="absolute left-1 top-1 h-4 w-4"
              />
            )}
            {showDelete && (
              <button
                onClick={() => onDelete?.(photo.id)}
                aria-label="Delete photo"
                className="absolute right-1 top-1 border border-gray-400 bg-white px-1.5 py-0.5 text-xs text-black hover:bg-gray-900 hover:text-white"
              >
                ✕
              </button>
            )}
          </figure>
        )
      })}

      {preview && <PhotoPreview photo={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function PhotoPreview({ photo, onClose }: { photo: EventMediaResource; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      onContextMenu={blockContextMenu}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 text-2xl leading-none text-white/80 hover:text-white"
      >
        ✕
      </button>

      <div className="relative max-h-[85vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.file_name}
          draggable={false}
          onContextMenu={blockContextMenu}
          className="max-h-[85vh] max-w-[92vw] select-none object-contain"
        />
        {/* transparent shield: absorbs right-click / long-press / drag on the image */}
        <div className="absolute inset-0" onContextMenu={blockContextMenu} />
      </div>

      <p
        className="mt-3 max-w-[92vw] truncate text-center text-sm text-white/80"
        onClick={(e) => e.stopPropagation()}
      >
        Uploaded by {photo.uploaded_by?.name ?? 'Unknown'}
        {photo.created_at ? ` · ${formatDate(photo.created_at)}` : ''}
      </p>
    </div>
  )
}
