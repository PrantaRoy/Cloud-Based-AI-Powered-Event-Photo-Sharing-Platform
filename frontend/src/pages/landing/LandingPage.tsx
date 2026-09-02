import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicEventCard } from '../../components/public/PublicEventCard'
import { getPublicStats, listPublicEvents } from '../../api/public'
import type { ListPublicEventsParams, PublicStats } from '../../api/public'
import { useAuth } from '../../hooks/useAuth'
import type { EventResource } from '../../types/event'

const STEPS = [
  {
    n: '01',
    title: 'Post an event',
    body: 'Fill in a title, date, place and capacity. It publishes to the landing page immediately and shows up under Upcoming and Nearby for everyone around you.',
  },
  {
    n: '02',
    title: 'Join and get a QR pass',
    body: 'One tap on Join issues a check-in pass tied to your account. Organisers scan it at the door, so the participant count on the card is the real one.',
  },
  {
    n: '03',
    title: 'Your photos find you',
    body: 'Photographers upload the gallery. Face matching compares it against your check-in selfie and delivers only the frames you appear in.',
  },
]

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (el) window.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' })
}

/* ==================================================================== */

export function LandingPage() {
  const { isAuthenticated } = useAuth()
  const createHref = isAuthenticated ? '/dashboard/events/organised' : '/register'

  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [activeSearch, setActiveSearch] = useState<string | null>(null)

  const submitSearch = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const term = [q, loc].map((s) => s.trim()).filter(Boolean).join(' ')
      if (!term) return
      setActiveSearch(term)
      window.requestAnimationFrame(() => scrollToId('search-results'))
    },
    [q, loc],
  )

  const { events: upcomingRaw, error: upErr } = usePublicEventList({ statusGroup: 'upcoming', limit: 50 })
  const upcomingLoading = upcomingRaw === null && !upErr
  const upcoming = useMemo(
    () =>
      (upcomingRaw ?? [])
        .slice()
        .sort((a, b) => +new Date(a.event_date) - +new Date(b.event_date)),
    [upcomingRaw],
  )

  const { events: ongoing } = usePublicEventList({ statusGroup: 'ongoing', limit: 8 })
  const { events: completed } = usePublicEventList({ statusGroup: 'archived', limit: 12 })

  const [shown, setShown] = useState(6)
  const visibleUpcoming = upcoming.slice(0, shown)

  return (
    <div className="modernist" style={{ minHeight: '100vh' }}>
      <Nav isAuthenticated={isAuthenticated} createHref={createHref} />

      {/* ---------- Hero ---------- */}
      <section className="ep-wrap" style={{ paddingTop: 'clamp(48px,7vw,104px)', paddingBottom: 'clamp(40px,5vw,72px)' }}>
        <div className="ep-hero-grid">
          <div>
            <span className="ep-kick">Campus events, one page</span>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: 'clamp(30px,6vw,80px)',
                lineHeight: 1.04,
                letterSpacing: '-0.025em',
                margin: '0 0 24px',
              }}
            >
              <span style={{ display: 'block' }}>Browse what’s on near you.</span>
              <span style={{ display: 'block' }}>Check in with a QR pass.</span>
              <span style={{ display: 'block', color: 'var(--color-accent)' }}>Get every photo you’re in.</span>
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.65,
                maxWidth: '54ch',
                margin: '0 0 28px',
                color: 'var(--color-neutral-800)',
              }}
            >
              Anyone can post an event. Anyone can join it in one tap. After the event, face matching finds
              you in the gallery and sends your photos — no scrolling through eight hundred frames.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => scrollToId('upcoming')}>
                Browse events
              </button>
              <Link to={createHref} className="btn btn-ghost">
                Create an event
              </Link>
            </div>
          </div>

          <div
            className="grayscale ep-hide-sm"
            style={{
              position: 'relative',
              aspectRatio: '4 / 5',
              background: 'var(--color-neutral-300)',
              border: '2px solid var(--color-divider)',
            }}
          >
            {upcoming[0]?.thumbnail_url ? (
              <img
                src={upcoming[0].thumbnail_url ?? undefined}
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
                  fontSize: 'clamp(48px,10vw,120px)',
                  letterSpacing: '-0.04em',
                  color: 'var(--color-neutral-500)',
                }}
              >
                EP
              </div>
            )}
          </div>
        </div>
      </section>

      <hr className="ep-rule" />

      {/* ---------- Stats + search ---------- */}
      <section className="ep-wrap" style={{ paddingBlock: 'clamp(32px,4vw,56px)' }}>
        <StatStrip />

        <form
          className="ep-search"
          onSubmit={submitSearch}
          style={{ marginTop: 'clamp(28px,3vw,44px)' }}
        >
          <SearchCell label="Event title" htmlFor="ep-q">
            <input
              id="ep-q"
              className="input"
              style={CELL_INPUT}
              placeholder="Search events"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </SearchCell>
          <SearchCell label="Location" htmlFor="ep-loc">
            <input
              id="ep-loc"
              className="input"
              style={CELL_INPUT}
              placeholder="Anywhere on campus"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
            />
          </SearchCell>
          <div style={{ background: 'var(--color-neutral-100)', display: 'flex' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: '100%', width: '100%', paddingInline: 32 }}
            >
              Search
            </button>
          </div>
        </form>
        <p style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', margin: '12px 0 0' }}>
          Search by title or location. Results open in a filtered list below.
        </p>
      </section>

      {activeSearch && (
        <SearchResults
          term={activeSearch}
          onClear={() => {
            setActiveSearch(null)
            setQ('')
            setLoc('')
          }}
        />
      )}

      <hr className="ep-rule" />

      {/* ---------- How it works ---------- */}
      <section className="ep-wrap" style={{ paddingBlock: 'clamp(40px,5vw,72px)' }}>
        <span className="ep-kick">How EventPro works</span>
        <h2 className="ep-h2" style={{ maxWidth: '24ch' }}>
          Three steps from posting to photos
        </h2>
        <div style={{ marginTop: 'clamp(28px,3vw,40px)' }}>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="ep-steps-row"
              style={{
                padding: '28px 0',
                borderTop: i === 0 ? undefined : '2px solid var(--color-divider)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, margin: 0 }}>
                {s.n}
              </p>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, lineHeight: 1.2, margin: 0 }}>
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.65,
                  margin: 0,
                  color: 'var(--color-neutral-800)',
                  maxWidth: '56ch',
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <hr className="ep-rule" />

      {/* ---------- Upcoming ---------- */}
      <section id="upcoming" className="ep-wrap" style={{ paddingBlock: 'clamp(40px,5vw,72px)' }}>
        <SectionHead
          kicker="Upcoming"
          title="Opening for registration"
          aside={upcomingLoading ? '' : `${upcoming.length} ${upcoming.length === 1 ? 'event' : 'events'}`}
        />
        <EventGrid events={upcomingLoading ? null : visibleUpcoming} error={upErr} empty="No upcoming events yet." />
        {shown < upcoming.length && (
          <div style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShown((n) => n + 6)}>
              Show more
            </button>
          </div>
        )}
      </section>

      {/* ---------- On going ---------- */}
      {ongoing && ongoing.length > 0 && (
        <>
          <hr className="ep-rule" />
          <section className="ep-wrap" style={{ paddingBlock: 'clamp(40px,5vw,72px)' }}>
            <SectionHead kicker="Happening now" title="On going" aside="Check in is open" />
            <div className="ep-grid ep-grid-wide">
              {ongoing.map((e) => (
                <PublicEventCard key={e.id} event={e} layout="wide" />
              ))}
            </div>
          </section>
        </>
      )}

      <hr className="ep-rule" />

      {/* ---------- Nearby ---------- */}
      <NearbySection />

      {/* ---------- Completed ---------- */}
      {completed && completed.length > 0 && (
        <>
          <hr className="ep-rule" />
          <section className="ep-wrap" style={{ paddingBlock: 'clamp(40px,5vw,72px)' }}>
            <CompletedRail events={completed} />
          </section>
        </>
      )}

      {/* ---------- CTA ---------- */}
      <section style={{ background: 'var(--color-accent)', color: 'var(--color-bg)', marginTop: 'clamp(24px,3vw,48px)' }}>
        <div className="ep-wrap ep-cta-grid" style={{ paddingBlock: 'clamp(48px,6vw,88px)' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 'clamp(30px,4.4vw,56px)',
              lineHeight: 1.06,
              letterSpacing: '-0.02em',
              margin: 0,
              marginLeft: '-0.05em',
              color: 'var(--color-bg)',
            }}
          >
            Your event is one form away.
          </h2>
          <Link
            to={createHref}
            className="btn btn-ghost"
            style={{ color: 'var(--color-bg)', borderColor: 'var(--color-bg)', border: '1px solid' }}
          >
            Create event
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}

