import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { EventResource } from '../../types/event'
import { formatCompactDateTime } from '../../lib/format'
import { eventMonogram } from '../../lib/eventCover'
import { eventStatusMeta } from './eventStatus'

interface PublicEventCardProps {
  event: EventResource
  /** `wide` = horizontal media-left layout for the "On going" band. */
  layout?: 'grid' | 'wide'
  /** `rail` = fixed-width card for the horizontal "Completed" rail. */
  variant?: 'default' | 'rail'
}

const IMG_WRAP: CSSProperties = {
  position: 'relative',
  background: 'var(--color-neutral-300)',
  overflow: 'hidden',
}

export function PublicEventCard({ event, layout = 'grid', variant = 'default' }: PublicEventCardProps) {
  const status = eventStatusMeta(event.status)
  const wide = layout === 'wide'
  const live = status.label === 'Happening now'
  const when = formatCompactDateTime(event.start_time ?? event.event_date)

  const cardStyle: CSSProperties = wide
    ? { flexDirection: 'row', minHeight: 220 }
    : variant === 'rail'
      ? { flex: '0 0 clamp(260px, 30vw, 340px)' }
      : {}

  return (
    <Link to={`/e/${event.slug}`} className="ep-card" style={cardStyle}>
      <div
        className="grayscale"
        style={{
          ...IMG_WRAP,
          ...(wide
            ? { width: '42%', flex: 'none' }
            : { aspectRatio: '16 / 10' }),
        }}
      >
        {event.thumbnail_url ? (
          <img
            src={event.thumbnail_url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 40,
              color: 'var(--color-neutral-500)',
            }}
          >
            {eventMonogram(event.name)}
          </div>
        )}
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {live ? (
            <span className="tag tag-accent">Live</span>
          ) : (
            <span className="tag tag-outline">{status.label}</span>
          )}
        </div>

        <h3 className="ep-title">{event.name}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
          {when && (
            <p className="ep-meta">
              <span>{when}</span>
            </p>
          )}
          {event.venue && (
            <p className="ep-meta">
              <span>{event.venue}</span>
            </p>
          )}
          <p className="ep-meta">
            <span>
              {event.participants_count} {event.participants_count === 1 ? 'person joined' : 'people joined'}
            </span>
          </p>
        </div>

        <span className="btn btn-ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
          View details →
        </span>
      </div>
    </Link>
  )
}
