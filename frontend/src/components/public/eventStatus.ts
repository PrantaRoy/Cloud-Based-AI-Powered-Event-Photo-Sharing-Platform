// Shared display metadata for an event's status, used by the public event
// card and the public event details page.
export interface EventStatusMeta {
  label: string
  /** Tailwind classes for a pill: background + text + ring. */
  pill: string
  /** Solid dot colour class. */
  dot: string
}

export function eventStatusMeta(status: string): EventStatusMeta {
  switch (status) {
    case 'ongoing':
      return {
        label: 'Happening now',
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
        dot: 'bg-emerald-500',
      }
    case 'active':
      return {
        label: 'Open',
        pill: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
        dot: 'bg-indigo-500',
      }
    case 'scheduled':
      return {
        label: 'Upcoming',
        pill: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
        dot: 'bg-indigo-500',
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        pill: 'bg-rose-50 text-rose-700 ring-rose-600/20',
        dot: 'bg-rose-500',
      }
    case 'finished':
    case 'archived':
      return {
        label: status === 'finished' ? 'Completed' : 'Archived',
        pill: 'bg-gray-100 text-gray-600 ring-gray-500/20',
        dot: 'bg-gray-400',
      }
    default:
      return {
        label: status,
        pill: 'bg-gray-100 text-gray-600 ring-gray-500/20',
        dot: 'bg-gray-400',
      }
  }
}
