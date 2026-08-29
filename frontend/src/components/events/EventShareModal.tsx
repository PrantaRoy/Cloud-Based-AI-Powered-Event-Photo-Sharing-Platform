import { Modal } from '../common/Modal'
import { EventSharePanel } from './EventSharePanel'
import type { EventResource } from '../../types/event'

type ShareableEvent = Pick<EventResource, 'name' | 'slug' | 'public_url' | 'qr_code_url'>

export function EventShareModal({ event, onClose }: { event: ShareableEvent; onClose: () => void }) {
  return (
    <Modal title={`Share "${event.name}"`} onClose={onClose}>
      <EventSharePanel event={event} />
    </Modal>
  )
}
