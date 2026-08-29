import { Link } from 'react-router-dom'

/**
 * Catch-all for unmatched routes. Distinct from PollView's 404, which means
 * "this poll id doesn't exist" — this one means "this URL isn't part of the app".
 */
function NotFound() {
    return (
        <div className="page" style={{ textAlign: 'center' }}>
            <p className="mono-label muted" style={{ marginBottom: 'var(--space-4)' }}>
                404
            </p>
            <h1 style={{ marginBottom: 'var(--space-4)' }}>Nothing lives here.</h1>
            <p className="muted" style={{ marginBottom: 'var(--space-6)' }}>
                That page doesn't exist. It may have moved, or the link may be wrong.
            </p>
            <Link to="/" className="btn btn-primary mono-label" style={{ textDecoration: 'none' }}>
                Go to LivePoll →
            </Link>
        </div>
    )
}

export default NotFound
