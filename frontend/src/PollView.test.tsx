import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PollView from './PollView'

const { graphqlMock } = vi.hoisted(() => ({ graphqlMock: vi.fn() }))

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({ graphql: graphqlMock }),
}))

const unsubscribe = vi.fn()

function mockPoll(overrides: Record<string, unknown> = {}) {
  return {
    pollId: 'poll-1',
    question: 'Tea or coffee?',
    options: ['Tea', 'Coffee'],
    voteCounts: JSON.stringify({ Tea: 2, Coffee: 1 }),
    status: 'open',
    ...overrides,
  }
}

// PollView drives a query, a subscription, and a mutation through the same
// client.graphql call, so route each one by inspecting the operation.
function mockGraphql(
  poll: Record<string, unknown> | null,
  onVote: () => unknown = () =>
    Promise.resolve({ data: { submitVote: { pollId: 'poll-1' } } })
) {
  graphqlMock.mockImplementation((operation: { query: string }) => {
    if (operation.query.includes('subscription')) {
      return { subscribe: () => ({ unsubscribe }) }
    }
    if (operation.query.includes('query GetPoll')) {
      return Promise.resolve({ data: { getPoll: poll } })
    }
    return onVote()
  })
}

beforeEach(() => {
  graphqlMock.mockReset()
  unsubscribe.mockReset()
})

describe('PollView', () => {
  test('shows the loading skeleton before the poll arrives', async () => {
    mockGraphql(mockPoll())
    render(<PollView pollId="poll-1" />)

    expect(screen.getByText('Loading')).toBeInTheDocument()

    // Flush the pending fetch so the update lands inside the test.
    await screen.findByRole('button', { name: 'Tea' })
  })

  test('shows a 404 state when the poll does not exist', async () => {
    mockGraphql(null)
    render(<PollView pollId="missing" />)

    expect(await screen.findByText("This poll doesn't exist.")).toBeInTheDocument()
  })

  test('renders a vote button per option while the poll is open', async () => {
    mockGraphql(mockPoll())
    render(<PollView pollId="poll-1" />)

    expect(await screen.findByRole('button', { name: 'Tea' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coffee' })).toBeInTheDocument()
    expect(screen.getByText('Cast Your Vote')).toBeInTheDocument()
  })

  test('swaps to live results after voting', async () => {
    const user = userEvent.setup()
    mockGraphql(mockPoll())
    render(<PollView pollId="poll-1" />)

    await user.click(await screen.findByRole('button', { name: 'Tea' }))

    expect(await screen.findByText('Live Results')).toBeInTheDocument()
    expect(screen.getByText('3 total votes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Coffee' })).not.toBeInTheDocument()
  })

  test('hides the voting UI when the poll is closed', async () => {
    mockGraphql(mockPoll({ status: 'closed' }))
    render(<PollView pollId="poll-1" />)

    expect(
      await screen.findByText('Voting has ended for this poll.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tea' })).not.toBeInTheDocument()
  })

  test('sends a voter id with each vote', async () => {
    const user = userEvent.setup()
    mockGraphql(mockPoll())
    render(<PollView pollId="poll-1" />)

    await user.click(await screen.findByRole('button', { name: 'Tea' }))

    await waitFor(() =>
      expect(graphqlMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            pollId: 'poll-1',
            option: 'Tea',
            voterId: expect.any(String),
          }),
        })
      )
    )
  })

  test('explains the rejection when this voter has already voted', async () => {
    const user = userEvent.setup()
    mockGraphql(mockPoll(), () =>
      Promise.reject({ errors: [{ errorType: 'AlreadyVoted' }] })
    )
    render(<PollView pollId="poll-1" />)

    await user.click(await screen.findByRole('button', { name: 'Tea' }))

    expect(
      await screen.findByText('You have already voted in this poll.')
    ).toBeInTheDocument()
    // Falls through to results rather than leaving them on a dead end.
    expect(await screen.findByText('Live Results')).toBeInTheDocument()
  })

  test('marks the poll closed when the vote is rejected as closed', async () => {
    const user = userEvent.setup()
    mockGraphql(mockPoll(), () =>
      Promise.reject({ errors: [{ errorType: 'PollClosed' }] })
    )
    render(<PollView pollId="poll-1" />)

    await user.click(await screen.findByRole('button', { name: 'Tea' }))

    expect(
      await screen.findByText('This poll is closed. Voting has ended.')
    ).toBeInTheDocument()
  })

  test('counts down while an expiring poll is still open', async () => {
    mockGraphql(mockPoll({ expiresAt: Math.floor(Date.now() / 1000) + 3600 }))
    render(<PollView pollId="poll-1" />)

    expect(await screen.findByText(/^Closes in /)).toBeInTheDocument()
  })

  test('treats a poll past its expiry as closed without waiting for the sweep', async () => {
    mockGraphql(mockPoll({ expiresAt: Math.floor(Date.now() / 1000) - 10 }))
    render(<PollView pollId="poll-1" />)

    expect(
      await screen.findByText('Voting has ended for this poll.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tea' })).not.toBeInTheDocument()
  })

  test('unsubscribes from vote updates on unmount', async () => {
    mockGraphql(mockPoll())
    const { unmount } = render(<PollView pollId="poll-1" />)
    await screen.findByRole('button', { name: 'Tea' })

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
