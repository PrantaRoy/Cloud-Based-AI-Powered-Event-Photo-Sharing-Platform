import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '../common/Button'
import { ErrorBanner } from '../common/ErrorBanner'
import { ProgressBar } from '../common/ProgressBar'
import { EmptyState } from '../common/EmptyState'
import { PhotoGrid } from './PhotoGrid'
import { searchEventPhotosBySelfie, listMyEventMatches, withdrawFacialConsent } from '../../api/photoSearch'
import { ApiError } from '../../api/client'
import type { EventMediaResource } from '../../types/eventMedia'

interface SelfieSearchPanelProps {
  eventId: number | string
  // From event.my_consent_facial_matching — controls whether the opt-in
  // checkbox is shown before the first search.
  consented: boolean
  // Called after consent is granted or withdrawn so the parent can refetch
  // the event.
  onConsentChange?: () => void
}

type Phase = 'idle' | 'searching' | 'done'

const STATUS_MESSAGES: Record<string, string> = {
  unavailable: 'Photo matching is not switched on for this deployment yet.',
  no_face_detected_in_selfie: "We couldn't find a clear face in that photo — try another selfie.",
}

export function SelfieSearchPanel({ eventId, consented, onConsentChange }: SelfieSearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [matches, setMatches] = useState<EventMediaResource[]>([])
  const [consentChecked, setConsentChecked] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listMyEventMatches(eventId)
      .then((res) => {
        if (!active) return
        setMatches(res.matches)
        if (res.matches.length > 0) setPhase('done')
      })
      .catch(() => {
        /* first visit / no consent yet — nothing to show */
      })
    return () => {
      active = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [eventId])

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
    setNote(null)
    setPreview(URL.createObjectURL(file))
    setPhase('searching')
    setProgress(0)

    // Cosmetic progress (fetch can't report upload progress) — same pattern
    // the old Search My Photos page used.
    timerRef.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.random() * 10))
    }, 250)

    try {
      const res = await searchEventPhotosBySelfie(eventId, file, consented ? undefined : true)
      stopTimer()
      setProgress(100)
      setMatches(res.matches)
      if (res.status !== 'ok' && STATUS_MESSAGES[res.status]) setNote(STATUS_MESSAGES[res.status])
      if (!consented) onConsentChange?.()
      setTimeout(() => setPhase('done'), 300)
    } catch (err) {
      stopTimer()
      setError(err instanceof ApiError ? err.message : 'Search failed.')
      setPhase('idle')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function reset() {
    stopTimer()
    setPhase('idle')
    setProgress(0)
    setPreview(null)
    setNote(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleWithdraw() {
    if (!confirm('Turn off facial matching for this event and delete your matched-photo list?')) return
    try {
      await withdrawFacialConsent(eventId)
      setMatches([])
      reset()
      onConsentChange?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your consent.')
    }
  }

  const canPick = consented || consentChecked

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorBanner message={error} />}

      {phase === 'idle' && (
        <div className="flex flex-col gap-3 border border-gray-300 p-4">
          {!consented && (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                I consent to my reference photo being analysed for facial matching against this
                event's photos. My selfie is not stored. I can turn this off at any time.
              </span>
            </label>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={!canPick}
            onChange={handleFileChange}
            className="text-sm disabled:opacity-50"
          />
          {!canPick && <p className="text-xs text-gray-500">Tick the box above to enable the upload.</p>}
        </div>
      )}

      {phase === 'searching' && (
        <div className="flex flex-col gap-3 border border-gray-300 p-4">
          {preview && <img src={preview} alt="Selfie preview" className="h-32 w-32 self-center object-cover" />}
          <ProgressBar progress={progress} />
          <p className="text-center text-sm text-gray-500">Searching this event's photos…</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col gap-4">
          {note && <p className="text-sm text-gray-500">{note}</p>}
          {matches.length === 0 ? (
            <EmptyState title="No matches yet" description="We didn't find you in this event's photos." />
          ) : (
            <>
              <p className="text-sm text-gray-600">{matches.length} photo{matches.length === 1 ? '' : 's'} matched.</p>
              <PhotoGrid photos={matches} />
            </>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={reset}>
              Search again
            </Button>
            {(consented || matches.length > 0) && (
              <button onClick={handleWithdraw} className="text-sm text-black underline hover:no-underline">
                Turn off matching for this event
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
