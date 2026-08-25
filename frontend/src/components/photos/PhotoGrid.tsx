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

export function PhotoGrid({ photos, onDelete, canDelete, selectable, selectedIds, onToggleSelect }: PhotoGridProps) {
  if (photos.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((photo) => {
        const selected = selectedIds?.has(photo.id) ?? false
        const showDelete = onDelete !== undefined && (canDelete ? canDelete(photo) : true)
        return (
          <div key={photo.id} className={`relative border ${selected ? 'border-black' : 'border-gray-300'}`}>
            <img
              src={photo.thumbnail_url ?? photo.url}
              alt={photo.file_name}
              className="aspect-square w-full object-cover"
              onClick={selectable ? () => onToggleSelect?.(photo.id) : undefined}
            />
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
          </div>
        )
      })}
    </div>
  )
}
