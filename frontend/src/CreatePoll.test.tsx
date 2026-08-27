import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CreatePoll from './CreatePoll'

const { graphqlMock } = vi.hoisted(() => ({ graphqlMock: vi.fn() }))

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({ graphql: graphqlMock }),
}))

function renderCreatePoll() {
  const onPollCreated = vi.fn()
  render(
    <MemoryRouter>
      <CreatePoll onPollCreated={onPollCreated} />
    </MemoryRouter>
  )
  return { onPollCreated }
}

beforeEach(() => {
  graphqlMock.mockReset()
})

describe('CreatePoll', () => {
  test('starts with two empty option fields', () => {
    renderCreatePoll()

    expect(screen.getByPlaceholderText('Option 1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Option 2')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Option 3')).not.toBeInTheDocument()
  })

  test('rejects a submission with no question', async () => {
    const user = userEvent.setup()
    renderCreatePoll()

    await user.type(screen.getByPlaceholderText('Option 1'), 'Tea')
    await user.type(screen.getByPlaceholderText('Option 2'), 'Coffee')
    await user.click(screen.getByRole('button', { name: /create poll/i }))

    expect(await screen.findByText('A question is required.')).toBeInTheDocument()
    expect(graphqlMock).not.toHaveBeenCalled()
  })

  test('rejects a submission with fewer than two options', async () => {
    const user = userEvent.setup()
    renderCreatePoll()

    await user.type(
      screen.getByPlaceholderText('What do you want to ask?'),
      'Tea or coffee?'
    )
    await user.type(screen.getByPlaceholderText('Option 1'), 'Tea')
    await user.click(screen.getByRole('button', { name: /create poll/i }))

    expect(
      await screen.findByText('At least two options are required.')
    ).toBeInTheDocument()
    expect(graphqlMock).not.toHaveBeenCalled()
  })

  test('adds option fields up to a maximum of six', async () => {
    const user = userEvent.setup()
    renderCreatePoll()

    await user.click(screen.getByRole('button', { name: '+ Add option' }))
    expect(screen.getByPlaceholderText('Option 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Add option' }))
    await user.click(screen.getByRole('button', { name: '+ Add option' }))
    await user.click(screen.getByRole('button', { name: '+ Add option' }))

    expect(screen.getByPlaceholderText('Option 6')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '+ Add option' })
    ).not.toBeInTheDocument()
  })

  test('removes an option field', async () => {
    const user = userEvent.setup()
    renderCreatePoll()

    await user.click(screen.getByRole('button', { name: '+ Add option' }))
    expect(screen.getByPlaceholderText('Option 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove option 3' }))

    expect(screen.queryByPlaceholderText('Option 3')).not.toBeInTheDocument()
  })

  test('submits a valid poll and reports the new poll id', async () => {
    const user = userEvent.setup()
    graphqlMock.mockResolvedValue({ data: { createPoll: { pollId: 'poll-123' } } })
    const { onPollCreated } = renderCreatePoll()

    await user.type(
      screen.getByPlaceholderText('What do you want to ask?'),
      'Tea or coffee?'
    )
    await user.type(screen.getByPlaceholderText('Option 1'), 'Tea')
    await user.type(screen.getByPlaceholderText('Option 2'), 'Coffee')
    await user.click(screen.getByRole('button', { name: /create poll/i }))

    await waitFor(() => expect(onPollCreated).toHaveBeenCalledWith('poll-123'))
    expect(graphqlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { question: 'Tea or coffee?', options: ['Tea', 'Coffee'] },
        authMode: 'userPool',
      })
    )
  })
})
