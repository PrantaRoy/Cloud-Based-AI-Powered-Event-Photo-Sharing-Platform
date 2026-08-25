import { useState } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { ErrorBanner } from '../common/ErrorBanner'
import { useAuth } from '../../hooks/useAuth'
import { updateProfile } from '../../api/profile'
import { ApiError } from '../../api/client'
import type { FieldErrors } from '../../types/api'

interface EditProfileModalProps {
  onClose: () => void
  // Judgment call: the plan lists "See profile" and "Edit profile" as two
  // separate dropdown entries, but only one component (EditProfileModal) in
  // the components/profile/ list. Both entries open this same modal - "See
  // profile" starts it in read-only mode with an inline "Edit" button,
  // "Edit profile" jumps straight into the editable form.
  initialMode?: 'view' | 'edit'
}

export function EditProfileModal({ onClose, initialMode = 'view' }: EditProfileModalProps) {
  const { user, setUser } = useAuth()
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [errors, setErrors] = useState<FieldErrors | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!user) return null

  async function handleSave() {
    setSaving(true)
    setGeneralError(null)
    setErrors(null)
    try {
      const updated = await updateProfile({ name, email })
      setUser(updated)
      setMode('view')
    } catch (err) {
      if (err instanceof ApiError) {
        setGeneralError(err.message)
        setErrors(err.fieldErrors)
      } else {
        setGeneralError('Something went wrong.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={mode === 'view' ? 'Profile' : 'Edit profile'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {generalError && <ErrorBanner message={generalError} />}
        {mode === 'view' ? (
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="text-black">{user.name}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="text-black">{user.email}</p>
            </div>
            <div>
              <p className="text-gray-500">Role</p>
              <p className="text-black">{user.role}</p>
            </div>
            <div className="pt-2">
              <Button variant="secondary" onClick={() => setMode('edit')}>
                Edit profile
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors?.name?.[0]} />
            <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors?.email?.[0]} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setMode('view')} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
