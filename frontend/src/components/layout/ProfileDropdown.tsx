import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { EditProfileModal } from '../profile/EditProfileModal'
import { AvatarUploadModal } from '../profile/AvatarUploadModal'
import { ChangePasswordModal } from '../profile/ChangePasswordModal'

type OpenModal = 'view' | 'edit' | 'avatar' | 'password' | null

export function ProfileDropdown() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [openModal, setOpenModal] = useState<OpenModal>(null)

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const firstName = user.name.split(' ')[0]

  function selectModal(modal: OpenModal) {
    setOpenModal(modal)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
      >
        {user.profile_photo_url ? (
          <img src={user.profile_photo_url} alt={user.name} className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-xs text-white">{initials}</span>
        )}
        <span className="text-black">{firstName}</span>
        <span className="text-gray-400">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 border border-gray-300 bg-white">
            <MenuItem label="See profile" onClick={() => selectModal('view')} />
            <MenuItem label="Edit profile" onClick={() => selectModal('edit')} />
            <MenuItem label="Update avatar" onClick={() => selectModal('avatar')} />
            <MenuItem label="Change password" onClick={() => selectModal('password')} />
            <div className="border-t border-gray-200">
              <MenuItem
                label="Logout"
                onClick={() => {
                  setOpen(false)
                  logout()
                }}
              />
            </div>
          </div>
        </>
      )}

      {openModal === 'view' && <EditProfileModal initialMode="view" onClose={() => setOpenModal(null)} />}
      {openModal === 'edit' && <EditProfileModal initialMode="edit" onClose={() => setOpenModal(null)} />}
      {openModal === 'avatar' && <AvatarUploadModal onClose={() => setOpenModal(null)} />}
      {openModal === 'password' && <ChangePasswordModal onClose={() => setOpenModal(null)} />}
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full px-3 py-2 text-left text-sm text-black hover:bg-gray-100">
      {label}
    </button>
  )
}
