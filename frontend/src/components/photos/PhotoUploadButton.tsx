import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '../common/Button'

interface PhotoUploadButtonProps {
  onUpload: (file: File) => Promise<void>
  label?: string
}

export function PhotoUploadButton({ onUpload, label = 'Upload photo' }: PhotoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
      <Button type="button" variant="secondary" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? 'Uploading…' : label}
      </Button>
    </div>
  )
}
