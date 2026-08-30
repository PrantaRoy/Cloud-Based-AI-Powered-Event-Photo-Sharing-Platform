import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EventSharePanel } from '../../components/events/EventSharePanel'
import { eventStatusMeta } from '../../components/public/eventStatus'
import { getPublicEvent } from '../../api/events'
import { ApiError } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { formatDate, formatDateTime } from '../../lib/format'
import type { EventResource } from '../../types/event'

export function PublicEventPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [event, setEvent] = useState<EventResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [restrictedName, setRestrictedName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getPublicEvent(slug)
      .then((data) => setEvent(data))
      .catch((err) => {
        if (err instanceof ApiError && err.statusCode === 403) {
          const data = err.data as { name?: string } | null
          setRestrictedName(data?.name ?? 'This event')
        } else {
          setError('Event not found.')
        }
      })
      .finally(() => setLoading(false))
  }, [slug])

  const dashboardPath = `/dashboard/events/${slug}`
  const hasCoords = event?.latitude != null && event?.longitude != null
  const status = event ? eventStatusMeta(event.status) : null

  return (
    <div className="modernist" style={{ minHeight: '100vh' }}>
      <div className="ep-wrap" style={{ paddingBlock: '24px' }}>
        <Link to="/" className="ep-nav-link">
          ← All events
        </Link>
      </div>
      <hr className="ep-rule" />

      <div className="ep-wrap" style={{ paddingBlock: 'clamp(32px,4vw,56px)' }}>
        {loading ? (
          <Skeleton />
        ) : error ? (
          <StatusCard title="Event not found" body="The link may be broken or the event is no longer public." />
        ) : restrictedName ? (
          <StatusCard title={restrictedName} body="This event is private. Sign in to view its details.">
            <Link
              to="/login"
              state={{ from: { pathname: dashboardPath } }}
              className="btn btn-primary"
              style={{ marginTop: 16 }}
            >
              Sign in
            </Link>
          </StatusCard>
        ) : event && status ? (
          <>
            <span className="ep-kick">{status.label}</span>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: 'clamp(28px,5vw,64px)',
                lineHeight: 1.06,
                letterSpacing: '-0.025em',
                margin: '0 0 clamp(28px,4vw,44px)',
                maxWidth: '24ch',
              }}
            >
              {event.name}
            </h1>

            <div
              className="grayscale"
              style={{
                position: 'relative',
                aspectRatio: '21 / 9',
                background: 'var(--color-neutral-300)',
                border: '2px solid var(--color-divider)',
              }}
            >
              {event.thumbnail_url ? (
                <img
                  src={event.thumbnail_url}
                  alt={event.name}
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
                    fontSize: 'clamp(40px,8vw,96px)',
                    color: 'var(--color-neutral-500)',
                  }}
                >
                  {event.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="ep-split" style={{ padding: 'clamp(32px,4vw,56px) 0' }}>
              <div>
                <div
                  className="ep-cols-2"
                  style={{ gap: 2, background: 'var(--color-divider)', border: '2px solid var(--color-divider)' }}
                >
                  <DetailCell label="Date & time">
                    {event.start_time ? formatDateTime(event.start_time) : formatDate(event.event_date)}
                    {event.end_time ? ` – ${formatDateTime(event.end_time)}` : ''}
                  </DetailCell>
                  <DetailCell label="Location">
                    {hasCoords ? (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=16/${event.latitude}/${event.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {event.venue}
                      </a>
                    ) : (
                      event.venue
                    )}
                  </DetailCell>
                  <DetailCell label="Participants">
                    {event.participants_count} {event.participants_count === 1 ? 'person' : 'people'} ·{' '}
                    {event.media_count} {event.media_count === 1 ? 'photo' : 'photos'}
                  </DetailCell>
                  <DetailCell label="Organiser">{event.organiser?.name ?? '—'}</DetailCell>
                </div>

                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, margin: 'clamp(28px,3vw,40px) 0 12px' }}>
                  About this event
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-neutral-800)', maxWidth: '62ch', margin: 0 }}>
                  Photos from this event are matched to checked-in participants. Turn matching off any time from
                  your account and your face data is deleted with it.
                </p>

                <div style={{ marginTop: 'clamp(28px,3vw,40px)' }}>
                  {isAuthenticated ? (
                    <button type="button" className="btn btn-primary" onClick={() => navigate(dashboardPath)}>
                      Open in EventPro →
                    </button>
                  ) : (
                    <Link to="/login" state={{ from: { pathname: dashboardPath } }} className="btn btn-primary">
                      Sign in to join →
                    </Link>
                  )}
                </div>
              </div>

              <aside
                style={{
                  border: '2px solid var(--color-divider)',
                  background: 'var(--color-neutral-100)',
                  padding: 24,
                  position: 'sticky',
                  top: 24,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--color-neutral-700)',
                    margin: '0 0 8px',
                  }}
                >
                  Event pass
                </p>
                <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 24, lineHeight: 1.15, margin: '0 0 20px' }}>
                  Share this event
                </p>
                <EventSharePanel event={event} />
                <hr className="ep-rule" style={{ margin: '20px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                  <PassRow label="Status" value={status.label} />
                  <PassRow
                    label="Photos in gallery"
                    value={event.media_count > 0 ? String(event.media_count) : 'Opens after the event'}
                  />
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

const CELL: CSSProperties = { background: 'var(--color-neutral-100)', padding: '16px 18px' }

function DetailCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={CELL}>
      <p
        style={{
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-700)',
          margin: '0 0 6px',
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 15.5, margin: 0 }}>{children}</p>
    </div>
  )
}

function PassRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--color-neutral-700)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function StatusCard({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 460,
        margin: '0 auto',
        border: '2px solid var(--color-divider)',
        background: 'var(--color-neutral-100)',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, margin: 0 }}>{title}</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-neutral-700)' }}>{body}</p>
      {children}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="ep-split">
      <div>
        <div style={{ height: 40, width: '60%', background: 'var(--color-neutral-300)' }} />
        <div
          style={{ marginTop: 24, aspectRatio: '21 / 9', background: 'var(--color-neutral-300)', border: '2px solid var(--color-divider)' }}
        />
        <div className="ep-cols-2" style={{ gap: 2, marginTop: 32, background: 'var(--color-divider)', border: '2px solid var(--color-divider)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 72, background: 'var(--color-neutral-100)' }} />
          ))}
        </div>
      </div>
      <div style={{ height: 320, background: 'var(--color-neutral-300)' }} />
    </div>
  )
}
