import { useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import Toast from './Toast'
import { Link } from 'react-router-dom'


const createPollMutation = /* GraphQL */ `
  mutation CreatePoll($question: String!, $options: [String!]!, $expiresAt: AWSTimestamp) {
    createPoll(question: $question, options: $options, expiresAt: $expiresAt) {
      pollId
      question
      options
      status
    }
  }
`

const EXPIRY_OPTIONS = [
    { label: 'Never', seconds: 0 },
    { label: '15 minutes', seconds: 15 * 60 },
    { label: '1 hour', seconds: 60 * 60 },
    { label: '24 hours', seconds: 24 * 60 * 60 },
]

interface CreatePollProps {
    onPollCreated: (pollId: string) => void
}

function CreatePoll({ onPollCreated }: CreatePollProps) {
    const [question, setQuestion] = useState('')
    const [options, setOptions] = useState(['', ''])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [expiresIn, setExpiresIn] = useState(0)

    function updateOption(index: number, value: string) {
        const next = [...options]
        next[index] = value
        setOptions(next)
    }

    function addOption() {
        if (options.length < 6) setOptions([...options, ''])
    }

    function removeOption(index: number) {
        if (options.length > 2) setOptions(options.filter((_, i) => i !== index))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        const trimmedOptions = options.map((o) => o.trim()).filter(Boolean)
        if (!question.trim()) {
            setError('A question is required.')
            return
        }
        if (trimmedOptions.length < 2) {
            setError('At least two options are required.')
            return
        }

        setLoading(true)
        try {
            const client = generateClient()   // ← make sure this line exists
            const response = await client.graphql({
                query: createPollMutation,
                variables: {
                    question: question.trim(),
                    options: trimmedOptions,
                    // null tells the resolver to omit the attribute entirely, which
                    // keeps the poll out of the sparse expiry index.
                    expiresAt: expiresIn > 0 ? Math.floor(Date.now() / 1000) + expiresIn : null,
                },
                authMode: 'userPool',
            }) as { data: { createPoll: { pollId: string } } }
            onPollCreated(response.data.createPoll.pollId)
        } catch (err) {
            setError('Something went wrong creating the poll.')
            setToastMessage('Could not create your poll. Please check your connection and try again.')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div style={{ maxWidth: '640px', margin: '0 auto', padding: '4rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <p className="mono-label" style={{ color: '#525252' }}>LivePoll</p>
                    <Link to="/dashboard" className="mono-label" style={{ color: '#000000' }}>
                        My Polls →
                    </Link>
                </div>

                <h1 style={{ fontSize: '3.25rem', marginBottom: '1rem' }}>
                    Ask the room.<br />Watch it answer.
                </h1>
                <p style={{ color: '#525252', fontSize: '1.1rem', marginBottom: '3rem', maxWidth: '480px' }}>
                    Create a poll, share the link, and watch results update live as votes come in — no refresh needed.
                </p>
                <form onSubmit={handleSubmit}>
                    {/* Question field */}
                    <div style={{ marginBottom: '2rem' }}>
                        <label className="mono-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            Question
                        </label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="What do you want to ask?"
                            style={{
                                width: '100%',
                                padding: '0.75rem 0',
                                fontSize: '1.25rem',
                                border: 'none',
                                borderBottom: '2px solid #000000',
                                outline: 'none',
                                background: 'transparent',
                            }}
                        />
                    </div>

                    {/* Options */}
                    <div style={{ marginBottom: '2rem' }}>
                        <label className="mono-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            Options
                        </label>
                        {options.map((opt, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => updateOption(i, e.target.value)}
                                    placeholder={`Option ${i + 1}`}
                                    style={{
                                        flex: 1,
                                        padding: '0.6rem 0',
                                        fontSize: '1.05rem',
                                        border: 'none',
                                        borderBottom: '2px solid #000000',
                                        outline: 'none',
                                        background: 'transparent',
                                    }}
                                />
                                {options.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => removeOption(i)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#525252',
                                            fontSize: '1.25rem',
                                            lineHeight: 1,
                                        }}
                                        aria-label={`Remove option ${i + 1}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}

                        {options.length < 6 && (
                            <button
                                type="button"
                                onClick={addOption}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: '1px solid #000000',
                                    padding: '0.25rem 0',
                                    fontSize: '0.95rem',
                                    marginTop: '0.5rem',
                                }}
                            >
                                + Add option
                            </button>
                        )}
                    </div>

                    {/* Expiry */}
                    <div style={{ marginBottom: '2rem' }}>
                        <label
                            className="mono-label"
                            htmlFor="expires-in"
                            style={{ display: 'block', marginBottom: '0.5rem' }}
                        >
                            Poll expires in
                        </label>
                        <select
                            id="expires-in"
                            value={expiresIn}
                            onChange={(e) => setExpiresIn(Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '0.6rem 0',
                                fontSize: '1.05rem',
                                fontFamily: "'Source Serif 4', Georgia, serif",
                                border: 'none',
                                borderBottom: '2px solid #000000',
                                outline: 'none',
                                background: 'transparent',
                            }}
                        >
                            {EXPIRY_OPTIONS.map((option) => (
                                <option key={option.seconds} value={option.seconds}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <p style={{ color: '#000000', fontStyle: 'italic', marginBottom: '1.5rem' }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mono-label"
                        style={{
                            background: '#000000',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '1rem 2.5rem',
                            transition: 'background 100ms, color 100ms',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FFFFFF'
                            e.currentTarget.style.color = '#000000'
                            e.currentTarget.style.outline = '2px solid #000000'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#000000'
                            e.currentTarget.style.color = '#FFFFFF'
                            e.currentTarget.style.outline = 'none'
                        }}
                    >
                        {loading ? 'Creating…' : 'Create Poll →'}
                    </button>
                </form>
            </div>
            {toastMessage && (
                <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
            )}
        </>
    )
}

export default CreatePoll