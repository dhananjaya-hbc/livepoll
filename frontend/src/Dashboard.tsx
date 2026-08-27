import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { generateClient } from 'aws-amplify/api'

const listMyPollsQuery = /* GraphQL */ `
  query ListMyPolls {
    listMyPolls {
      pollId
      question
      options
      status
      voteCounts
      createdAt
    }
  }
`

interface PollSummary {
    pollId: string
    question: string
    options: string[]
    status: string
    voteCounts: string
    createdAt: number
}

function Dashboard() {
    const [polls, setPolls] = useState<PollSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const navigate = useNavigate()

    // Duplication needs no backend support: the create form already knows how to
    // build a poll, so hand it the question and options and let the host edit
    // before submitting. Vote counts start fresh because it is a new poll.
    function duplicatePoll(poll: PollSummary) {
        navigate('/', { state: { question: poll.question, options: poll.options } })
    }

    useEffect(() => {
        async function loadPolls() {
            try {
                const client = generateClient()
                const response = await client.graphql({
                    query: listMyPollsQuery,
                    authMode: 'userPool',
                }) as { data: { listMyPolls: PollSummary[] } }
                setPolls(response.data.listMyPolls)
            } catch (err) {
                console.error('Failed to load polls:', err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }
        loadPolls()
    }, [])

    function totalVotes(voteCounts: string) {
        const counts: Record<string, number> = JSON.parse(voteCounts || '{}')
        return Object.values(counts).reduce((sum, n) => sum + n, 0)
    }

    function formatDate(epochSeconds: number) {
        return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    return (
        <div className="page">
            <div className="page-header">
                <p className="mono-label muted">My Polls</p>
                <Link to="/" className="mono-label">
                    + New Poll
                </Link>
            </div>
            <h1 style={{ marginBottom: 'var(--space-7)' }}>Everything you've asked.</h1>

            {loading && (
                <div aria-busy="true" aria-label="Loading your polls">
                    <div className="skeleton-outline" style={{ height: '5rem', marginBottom: 'var(--space-3)' }} />
                    <div className="skeleton-outline" style={{ height: '5rem', marginBottom: 'var(--space-3)' }} />
                </div>
            )}

            {!loading && error && (
                <p role="alert" className="muted" style={{ fontStyle: 'italic' }}>
                    Could not load your polls. Please refresh and try again.
                </p>
            )}

            {!loading && !error && polls.length === 0 && (
                <div className="empty-state">
                    <h2 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-3)' }}>
                        No polls yet.
                    </h2>
                    <p className="muted" style={{ marginBottom: 'var(--space-6)' }}>
                        Every poll you create shows up here — with live vote counts,
                        status, and a link you can share anywhere.
                    </p>
                    <Link to="/" className="btn btn-primary mono-label" style={{ textDecoration: 'none' }}>
                        Create Your First Poll →
                    </Link>
                </div>
            )}

            {!loading && !error && polls.map((poll) => (
                <article key={poll.pollId} className="card">
                    <div className="card-title-row">
                        <Link to={`/poll/${poll.pollId}`} className="card-title">
                            {poll.question}
                        </Link>
                        <span
                            className={`mono-label badge${poll.status === 'open' ? ' badge-open' : ''}`}
                        >
                            {poll.status}
                        </span>
                    </div>
                    <div className="card-footer">
                        <p className="mono-label muted">
                            {totalVotes(poll.voteCounts)} vote{totalVotes(poll.voteCounts) !== 1 ? 's' : ''} · {formatDate(poll.createdAt)}
                        </p>
                        <span style={{ display: 'flex', gap: 'var(--space-4)' }}>
                            <Link
                                to={`/poll/${poll.pollId}/analytics`}
                                className="btn btn-link mono-label"
                            >
                                Analytics →
                            </Link>
                            <button
                                type="button"
                                className="btn btn-link mono-label"
                                onClick={() => duplicatePoll(poll)}
                            >
                                Duplicate →
                            </button>
                        </span>
                    </div>
                </article>
            ))}
        </div>
    )
}

export default Dashboard
