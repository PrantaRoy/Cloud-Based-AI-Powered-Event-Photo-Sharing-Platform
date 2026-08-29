import { useEffect, useRef, useState } from 'react'
import { Button } from '../common/Button'
import { copyToClipboard } from '../../lib/clipboard'
import { downloadUrl } from '../../lib/download'
import type { EventResource } from '../../types/event'

type ShareableEvent = Pick<EventResource, 'name' | 'slug' | 'public_url' | 'qr_code_url'>

export function EventSharePanel({ event }: { event: ShareableEvent }) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  async function handleCopy() {
    const ok = await copyToClipboard(event.public_url)
    setError(ok ? null : 'Could not copy the link.')
    setCopied(ok)
    if (ok) {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    setError(null)
    try {
      await downloadUrl(`${event.qr_code_url}?download=1`, `${event.slug}-qr.svg`)
    } catch {
      setError('Could not download the QR code.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="event-share-url" className="text-sm font-medium text-gray-700">
          Shareable link
        </label>
        <div className="flex gap-2">
          <input
            id="event-share-url"
            readOnly
            value={event.public_url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black"
          />
          <Button variant="secondary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 border border-gray-300 p-4">
        <img
          src={event.qr_code_url}
          alt={`QR code for ${event.name}`}
          width={200}
          height={200}
          className="h-[200px] w-[200px]"
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download QR'}
          </Button>
          <a
            href={event.qr_code_url}
            target="_blank"
            rel="noreferrer"
            className="border border-gray-400 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100"
          >
            View full size
          </a>
        </div>
      </div>

      {error && <p className="text-xs text-gray-700">{error}</p>}
    </div>
  )
}
