import { NavLink } from 'react-router-dom'

const SECTIONS: { to: string; label: string; end?: boolean }[] = [
  { to: '/dashboard/events', label: 'All Events', end: true },
  { to: '/dashboard/events/mine', label: 'My Events' },
  { to: '/dashboard/events/organised', label: 'Organised Events' },
  { to: '/dashboard/search-photos', label: 'Search My Photos' },
  { to: '/dashboard/photos', label: 'My Photos' },
]

export function SideMenu() {
  return (
    <nav className="flex w-52 shrink-0 flex-col border-r border-gray-300 py-4">
      {SECTIONS.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          end={section.end}
          className={({ isActive }) =>
            `border-l-2 px-4 py-2 text-sm ${
              isActive ? 'border-black bg-gray-100 font-medium text-black' : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  )
}