/* ==================================================================== */
/* Pieces                                                                */
/* ==================================================================== */

const CELL_INPUT: CSSProperties = {
  border: 0,
  background: 'transparent',
  padding: 0,
  fontSize: 16,
  minHeight: 0,
}

function SearchCell({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--color-neutral-100)', padding: '14px 16px' }}>
      <label
        htmlFor={htmlFor}
        style={{
          display: 'block',
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-700)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function SectionHead({ kicker, title, aside }: { kicker: string; title: string; aside?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'end',
        justifyContent: 'space-between',
        gap: 24,
        marginBottom: 'clamp(20px,3vw,32px)',
      }}
    >
      <div>
        <span className="ep-kick">{kicker}</span>
        <h2 className="ep-h2">{title}</h2>
      </div>
      {aside ? <span style={{ fontSize: 13.5, color: 'var(--color-neutral-700)' }}>{aside}</span> : null}
    </div>
  )
}

function Nav({ isAuthenticated, createHref }: { isAuthenticated: boolean; createHref: string }) {
  return (
    <nav className="nav" style={{ gap: 24 }}>
      <Link to="/" className="nav-brand" style={{ color: 'var(--color-text)' }}>
        EventPro
      </Link>
      <div className="ep-hide-sm" style={{ display: 'flex', gap: 24, alignItems: 'center', marginRight: 'auto' }}>
        <button type="button" className="ep-nav-link" onClick={() => scrollToId('upcoming')}>
          Upcoming
        </button>
        <button type="button" className="ep-nav-link" onClick={() => scrollToId('nearby')}>
          Nearby
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {isAuthenticated ? (
          <Link to="/dashboard/events" className="btn btn-ghost ep-hide-sm">
            Dashboard
          </Link>
        ) : (
          <Link to="/login" className="btn btn-ghost ep-hide-sm">
            Log in
          </Link>
        )}
        <Link to={createHref} className="btn btn-primary">
          Create event
        </Link>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer>
      <hr className="ep-rule" />
      <div className="ep-wrap ep-footer-grid" style={{ paddingBlock: 'clamp(40px,5vw,64px)' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, margin: '0 0 12px' }}>
            EventPro
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-neutral-700)', margin: 0, maxWidth: '34ch' }}>
            A university project: event listings, QR check-in and face-matched photo delivery in one place.
          </p>
        </div>
        <FooterCol title="Browse">
          <button type="button" className="ep-nav-link" onClick={() => scrollToId('upcoming')}>
            Upcoming events
          </button>
          <button type="button" className="ep-nav-link" onClick={() => scrollToId('nearby')}>
            Nearby events
          </button>
        </FooterCol>
        <FooterCol title="Account">
          <Link to="/login">Log in</Link>
          <Link to="/register">Register</Link>
        </FooterCol>
        <FooterCol title="About">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/privacy">Privacy</Link>
        </FooterCol>
      </div>
      <hr className="ep-rule" />
      <div
        className="ep-wrap"
        style={{
          paddingBlock: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 13,
          color: 'var(--color-neutral-700)',
        }}
      >
        <span>© {new Date().getFullYear()} EventPro. University project.</span>
        <span>Built with the Modernist design system.</span>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>{children}</div>
    </div>
  )
}

