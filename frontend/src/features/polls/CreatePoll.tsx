import { useState } from 'react'
import Toast from '../../shared/components/Toast'
import { createPoll } from './pollsApi'
import { Link, useLocation } from 'react-router-dom'


const EXPIRY_OPTIONS = [
    { label: 'Never', seconds: 0 },
    { label: '15 minutes', seconds: 15 * 60 },
    { label: '1 hour', seconds: 60 * 60 },
    { label: '24 hours', seconds: 24 * 60 * 60 },
]

// Starter shapes for the most common poll formats. "Multiple choice" seeds blank
// fields rather than placeholder text — filler the host has to delete is worse
// than an empty field they can type into.
const TEMPLATES = [
    { name: 'Yes / No', options: ['Yes', 'No'] },
    { name: 'Rate 1–5', options: ['1', '2', '3', '4', '5'] },
    { name: 'Multiple choice', options: ['', '', '', ''] },
]

interface DuplicatedPoll {
    question?: string
    options?: string[]
}

interface CreatePollProps {
    onPollCreated: (pollId: string) => void
}

function CreatePoll({ onPollCreated }: CreatePollProps) {
    // Set when the host clicked "Duplicate" on the dashboard.
    const duplicated = useLocation().state as DuplicatedPoll | null
    const [question, setQuestion] = useState(duplicated?.question ?? '')
    const [options, setOptions] = useState(duplicated?.options ?? ['', ''])
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
            const pollId = await createPoll({
                question: question.trim(),
                options: trimmedOptions,
                // null tells the resolver to omit the attribute entirely, which
                // keeps the poll out of the sparse expiry index.
                expiresAt: expiresIn > 0 ? Math.floor(Date.now() / 1000) + expiresIn : null,
            })
            onPollCreated(pollId)
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
            <div className="page">
                <div className="page-header">
                    <p className="mono-label muted">LivePoll</p>
                    <Link to="/dashboard" className="mono-label">
                        My Polls →
                    </Link>
                </div>

                <h1 style={{ fontSize: 'var(--text-display)', marginBottom: 'var(--space-4)' }}>
                    Ask the room.<br />Watch it answer.
                </h1>
                <p className="muted" style={{ fontSize: '1.1rem', marginBottom: 'var(--space-8)', maxWidth: '480px' }}>
                    Create a poll, share the link, and watch results update live as votes come in — no refresh needed.
                </p>
                {duplicated && (
                    <p className="mono-label muted" style={{ marginBottom: 'var(--space-5)' }}>
                        ✓ Duplicated — edit anything before publishing
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="field-group">
                        <p className="mono-label" id="templates-label" style={{ marginBottom: 'var(--space-2)' }}>
                            Start from
                        </p>
                        <div className="template-row" role="group" aria-labelledby="templates-label">
                            {TEMPLATES.map((template) => (
                                <button
                                    key={template.name}
                                    type="button"
                                    className="btn chip mono-label"
                                    onClick={() => setOptions([...template.options])}
                                >
                                    {template.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="field-group">
                        <label className="mono-label" htmlFor="poll-question">
                            Question
                        </label>
                        <input
                            id="poll-question"
                            type="text"
                            className="field field-lg"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="What do you want to ask?"
                        />
                    </div>

                    <fieldset className="field-group" style={{ border: 'none' }}>
                        <legend className="mono-label" style={{ marginBottom: 'var(--space-2)' }}>
                            Options
                        </legend>
                        {options.map((opt, i) => (
                            <div key={i} className="field-row">
                                <input
                                    type="text"
                                    className="field"
                                    style={{ flex: 1 }}
                                    value={opt}
                                    onChange={(e) => updateOption(i, e.target.value)}
                                    placeholder={`Option ${i + 1}`}
                                    aria-label={`Option ${i + 1}`}
                                />
                                {options.length > 2 && (
                                    <button
                                        type="button"
                                        className="btn btn-icon"
                                        onClick={() => removeOption(i)}
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
                                className="btn btn-link"
                                onClick={addOption}
                                style={{ marginTop: 'var(--space-2)' }}
                            >
                                + Add option
                            </button>
                        )}
                    </fieldset>

                    <div className="field-group">
                        <label className="mono-label" htmlFor="expires-in">
                            Poll expires in
                        </label>
                        <select
                            id="expires-in"
                            className="field"
                            value={expiresIn}
                            onChange={(e) => setExpiresIn(Number(e.target.value))}
                        >
                            {EXPIRY_OPTIONS.map((option) => (
                                <option key={option.seconds} value={option.seconds}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <p role="alert" style={{ fontStyle: 'italic', marginBottom: 'var(--space-5)' }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary mono-label"
                        disabled={loading}
                        aria-busy={loading}
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