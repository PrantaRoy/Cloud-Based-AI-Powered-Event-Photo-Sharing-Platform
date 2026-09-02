import { Link } from 'react-router-dom'
import { PublicChrome } from '../../components/public/PublicChrome'

const STEPS = [
  {
    n: '01',
    title: 'Post an event',
    body: 'Anyone with an account can publish an event — a title, date, start and end time, a venue, and a capacity. As soon as you save it, the event appears on the landing page under Upcoming, and under Nearby for anyone whose device is within range of the venue. Private events stay off the public lists and are reachable only by their direct link.',
  },
  {
    n: '02',
    title: 'Join and get a QR pass',
    body: 'One tap on Join adds you to the participant list and issues a QR check-in pass tied to your account. Organisers scan the pass at the door, so the participant count shown on every card is the number of people who actually turned up — not the number who clicked a button weeks ago.',
  },
  {
    n: '03',
    title: 'Your photos find you',
    body: 'After the event, photographers upload the gallery. Face matching compares each photo against the reference selfie from your check-in and delivers only the frames you appear in. No scrolling through eight hundred pictures to find the four you are in.',
  },
]

export function HowItWorksPage() {
  return (
    <PublicChrome>
      <section className="ep-wrap" style={{ paddingTop: 'clamp(48px,7vw,96px)', paddingBottom: 'clamp(32px,4vw,56px)' }}>
        <span className="ep-kick">How EventPro works</span>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 'clamp(32px,6vw,72px)',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            margin: '0 0 24px',
            maxWidth: '18ch',
          }}
        >
          From posting an event to getting your photos.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, maxWidth: '58ch', margin: 0, color: 'var(--color-neutral-800)' }}>
          EventPro is a single page for campus events. It handles the three things that are usually spread
          across a chat group, a spreadsheet and a shared drive: listing the event, checking people in, and
          getting everyone the photos they are in.
        </p>
      </section>

      <hr className="ep-rule" />

      <section className="ep-wrap" style={{ paddingBlock: 'clamp(40px,5vw,72px)' }}>
        <h2 className="ep-h2" style={{ marginBottom: 'clamp(24px,3vw,36px)' }}>
          The three steps
        </h2>
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className="ep-steps-row"
            style={{ padding: '28px 0', borderTop: i === 0 ? undefined : '2px solid var(--color-divider)' }}
          >
            <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, margin: 0 }}>{s.n}</p>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, lineHeight: 1.2, margin: 0 }}>
              {s.title}
            </h3>
            <p style={{ fontSize: 15.5, lineHeight: 1.65, margin: 0, color: 'var(--color-neutral-800)', maxWidth: '58ch' }}>
              {s.body}
            </p>
          </div>
        ))}
      </section>

      <hr className="ep-rule" />

      <section className="ep-wrap ep-split" style={{ paddingBlock: 'clamp(40px,5vw,72px)' }}>
        <div>
          <span className="ep-kick">For organisers</span>
          <h2 className="ep-h2" style={{ marginBottom: 16 }}>
            Run the door, not a spreadsheet
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--color-neutral-800)', maxWidth: '56ch', margin: '0 0 14px' }}>
            Every event you create gets a public link and a QR code you can print for the venue. Approve
            registrations automatically or review them one by one. At check-in, scanning a participant&rsquo;s
            pass marks them present — the live count on the event page is always the real attendance.
          </p>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--color-neutral-800)', maxWidth: '56ch', margin: 0 }}>
            Once the event is over, upload the gallery and EventPro takes care of getting each photo to the
            people in it.
          </p>
        </div>
        <div>
          <span className="ep-kick">About face matching</span>
          <h2 className="ep-h2" style={{ marginBottom: 16 }}>
            Opt in, opt out, delete
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--color-neutral-800)', maxWidth: '56ch', margin: '0 0 14px' }}>
            Photo matching uses the reference selfie taken when you check in. It is used only to find you in
            that event&rsquo;s gallery and is never shared with other attendees or organisers.
          </p>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--color-neutral-800)', maxWidth: '56ch', margin: 0 }}>
            You can turn matching off at any time from your account. When you do, your face data is deleted
            with it. Full detail is on the{' '}
            <Link to="/privacy">privacy page</Link>.
          </p>
        </div>
      </section>

      <section style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}>
        <div className="ep-wrap ep-cta-grid" style={{ paddingBlock: 'clamp(48px,6vw,80px)' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 'clamp(28px,4.4vw,52px)',
              lineHeight: 1.06,
              letterSpacing: '-0.02em',
              margin: 0,
              color: 'var(--color-bg)',
            }}
          >
            Ready to try it?
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to="/"
              className="btn btn-ghost"
              style={{ color: 'var(--color-bg)', border: '1px solid var(--color-bg)' }}
            >
              Browse events
            </Link>
            <Link
              to="/register"
              className="btn btn-ghost"
              style={{ color: 'var(--color-bg)', border: '1px solid var(--color-bg)' }}
            >
              Create an account
            </Link>
          </div>
        </div>
      </section>
    </PublicChrome>
  )
}