/* ---------------- Stats ---------------- */

function StatStrip() {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [error, setError] = useState(false)
  const { ref, inView } = useInView<HTMLDivElement>()

  useEffect(() => {
    let alive = true
    getPublicStats()
      .then((d) => alive && setStats(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  const items = [
    { label: 'Total events', value: stats?.events },
    { label: 'Participants', value: stats?.participants },
    { label: 'Photos shared', value: stats?.photos },
    { label: 'Faces matched', value: stats?.faces },
  ]

  return (
    <div ref={ref} className="ep-stats">
      {items.map((it) => (
        <div key={it.label}>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 'clamp(30px,3.4vw,44px)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              margin: 0,
              color: 'var(--color-accent)',
            }}
          >
            <Count value={it.value} run={inView} error={error} />
          </p>
          <p
            style={{
              fontSize: 13,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-neutral-700)',
              margin: '12px 0 0',
            }}
          >
            {it.label}
          </p>
        </div>
      ))}
    </div>
  )
}

function Count({ value, run, error }: { value: number | undefined; run: boolean; error: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run || value === undefined) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, run])
  if (error || value === undefined) return <>—</>
  return <>{n.toLocaleString()}</>
}

/* ---------------- Nearby ---------------- */

type GeoState =
  | { status: 'idle' | 'prompting' | 'denied' | 'unsupported' }
  | { status: 'ready'; lat: number; lng: number }

