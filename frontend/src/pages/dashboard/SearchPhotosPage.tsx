import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '../../components/common/Button'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { ProgressBar } from '../../components/common/ProgressBar'
import { EmptyState } from '../../components/common/EmptyState'
import { searchPhotosBySelfie } from '../../api/photoSearch'
import { ApiError } from '../../api/client'

type Phase = 'idle' | 'uploading' | 'done'

export function SearchPhotosPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPreview(URL.createObjectURL(file))
    setPhase('uploading')
    setProgress(0)

    // Simulated progress bar, deliberately independent of the actual (fast)
    // network response: climbs to ~90% over ~2.5s, then the real response
    // snaps it to 100% once it resolves. Purely cosmetic UX per the plan -
    // the backend does no real matching yet, it just validates the upload
    // and returns an empty "coming soon" result without persisting anything.
    timerRef.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.random() * 12))
    }, 250)

    try {
      await searchPhotosBySelfie(file)
      stopTimer()
      setProgress(100)
      setTimeout(() => setPhase('done'), 300)
    } catch (err) {
      stopTimer()
      setError(err instanceof ApiError ? err.message : 'Search failed.')
      setPhase('idle')
    }
  }

  function reset() {
    stopTimer()
    setPhase('idle')
    setProgress(0)
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-lg font-semibold text-black">Search My Photos</h1>
      <p className="text-sm text-gray-600">Upload a selfie to find photos of yourself across events.</p>

      {error && <ErrorBanner message={error} />}

      {phase === 'idle' && (
        <div className="flex flex-col gap-3 border border-gray-300 p-4">
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
        </div>
      )}

      {phase === 'uploading' && (
        <div className="flex flex-col gap-3 border border-gray-300 p-4">
          {preview && <img src={preview} alt="Selfie preview" className="h-32 w-32 self-center object-cover" />}
          <ProgressBar progress={progress} />
          <p className="text-center text-sm text-gray-500">Searching…</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col gap-4">
          <EmptyState title="No matches yet" description="Photo matching is coming soon." />
          <Button variant="secondary" onClick={reset}>
            Search again
          </Button>
        </div>
      )}
    </div>
  )
}
