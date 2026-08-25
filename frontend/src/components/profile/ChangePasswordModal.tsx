import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { ErrorBanner } from '../common/ErrorBanner'
import { changePassword } from '../../api/profile'
import { ApiError } from '../../api/client'
import type { FieldErrors } from '../../types/api'

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<FieldErrors | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setGeneralError(null)
    setErrors(null)
    try {
      await changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      })
      setSuccess(true)
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
    <Modal title="Change password" onClose={onClose}>
      {success ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-black">Your password was updated.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {generalError && <ErrorBanner message={generalError} />}
          <Input
            label="Current password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={errors?.current_password?.[0]}
          />
          <Input
            label="New password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors?.password?.[0]}
          />
          <Input
            label="Confirm new password"
            type="password"
            required
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Update password'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