function NearbySection() {
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' })
  const params = geo.status === 'ready' ? { lat: geo.lat, lng: geo.lng, limit: 9 } : {}
  const { events, error } = usePublicEventList(params, geo.status === 'ready')

  const ask = useCallback(() => {
    if (!('geolocation' in navigator)) return setGeo({ status: 'unsupported' })
    setGeo({ status: 'prompting' })
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ status: 'ready', lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeo({ status: 'denied' }),
      { timeout: 10000 },
    )
  }, [])

  return (
    <section id="nearby" className="ep-wrap" style={{ paddingBlock: 'clamp(40px,5vw,72px)' }}>
      <SectionHead
        kicker="Nearby"
        title="Within walking distance"
        aside={geo.status === 'ready' ? 'Sorted by distance' : undefined}
      />
      {geo.status === 'ready' ? (
        <EventGrid events={events} error={error} empty="No events found near you." />
      ) : (
        <div
          style={{
            border: '2px solid var(--color-divider)',
            background: 'var(--color-neutral-100)',
            padding: 'clamp(20px,3vw,32px)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ fontSize: 15.5, color: 'var(--color-neutral-800)', margin: 0, maxWidth: '48ch' }}>
            {geo.status === 'denied'
              ? 'Location access was denied. Enable it in your browser to see events around you.'
              : geo.status === 'unsupported'
                ? 'Your browser doesn’t support location — try the search above instead.'
                : 'Share your location and we’ll list events near you, closest first.'}
          </p>
          {geo.status !== 'denied' && geo.status !== 'unsupported' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={ask}
              disabled={geo.status === 'prompting'}
            >
              {geo.status === 'prompting' ? 'Locating…' : 'Use my location'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------------- Completed rail ---------------- */

function CompletedRail({ events }: { events: EventResource[] }) {
  const rail = useRef<HTMLDivElement | null>(null)
  const by = (d: number) => rail.current?.scrollBy({ left: d, behavior: 'smooth' })
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          justifyContent: 'space-between',
          gap: 24,
          marginBottom: 'clamp(20px,3vw,32px)',
        }}
      >
        <div>
          <span className="ep-kick">Completed</span>
          <h2 className="ep-h2">Galleries already matched</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" aria-label="Previous" onClick={() => by(-340)}>
            ←
          </button>
          <button type="button" className="btn btn-ghost" aria-label="Next" onClick={() => by(340)}>
            →
          </button>
        </div>
      </div>
      <div className="ep-rail" ref={rail}>
        {events.map((e) => (
          <PublicEventCard key={e.id} event={e} variant="rail" />
        ))}
      </div>
    </>
  )
}

/* ---------------- Search results ---------------- */

function SearchResults({ term, onClear }: { term: string; onClear: () => void }) {
  const { events, error } = usePublicEventList({ q: term, limit: 24 })
  return (
    <>
      <hr className="ep-rule" />
      <section id="search-results" className="ep-wrap" style={{ paddingBlock: 'clamp(40px,5vw,64px)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 'clamp(20px,3vw,32px)',
          }}
        >
          <div>
            <span className="ep-kick">Results</span>
            <h2 className="ep-h2">“{term}”</h2>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Clear search
          </button>
        </div>
        <EventGrid events={events} error={error} empty="No events match that search." />
      </section>
    </>
  )
}

/* ---------------- Data + grid ---------------- */

function usePublicEventList(params: ListPublicEventsParams, enabled = true) {
  const key = useMemo(() => JSON.stringify(params), [params])
  const [events, setEvents] = useState<EventResource[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    setEvents(null)
    setError(false)
    listPublicEvents(JSON.parse(key) as ListPublicEventsParams)
      .then((d) => alive && setEvents(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [key, enabled])

  return { events, error }
}

function EventGrid({
  events,
  error,
  empty,
}: {
  events: EventResource[] | null
  error: boolean
  empty: string
}) {
  if (error) {
    return (
      <p
        style={{
          border: '2px solid var(--color-divider)',
          background: 'var(--color-neutral-100)',
          padding: '20px 24px',
          fontSize: 14,
          color: 'var(--color-neutral-700)',
        }}
      >
        Couldn’t load events right now.
      </p>
    )
  }
  if (events === null) {
    return (
      <div className="ep-grid">
        {[0, 1, 2].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    )
  }
  if (events.length === 0) {
    if (!empty) return null
    return (
      <p
        style={{
          border: '2px solid var(--color-divider)',
          background: 'var(--color-neutral-100)',
          padding: '32px 24px',
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--color-neutral-700)',
        }}
      >
        {empty}
      </p>
    )
  }
  return (
    <div className="ep-grid">
      {events.map((e) => (
        <PublicEventCard key={e.id} event={e} />
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="ep-card">
      <div className="grayscale" style={{ aspectRatio: '16 / 10', background: 'var(--color-neutral-300)' }} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 12, width: '30%', background: 'var(--color-neutral-300)' }} />
        <div style={{ height: 18, width: '80%', background: 'var(--color-neutral-300)' }} />
        <div style={{ height: 12, width: '50%', background: 'var(--color-neutral-300)' }} />
      </div>
    </div>
  )
}

/* ---------------- Scroll reveal ---------------- */

function useInView<T extends Element>() {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setInView(true),
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    )
    obs.observe(el)
    const fallback = window.setTimeout(() => setInView(true), 2500)
    return () => {
      obs.disconnect()
      window.clearTimeout(fallback)
    }
  }, [inView])

  return { ref, inView }
}
