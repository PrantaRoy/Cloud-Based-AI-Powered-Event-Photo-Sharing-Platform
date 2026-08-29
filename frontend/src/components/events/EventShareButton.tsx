import { useState } from 'react'
import { EventShareModal } from './EventShareModal'
import type { EventResource } from '../../types/event'

type ShareableEvent = Pick<EventResource, 'name' | 'slug' | 'public_url' | 'qr_code_url'>

interface EventShareButtonProps {
  event: ShareableEvent
  label?: string
  /** Full set of classes for the trigger. Defaults to a bordered pill. */
  className?: string
}

const DEFAULT_CLASS =
  'border border-gray-400 px-3 py-1.5 text-xs text-black hover:bg-gray-100 transition-colors'

export function EventShareButton({ event, label = 'QR / link', className = DEFAULT_CLASS }: EventShareButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && <EventShareModal event={event} onClose={() => setOpen(false)} />}
    </>
  )
}
