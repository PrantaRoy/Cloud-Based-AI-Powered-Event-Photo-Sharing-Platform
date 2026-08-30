import type { EventStatusGroup } from '../../types/event'

const OPTIONS: { value: EventStatusGroup | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Happening now' },
  { value: 'archived', label: 'Archived' },
]

interface EventStatusFilterProps {
  value: EventStatusGroup | 'all'
  onChange: (value: EventStatusGroup | 'all') => void
}

export function EventStatusFilter({ value, onChange }: EventStatusFilterProps) {
  return (
    <div className="flex gap-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`border px-3 py-1.5 text-sm ${
            value === option.value ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
