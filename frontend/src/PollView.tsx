import { useEffect, useState } from 'react'
import { generateClient } from 'aws-amplify/api'

const getPollQuery = /* GraphQL */ `
  query GetPoll($pollId: ID!) {
    getPoll(pollId: $pollId) {
      pollId
      question
      options
      voteCounts
      status
    }
  }
`

const submitVoteMutation = /* GraphQL */ `
  mutation SubmitVote($pollId: ID!, $option: String!) {
    submitVote(pollId: $pollId, option: $option) {
      pollId
      voteCounts
    }
  }
`

const onVoteUpdateSubscription = /* GraphQL */ `
  subscription OnVoteUpdate($pollId: ID!) {
    onVoteUpdate(pollId: $pollId) {
      pollId
      voteCounts
    }
  }
`

interface PollViewProps {
    pollId: string
}

function PollView({ pollId }: PollViewProps) {
    const [question, setQuestion] = useState('')
    const [options, setOptions] = useState<string[]>([])
    const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
    const [hasVoted, setHasVoted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [notFound, setNotFound] = useState(false)
    const [copied, setCopied] = useState(false)

    // Load initial poll data
    useEffect(() => {
        async function loadPoll() {
            try {
                const client = generateClient()
                const response = await client.graphql({
                    query: getPollQuery,
                    variables: { pollId },
                    authMode: 'apiKey',
                }) as { data: { getPoll: { question: string; options: string[]; voteCounts: string } | null } }

                const poll = response.data.getPoll

                if (!poll) {
                    setNotFound(true)
                    setLoading(false)
                    return
                }

                setQuestion(poll.question)
                setOptions(poll.options)
                setVoteCounts(JSON.parse(poll.voteCounts || '{}'))
                setLoading(false)
            } catch (err) {
                console.error('Failed to load poll:', err)
                setNotFound(true)
                setLoading(false)
            }
        }
        loadPoll()
    }, [pollId])

    // Subscribe to live vote updates
    useEffect(() => {
        const client = generateClient()
        const sub = client
            .graphql({
                query: onVoteUpdateSubscription,
                variables: { pollId },
                authMode: 'apiKey',
            })
            // @ts-expect-error - subscription returns an Observable, not a Promise
            .subscribe({
                next: ({ data }: { data?: { onVoteUpdate?: { voteCounts: string } } }) => {
                    const updated = data?.onVoteUpdate
                    if (updated) {
                        setVoteCounts(JSON.parse(updated.voteCounts || '{}'))
                    }
                },
                error: (err: unknown) => console.error('Subscription error:', err),
            })

        return () => sub.unsubscribe()
    }, [pollId])

    async function handleVote(option: string) {
        setSubmitting(true)
        try {
            const client = generateClient()
            await client.graphql({
                query: submitVoteMutation,
                variables: { pollId, option },
                authMode: 'apiKey',
            })
            setHasVoted(true)
        } catch (err) {
            console.error('Vote failed:', err)
        } finally {
            setSubmitting(false)
        }
    }
    function handleCopyLink() {
        const url = window.location.href
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    if (loading) {
        return <p style={{ padding: '4rem', textAlign: 'center' }}>Loading…</p>
    }

    if (notFound) {
        return (
            <div style={{ maxWidth: '640px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
                <p className="mono-label" style={{ marginBottom: '1rem', color: '#525252' }}>
                    404
                </p>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                    This poll doesn't exist.
                </h1>

                <p style={{ color: '#525252', marginBottom: '2rem' }}>
                    The link might be wrong, or the poll may have been removed.
                </p>
                <a
                    href="/"
                    className="mono-label"
                    style={{
                        display: 'inline-block',
                        background: '#000000',
                        color: '#FFFFFF',
                        padding: '0.9rem 2rem',
                        textDecoration: 'none',
                    }}
                >
                    Create a New Poll →
                </a>
            </div>
        )

    }

    const totalVotes = Object.values(voteCounts).reduce((sum, n) => sum + n, 0)

    return (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '4rem 1.5rem' }}>
            <p className="mono-label" style={{ marginBottom: '1rem', color: '#525252' }}>
                {hasVoted ? 'Live Results' : 'Cast Your Vote'}
            </p>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '2.5rem' }}>{question}</h1>
            <button
                onClick={handleCopyLink}
                className="mono-label"
                style={{
                    background: 'transparent',
                    border: '1px solid #000000',
                    padding: '0.6rem 1.2rem',
                    marginBottom: '2.5rem',
                    transition: 'background 100ms, color 100ms',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#000000'
                    e.currentTarget.style.color = '#FFFFFF'
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#000000'
                }}
            >
                {copied ? '✓ Link Copied' : 'Copy Link →'}
            </button>

            {!hasVoted ? (
                <div>
                    {options.map((option) => (
                        <button
                            key={option}
                            onClick={() => handleVote(option)}
                            disabled={submitting}
                            style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '1.1rem 1.5rem',
                                marginBottom: '0.75rem',
                                background: '#FFFFFF',
                                border: '2px solid #000000',
                                fontSize: '1.1rem',
                                transition: 'background 100ms, color 100ms',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#000000'
                                e.currentTarget.style.color = '#FFFFFF'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#FFFFFF'
                                e.currentTarget.style.color = '#000000'
                            }}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            ) : (
                <div>
                    {options.map((option) => {
                        const count = voteCounts[option] || 0
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                        return (
                            <div key={option} style={{ marginBottom: '1.5rem' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.4rem',
                                        fontSize: '1.05rem',
                                    }}
                                >
                                    <span>{option}</span>
                                    <span className="mono-label">{count} · {pct}%</span>
                                </div>
                                <div style={{ height: '10px', background: '#F5F5F5', border: '1px solid #000000' }}>
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${pct}%`,
                                            background: '#000000',
                                            transition: 'width 300ms ease',
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                    <p className="mono-label" style={{ marginTop: '2rem', color: '#525252' }}>
                        {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                    </p>
                </div>
            )}
        </div>
    )
}

export default PollView