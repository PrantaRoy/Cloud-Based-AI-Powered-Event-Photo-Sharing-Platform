import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '../common/Button'

interface PhotoUploadButtonProps {
  onUpload: (file: File) => Promise<void>
  label?: string
  multiple?: boolean
}

export function PhotoUploadButton({ onUpload, label = 'Upload photo', multiple = false }: PhotoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    setProgress(files.length > 1 ? { done: 0, total: files.length } : null)
    try {
      // Upload sequentially, one image at a time, so the server never
      // receives more than one file from this button at once.
      for (let i = 0; i < files.length; i++) {
        await onUpload(files[i])
        setProgress(files.length > 1 ? { done: i + 1, total: files.length } : null)
      }
    } finally {
      setUploading(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <Button type="button" variant="secondary" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? (progress ? `Uploading ${progress.done}/${progress.total}…` : 'Uploading…') : label}
      </Button>
    </div>
  )
}
