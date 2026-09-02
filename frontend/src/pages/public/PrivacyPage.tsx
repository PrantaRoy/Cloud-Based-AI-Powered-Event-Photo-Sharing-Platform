import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicChrome } from '../../components/public/PublicChrome'

const P: CSSProperties = {
  fontSize: 15.5,
  lineHeight: 1.7,
  color: 'var(--color-neutral-800)',
  maxWidth: '60ch',
  margin: '0 0 12px',
}

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <p style={P}>When you create an account we store your name, email address and password (hashed).</p>
        <p style={P}>
          When you post or join an event we store that activity: which events you organise, which you have
          registered for, and your check-in status for each.
        </p>
        <p style={P}>
          When you check in to an event we capture a reference selfie. It is used only for photo matching,
          described below.
        </p>
      </>
    ),
  },
  {
    id: 'face-data',
    title: 'Face data and photo matching',
    body: (
      <>
        <p style={P}>
          Photo matching compares your check-in selfie against the photos an organiser uploads for that
          event, and delivers to you only the frames you appear in.
        </p>
        <p style={P}>
          Your face data is never shown to other attendees or to organisers, and is never used to match you
          across different events or to build a profile.
        </p>
        <p style={P}>
          You can turn matching off at any time from your account settings. When you do, the reference selfie
          and the face data derived from it are deleted, and you stop being matched in future galleries.
        </p>
      </>
    ),
  },
  {
    id: 'check-in',
    title: 'How QR check-in works',
    body: (
      <>
        <p style={P}>
          Joining an event issues a QR pass tied to your account. An organiser scanning it at the door only
          learns that you — a registered participant — have arrived. The pass carries no other personal
          information.
        </p>
      </>
    ),
  },
  {
    id: 'who-sees-photos',
    title: 'Who can see your photos',
    body: (
      <>
        <p style={P}>
          Event galleries are visible to the event&rsquo;s organiser and to checked-in participants. A photo
          matched to you is shown to you; matching does not make your photos public.
        </p>
        <p style={P}>Public event pages show only the event details and aggregate counts — never a list of who attended.</p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Retention and deletion',
    body: (
      <>
        <p style={P}>
          Account data is kept while your account is active. Face data is kept only while photo matching is
          switched on for you.
        </p>
        <p style={P}>
          Deleting your account removes your profile, your registrations and your face data. Events you
          organised and photos already delivered to other participants are not automatically removed.
        </p>
      </>
    ),
  },
  {
    id: 'project',
    title: 'A note on this project',
    body: (
      <>
        <p style={P}>
          EventPro is a university project, not a commercial service. It is not covered by a company privacy
          programme, and you should not upload anything you would not be comfortable sharing in that context.
        </p>
        <p style={P}>
          For questions about your data, contact the project team through the course channel you were given.
        </p>
      </>
    ),
  },
]

export function PrivacyPage() {
  return (
    <PublicChrome>
      <section className="ep-wrap" style={{ paddingTop: 'clamp(48px,7vw,96px)', paddingBottom: 'clamp(24px,3vw,40px)' }}>
        <span className="ep-kick">Privacy</span>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 'clamp(32px,6vw,72px)',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            margin: '0 0 20px',
            maxWidth: '16ch',
          }}
        >
          What we do with your data.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, maxWidth: '58ch', margin: 0, color: 'var(--color-neutral-800)' }}>
          EventPro collects the minimum it needs to list events, check people in, and match photos to the
          people in them. This page explains exactly what that is and how to remove it.
        </p>
      </section>

      <hr className="ep-rule" />

      <section className="ep-wrap ep-split" style={{ paddingBlock: 'clamp(40px,5vw,72px)' }}>
        <nav aria-label="On this page" style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
          <p
            style={{
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-neutral-700)',
              margin: '0 0 12px',
            }}
          >
            On this page
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} style={{ fontSize: 14 }}>
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <div>
          {SECTIONS.map((s, i) => (
            <div
              key={s.id}
              id={s.id}
              style={{
                paddingBlock: 28,
                borderTop: i === 0 ? undefined : '2px solid var(--color-divider)',
                scrollMarginTop: 24,
              }}
            >
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, margin: '0 0 12px' }}>
                {s.title}
              </h2>
              {s.body}
            </div>
          ))}
          <p style={{ ...P, marginTop: 24, color: 'var(--color-neutral-700)', fontSize: 13.5 }}>
            See also{' '}
            <Link to="/how-it-works">how EventPro works</Link>.
          </p>
        </div>
      </section>
    </PublicChrome>
  )
}
