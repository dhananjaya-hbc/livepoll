import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Dashboard from './Dashboard'

const { graphqlMock } = vi.hoisted(() => ({ graphqlMock: vi.fn() }))

vi.mock('aws-amplify/api', () => ({
    generateClient: () => ({ graphql: graphqlMock }),
}))

function mockPoll(overrides: Record<string, unknown> = {}) {
    return {
        pollId: 'poll-1',
        question: 'Tea or coffee?',
        options: ['Tea', 'Coffee'],
        status: 'open',
        voteCounts: JSON.stringify({ Tea: 2, Coffee: 1 }),
        createdAt: 1756300000,
        ...overrides,
    }
}

// Stands in for the create-poll route so we can assert what state the dashboard
// hands over when duplicating.
function CreateStub() {
    const state = useLocation().state as { question?: string; options?: string[] } | null
    return <p>duplicating: {state?.question} / {state?.options?.join(',')}</p>
}

function renderDashboard() {
    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/" element={<CreateStub />} />
            </Routes>
        </MemoryRouter>
    )
}

beforeEach(() => {
    graphqlMock.mockReset()
})

describe('Dashboard', () => {
    test('lists the host polls with vote totals', async () => {
        graphqlMock.mockResolvedValue({ data: { listMyPolls: [mockPoll()] } })
        renderDashboard()

        expect(await screen.findByRole('link', { name: 'Tea or coffee?' })).toBeInTheDocument()
        expect(screen.getByText(/3 votes/)).toBeInTheDocument()
        expect(screen.getByText('open')).toBeInTheDocument()
    })

    test('shows an empty state with a call to action when there are no polls', async () => {
        graphqlMock.mockResolvedValue({ data: { listMyPolls: [] } })
        renderDashboard()

        expect(await screen.findByText('No polls yet.')).toBeInTheDocument()
        expect(
            screen.getByRole('link', { name: /create your first poll/i })
        ).toBeInTheDocument()
    })

    test('reports a failure to load rather than showing an empty list', async () => {
        graphqlMock.mockRejectedValue(new Error('network down'))
        renderDashboard()

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Could not load your polls'
        )
    })

    test('duplicating hands the question and options to the create form', async () => {
        const user = userEvent.setup()
        graphqlMock.mockResolvedValue({ data: { listMyPolls: [mockPoll()] } })
        renderDashboard()

        await user.click(await screen.findByRole('button', { name: /duplicate/i }))

        expect(
            await screen.findByText('duplicating: Tea or coffee? / Tea,Coffee')
        ).toBeInTheDocument()
    })
})
