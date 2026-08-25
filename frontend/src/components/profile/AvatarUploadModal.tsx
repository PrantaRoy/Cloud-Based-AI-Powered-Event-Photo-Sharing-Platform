import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { ErrorBanner } from '../common/ErrorBanner'
import { useAuth } from '../../hooks/useAuth'
import { updateProfilePhoto } from '../../api/profile'
import { ApiError } from '../../api/client'

export function AvatarUploadModal({ onClose }: { onClose: () => void }) {
  const { setUser } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setPreview(selected ? URL.createObjectURL(selected) : null)
  }

  async function handleUpload() {
    if (!file) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProfilePhoto(file)
      setUser(updated)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Update avatar" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        {preview && (
          <img src={preview} alt="Avatar preview" className="h-24 w-24 self-center rounded-full border border-gray-300 object-cover" />
        )}
        <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || saving}>
            {saving ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
