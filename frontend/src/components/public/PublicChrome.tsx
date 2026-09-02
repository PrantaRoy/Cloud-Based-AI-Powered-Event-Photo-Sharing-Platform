import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * Modernist nav + footer shell for standalone public content pages
 * (How it works, Privacy). The landing page keeps its own in-page
 * scrolling nav/footer; here every link is a real route.
 */
export function PublicChrome({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const createHref = isAuthenticated ? '/dashboard/events/organised' : '/register'

  return (
    <div className="modernist" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="nav" style={{ gap: 24 }}>
        <Link to="/" className="nav-brand" style={{ color: 'var(--color-text)' }}>
          EventPro
        </Link>
        <div className="ep-hide-sm" style={{ display: 'flex', gap: 24, alignItems: 'center', marginRight: 'auto' }}>
          <Link to="/" className="ep-nav-link">
            Browse events
          </Link>
          <Link to="/how-it-works" className="ep-nav-link">
            How it works
          </Link>
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
      <hr className="ep-rule" />

      <main style={{ flex: 1 }}>{children}</main>

      <footer>
        <hr className="ep-rule" />
        <div className="ep-wrap ep-footer-grid" style={{ paddingBlock: 'clamp(40px,5vw,64px)' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, margin: '0 0 12px' }}>
              EventPro
            </p>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--color-neutral-700)',
                margin: 0,
                maxWidth: '34ch',
              }}
            >
              A university project: event listings, QR check-in and face-matched photo delivery in one place.
            </p>
          </div>
          <FooterCol title="Browse">
            <Link to="/">Upcoming events</Link>
            <Link to="/">Nearby events</Link>
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
    </div>
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
