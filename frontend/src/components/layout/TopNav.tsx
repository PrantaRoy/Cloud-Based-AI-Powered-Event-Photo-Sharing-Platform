import { Link } from 'react-router-dom'
import { ProfileDropdown } from './ProfileDropdown'

export function TopNav() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-300 px-4">
      <Link to="/dashboard/events" className="text-base font-semibold tracking-tight text-black">
        EventPro
      </Link>
      <ProfileDropdown />
    </header>
  )
}
