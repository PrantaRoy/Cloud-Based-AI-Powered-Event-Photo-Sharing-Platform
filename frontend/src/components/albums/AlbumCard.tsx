import { Link } from 'react-router-dom'

interface AlbumCardProps {
  title: string
  subtitle?: string
  coverUrl: string | null
  photoCount: number
  to: string
}

export function AlbumCard({ title, subtitle, coverUrl, photoCount, to }: AlbumCardProps) {
  return (
    <Link to={to} className="flex flex-col border border-gray-300 hover:border-gray-500">
      <div className="flex h-32 items-center justify-center border-b border-gray-300 bg-gray-100">
        {coverUrl ? (
          <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-gray-400">No photos</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-black">{title}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        <p className="text-xs text-gray-500">
          {photoCount} photo{photoCount === 1 ? '' : 's'}
        </p>
      </div>
    </Link>
  )
}
