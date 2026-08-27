import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { generateClient } from 'aws-amplify/api'
import { logError } from './errorLogging'
import {
    bucketVotes,
    formatDuration,
    peakBucket,
    timeToFirstVote,
    type VoteRecord,
} from './pollAnalytics'

const getPollQuery = /* GraphQL */ `
  query GetPoll($pollId: ID!) {
    getPoll(pollId: $pollId) {
      question
      options
      voteCounts
      status
      createdAt
    }
  }
`

const listPollVotesQuery = /* GraphQL */ `
  query ListPollVotes($pollId: ID!) {
    listPollVotes(pollId: $pollId) {
      option
      createdAt
    }
  }
`

interface PollDetail {
    question: string
    options: string[]
    voteCounts: string
    status: string
    createdAt: number
}

interface AnalyticsProps {
    pollId: string
}

function formatTime(epochSeconds: number) {
    return new Date(epochSeconds * 1000).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

function Analytics({ pollId }: AnalyticsProps) {
    const [poll, setPoll] = useState<PollDetail | null>(null)
    const [votes, setVotes] = useState<VoteRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            try {
                const client = generateClient()
                // Both run under userPool auth: listPollVotes rejects non-owners.
                const [pollResponse, votesResponse] = await Promise.all([
                    client.graphql({
                        query: getPollQuery,
                        variables: { pollId },
                        authMode: 'userPool',
                    }) as Promise<{ data: { getPoll: PollDetail | null } }>,
                    client.graphql({
                        query: listPollVotesQuery,
                        variables: { pollId },
                        authMode: 'userPool',
                    }) as Promise<{ data: { listPollVotes: VoteRecord[] } }>,
                ])

                if (!pollResponse.data.getPoll) {
                    setError('That poll no longer exists.')
                    return
                }

                setPoll(pollResponse.data.getPoll)
                setVotes(votesResponse.data.listPollVotes)
            } catch (err) {
                logError(err, { source: 'Analytics.load', pollId })
                setError('You can only view analytics for polls you created.')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [pollId])

    if (loading) {
        return (
            <div className="page" aria-busy="true">
                <p className="mono-label muted" style={{ marginBottom: 'var(--space-4)' }}>
                    Loading
                </p>
                <div className="skeleton" style={{ height: '3.5rem', width: '70%', marginBottom: 'var(--space-7)' }} />
                <div className="skeleton-outline" style={{ height: '8rem' }} />
            </div>
        )
    }

    if (error || !poll) {
        return (
            <div className="page" style={{ textAlign: 'center' }}>
                <p className="mono-label muted" style={{ marginBottom: 'var(--space-4)' }}>
                    Unavailable
                </p>
                <h1 style={{ marginBottom: 'var(--space-4)' }}>No analytics here.</h1>
                <p className="muted" style={{ marginBottom: 'var(--space-6)' }} role="alert">
                    {error}
                </p>
                <Link to="/dashboard" className="btn btn-primary mono-label" style={{ textDecoration: 'none' }}>
                    Back to My Polls →
                </Link>
            </div>
        )
    }

    const counts: Record<string, number> = JSON.parse(poll.voteCounts || '{}')
    const totalVotes = Object.values(counts).reduce((sum, n) => sum + n, 0)
    const buckets = bucketVotes(poll.createdAt, votes)
    const peak = peakBucket(buckets)
    const firstVote = timeToFirstVote(poll.createdAt, votes)
    const busiest = Math.max(1, ...buckets.map((bucket) => bucket.count))

    return (
        <div className="page">
            <div className="page-header">
                <p className="mono-label muted">Analytics</p>
                <Link to="/dashboard" className="mono-label">
                    ← My Polls
                </Link>
            </div>
            <h1 style={{ marginBottom: 'var(--space-6)' }}>{poll.question}</h1>

            <dl className="stat-grid">
                <div className="stat">
                    <dt className="mono-label muted">Voters</dt>
                    <dd className="stat-value">{totalVotes}</dd>
                </div>
                <div className="stat">
                    <dt className="mono-label muted">Time to first vote</dt>
                    <dd className="stat-value">
                        {firstVote === null ? '—' : formatDuration(firstVote)}
                    </dd>
                </div>
                <div className="stat">
                    <dt className="mono-label muted">Peak window</dt>
                    <dd className="stat-value">{peak ? peak.count : 0}</dd>
                </div>
                <div className="stat">
                    <dt className="mono-label muted">Status</dt>
                    <dd className="stat-value">{poll.status}</dd>
                </div>
            </dl>

            <h2 className="mono-label muted section-heading">Votes over time</h2>
            {votes.length === 0 ? (
                <p className="muted" style={{ marginBottom: 'var(--space-7)' }}>
                    No votes yet — the timeline appears once the first one lands.
                </p>
            ) : (
                <>
                    <div className="chart" role="img" aria-label={`Vote timeline: ${buckets.map((b) => b.count).join(', ')}`}>
                        {buckets.map((bucket) => (
                            <div key={bucket.start} className="chart-column" title={`${bucket.count} vote(s)`}>
                                <div
                                    className="chart-bar"
                                    style={{ height: `${(bucket.count / busiest) * 100}%` }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="chart-axis mono-label muted">
                        <span>{formatTime(buckets[0].start)}</span>
                        <span>{formatTime(votes[votes.length - 1].createdAt)}</span>
                    </div>
                </>
            )}

            <h2 className="mono-label muted section-heading">Share of vote</h2>
            {poll.options.map((option) => {
                const count = counts[option] || 0
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                return (
                    <div key={option} className="result-row">
                        <div className="result-label">
                            <span>{option}</span>
                            <span className="mono-label">{count} · {pct}%</span>
                        </div>
                        <div
                            className="result-track"
                            role="meter"
                            aria-label={option}
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div className="result-fill" style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default Analytics
