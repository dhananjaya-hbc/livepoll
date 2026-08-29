import { useEffect, useState } from 'react'
import Toast from '../../shared/components/Toast'
import { graphqlErrorType } from '../../shared/api/graphqlClient'
import { parseVoteCounts, type PollStatus } from '../../shared/types/poll'
import { closePoll, getPoll, submitVote, subscribeToVoteUpdates } from './pollsApi'
import { getVoterId } from './voterId'

function formatRemaining(seconds: number): string {
    if (seconds <= 0) return 'Voting has ended'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) return `Closes in ${hours}h ${minutes}m`
    if (minutes > 0) return `Closes in ${minutes}m ${secs}s`
    return `Closes in ${secs}s`
}

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
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [pollStatus, setPollStatus] = useState<PollStatus>('open')
    const [closing, setClosing] = useState(false)
    const [expiresAt, setExpiresAt] = useState<number | null>(null)
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

    // Load initial poll data
    useEffect(() => {
        async function loadPoll() {
            try {
                const poll = await getPoll(pollId)

                if (!poll) {
                    setNotFound(true)
                    return
                }

                setQuestion(poll.question)
                setOptions(poll.options)
                setVoteCounts(parseVoteCounts(poll.voteCounts))
                setPollStatus(poll.status)
                setExpiresAt(poll.expiresAt ?? null)
            } catch (err) {
                console.error('Failed to load poll:', err)
                setNotFound(true)
            } finally {
                setLoading(false)
            }
        }
        loadPoll()
    }, [pollId])

    // Subscribe to live vote updates
    useEffect(() => {
        const subscription = subscribeToVoteUpdates(
            pollId,
            (voteCounts) => setVoteCounts(parseVoteCounts(voteCounts)),
            (err) => console.error('Subscription error:', err)
        )

        return () => subscription.unsubscribe()
    }, [pollId])

    // Tick the countdown, and flip to closed the moment the deadline passes — the
    // scheduled sweep can be up to five minutes behind, and the backend already
    // rejects votes on an expired poll.
    useEffect(() => {
        const deadline = expiresAt
        if (!deadline || pollStatus !== 'open') return

        function tick() {
            const current = Math.floor(Date.now() / 1000)
            setNow(current)
            if (current >= deadline!) setPollStatus('closed')
        }

        tick()
        const timer = setInterval(tick, 1000)
        return () => clearInterval(timer)
    }, [expiresAt, pollStatus])

    async function handleVote(option: string) {
        setSubmitting(true)
        try {
            await submitVote({ pollId, option, voterId: getVoterId() })
            setHasVoted(true)
        } catch (err) {
            console.error('Vote failed:', err)
            const errorType = graphqlErrorType(err)

            if (errorType === 'AlreadyVoted') {
                // Their vote is already counted — show results rather than a dead end.
                setHasVoted(true)
                setToastMessage('You have already voted in this poll.')
            } else if (errorType === 'PollClosed') {
                setPollStatus('closed')
                setToastMessage('This poll is closed. Voting has ended.')
            } else {
                setToastMessage('Your vote could not be submitted. Please try again.')
            }
        } finally {
            setSubmitting(false)
        }
    }
    async function handleClosePoll() {
        setClosing(true)
        try {
            await closePoll(pollId)
            setPollStatus('closed')
            setToastMessage('Poll closed.')
        } catch (err) {
            console.error('Close poll failed:', err)
            setToastMessage('Could not close this poll. You may not be the host.')
        } finally {
            setClosing(false)
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
        return (
            <div className="page" aria-busy="true">
                <p className="mono-label muted" style={{ marginBottom: 'var(--space-4)' }}>
                    Loading
                </p>
                <div className="skeleton" style={{ height: '3.5rem', width: '70%', marginBottom: 'var(--space-7)' }} />
                <div className="skeleton-outline" style={{ height: '3.5rem', marginBottom: 'var(--space-3)' }} />
                <div className="skeleton-outline" style={{ height: '3.5rem', marginBottom: 'var(--space-3)' }} />
                <div className="skeleton-outline" style={{ height: '3.5rem' }} />
            </div>
        )
    }

    if (notFound) {
        return (
            <>
                <div className="page" style={{ textAlign: 'center' }}>
                    <p className="mono-label muted" style={{ marginBottom: 'var(--space-4)' }}>
                        404
                    </p>
                    <h1 style={{ marginBottom: 'var(--space-4)' }}>
                        This poll doesn't exist.
                    </h1>

                    <p className="muted" style={{ marginBottom: 'var(--space-6)' }}>
                        The link might be wrong, or the poll may have been removed.
                    </p>
                    <a href="/" className="btn btn-primary mono-label" style={{ textDecoration: 'none' }}>
                        Create a New Poll →
                    </a>
                </div>
                {toastMessage && (
                    <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
                )}
            </>
        )

    }

    const totalVotes = Object.values(voteCounts).reduce((sum, n) => sum + n, 0)

    return (
        <>
            <div className="page">
                <p className="mono-label muted" style={{ marginBottom: 'var(--space-4)' }}>
                    {hasVoted ? 'Live Results' : 'Cast Your Vote'}
                </p>
                <h1 style={{ marginBottom: 'var(--space-7)' }}>{question}</h1>
                {expiresAt && pollStatus === 'open' && (
                    <p
                        className="mono-label muted"
                        style={{ marginBottom: 'var(--space-5)' }}
                        role="timer"
                        aria-live="off"
                    >
                        {formatRemaining(expiresAt - now)}
                    </p>
                )}
                <button
                    type="button"
                    className="btn btn-ghost mono-label"
                    onClick={handleCopyLink}
                    style={{ marginBottom: 'var(--space-7)' }}
                >
                    {copied ? '✓ Link Copied' : 'Copy Link →'}
                </button>

                {!hasVoted && pollStatus === 'open' ? (
                    <div>
                        {options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                className="btn btn-option"
                                onClick={() => handleVote(option)}
                                disabled={submitting}
                                aria-busy={submitting}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                ) : !hasVoted && pollStatus === 'closed' ? (
                    <div className="empty-state">
                        <p className="mono-label muted" style={{ marginBottom: 'var(--space-4)' }}>
                            This poll is closed.
                        </p>
                        <p className="muted">Voting has ended for this poll.</p>
                    </div>
                ) : (
                    <div>
                        {options.map((option) => {
                            const count = voteCounts[option] || 0
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
                        <p className="mono-label muted" style={{ marginTop: 'var(--space-6)' }} aria-live="polite">
                            {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                        </p>

                        {pollStatus === 'open' && (
                            <button
                                type="button"
                                className="btn btn-ghost mono-label"
                                onClick={handleClosePoll}
                                disabled={closing}
                                aria-busy={closing}
                                style={{ marginTop: 'var(--space-6)' }}
                            >
                                {closing ? 'Closing…' : 'Close Poll'}
                            </button>
                        )}
                        {pollStatus === 'closed' && (
                            <p className="mono-label muted" style={{ marginTop: 'var(--space-6)' }}>
                                This poll is closed.
                            </p>
                        )}
                    </div>
                )}
            </div>
            {toastMessage && (
                <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
            )}
        </>
    )
}

export default PollView