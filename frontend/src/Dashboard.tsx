import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { generateClient } from 'aws-amplify/api'

const listMyPollsQuery = /* GraphQL */ `
  query ListMyPolls {
    listMyPolls {
      pollId
      question
      status
      voteCounts
      createdAt
    }
  }
`

interface PollSummary {
    pollId: string
    question: string
    status: string
    voteCounts: string
    createdAt: number
}

function Dashboard() {
    const [polls, setPolls] = useState<PollSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

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
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '4rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <p className="mono-label" style={{ color: '#525252' }}>My Polls</p>
                <Link to="/" className="mono-label" style={{ color: '#000000' }}>
                    + New Poll
                </Link>
            </div>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '2.5rem' }}>Everything you've asked.</h1>

            {loading && (
                <>
                    <div style={{ height: '5rem', border: '2px solid #E5E5E5', marginBottom: '0.75rem' }} />
                    <div style={{ height: '5rem', border: '2px solid #E5E5E5', marginBottom: '0.75rem' }} />
                </>
            )}

            {!loading && error && (
                <p style={{ color: '#525252', fontStyle: 'italic' }}>
                    Could not load your polls. Please refresh and try again.
                </p>
            )}

            {!loading && !error && polls.length === 0 && (
                <div style={{ padding: '2rem 0' }}>
                    <p style={{ color: '#525252', marginBottom: '1.5rem' }}>
                        You haven't created any polls yet.
                    </p>
                    <Link
                        to="/"
                        className="mono-label"
                        style={{
                            display: 'inline-block',
                            background: '#000000',
                            color: '#FFFFFF',
                            padding: '0.9rem 2rem',
                            textDecoration: 'none',
                        }}
                    >
                        Create Your First Poll →
                    </Link>
                </div>
            )}

            {!loading && !error && polls.map((poll) => (
                <Link
                    key={poll.pollId}
                    to={`/poll/${poll.pollId}`}
                    style={{
                        display: 'block',
                        border: '2px solid #000000',
                        padding: '1.25rem 1.5rem',
                        marginBottom: '0.75rem',
                        textDecoration: 'none',
                        color: '#000000',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '1.15rem' }}>{poll.question}</span>
                        <span
                            className="mono-label"
                            style={{
                                flexShrink: 0,
                                alignSelf: 'flex-start',
                                padding: '0.25rem 0.6rem',
                                background: poll.status === 'open' ? '#000000' : 'transparent',
                                color: poll.status === 'open' ? '#FFFFFF' : '#525252',
                                border: poll.status === 'open' ? 'none' : '1px solid #525252',
                            }}
                        >
                            {poll.status}
                        </span>
                    </div>
                    <p className="mono-label" style={{ color: '#525252' }}>
                        {totalVotes(poll.voteCounts)} vote{totalVotes(poll.voteCounts) !== 1 ? 's' : ''} · {formatDate(poll.createdAt)}
                    </p>
                </Link>
            ))}
        </div>
    )
}

export default Dashboard
