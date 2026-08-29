import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Analytics from '../Analytics'

const { graphqlMock } = vi.hoisted(() => ({ graphqlMock: vi.fn() }))

vi.mock('aws-amplify/api', () => ({
    generateClient: () => ({ graphql: graphqlMock }),
}))

const POLL_CREATED_AT = 1756300000

function mockGraphql(options: {
    poll?: Record<string, unknown> | null
    votes?: { option: string; createdAt: number }[]
    reject?: boolean
}) {
    graphqlMock.mockImplementation((operation: { query: string }) => {
        if (options.reject) return Promise.reject(new Error('Unauthorized'))

        if (operation.query.includes('query GetPoll')) {
            return Promise.resolve({
                data: {
                    getPoll:
                        options.poll === undefined
                            ? {
                                  question: 'Tea or coffee?',
                                  options: ['Tea', 'Coffee'],
                                  voteCounts: JSON.stringify({ Tea: 2, Coffee: 1 }),
                                  status: 'open',
                                  createdAt: POLL_CREATED_AT,
                              }
                            : options.poll,
                },
            })
        }

        return Promise.resolve({ data: { listPollVotes: options.votes ?? [] } })
    })
}

function renderAnalytics() {
    render(
        <MemoryRouter>
            <Analytics pollId="poll-1" />
        </MemoryRouter>
    )
}

beforeEach(() => {
    graphqlMock.mockReset()
})

describe('Analytics', () => {
    test('summarises voters, timing and share of vote', async () => {
        mockGraphql({
            votes: [
                { option: 'Tea', createdAt: POLL_CREATED_AT + 30 },
                { option: 'Tea', createdAt: POLL_CREATED_AT + 90 },
                { option: 'Coffee', createdAt: POLL_CREATED_AT + 120 },
            ],
        })
        renderAnalytics()

        expect(await screen.findByText('Tea or coffee?')).toBeInTheDocument()
        // 3 total votes, first arriving 30s after creation.
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getByText('30s')).toBeInTheDocument()
        expect(screen.getByRole('meter', { name: 'Tea' })).toHaveAttribute(
            'aria-valuenow',
            '67'
        )
    })

    test('exports results as a downloadable CSV file', async () => {
        const user = userEvent.setup()
        const createObjectURL = vi.fn(() => 'blob:fake')
        const revokeObjectURL = vi.fn()
        vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
        // jsdom does not implement navigation, so stop the anchor from acting.
        const clickSpy = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(() => {})

        mockGraphql({ votes: [] })
        renderAnalytics()

        await user.click(await screen.findByRole('button', { name: /export csv/i }))

        expect(createObjectURL).toHaveBeenCalled()
        expect(clickSpy).toHaveBeenCalled()
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')

        clickSpy.mockRestore()
        vi.unstubAllGlobals()
    })

    test('copies a pasteable summary to the clipboard', async () => {
        const user = userEvent.setup()
        const writeText = vi.fn(() => Promise.resolve())
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

        mockGraphql({ votes: [] })
        renderAnalytics()

        await user.click(await screen.findByRole('button', { name: /copy summary/i }))

        expect(writeText).toHaveBeenCalledWith(
            expect.stringContaining('Tea or coffee?')
        )
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Tea — 2 (67%)'))
        expect(await screen.findByText('✓ Summary Copied')).toBeInTheDocument()

        vi.unstubAllGlobals()
    })

    test('explains that a poll with no votes has no timeline yet', async () => {
        mockGraphql({ votes: [] })
        renderAnalytics()

        expect(await screen.findByText(/No votes yet/)).toBeInTheDocument()
        expect(screen.getByText('—')).toBeInTheDocument()
    })

    test('tells a non-owner why they cannot see the data', async () => {
        mockGraphql({ reject: true })
        renderAnalytics()

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'only view analytics for polls you created'
        )
    })

    test('handles a poll that no longer exists', async () => {
        mockGraphql({ poll: null })
        renderAnalytics()

        expect(await screen.findByRole('alert')).toHaveTextContent('no longer exists')
    })
})
