import {
    graphqlRequest,
    graphqlSubscribe,
    type Subscription,
} from '../../shared/api/graphqlClient'
import type { Poll, PollStatus } from '../../shared/types/poll'

const CREATE_POLL = /* GraphQL */ `
  mutation CreatePoll($question: String!, $options: [String!]!, $expiresAt: AWSTimestamp) {
    createPoll(question: $question, options: $options, expiresAt: $expiresAt) {
      pollId
      question
      options
      status
    }
  }
`

const GET_POLL = /* GraphQL */ `
  query GetPoll($pollId: ID!) {
    getPoll(pollId: $pollId) {
      pollId
      question
      options
      voteCounts
      status
      expiresAt
    }
  }
`

const SUBMIT_VOTE = /* GraphQL */ `
  mutation SubmitVote($pollId: ID!, $option: String!, $voterId: String!) {
    submitVote(pollId: $pollId, option: $option, voterId: $voterId) {
      pollId
      voteCounts
    }
  }
`

const CLOSE_POLL = /* GraphQL */ `
  mutation ClosePoll($pollId: ID!) {
    closePoll(pollId: $pollId) {
      pollId
      status
    }
  }
`

const ON_VOTE_UPDATE = /* GraphQL */ `
  subscription OnVoteUpdate($pollId: ID!) {
    onVoteUpdate(pollId: $pollId) {
      pollId
      voteCounts
    }
  }
`

/** What the voting screen needs — a subset of the full Poll. */
export type PollForVoting = Pick<
    Poll,
    'question' | 'options' | 'voteCounts' | 'expiresAt'
> & { status: PollStatus }

export async function createPoll(input: {
    question: string
    options: string[]
    expiresAt: number | null
}): Promise<string> {
    const data = await graphqlRequest<{ createPoll: { pollId: string } }>(
        CREATE_POLL,
        input,
        'userPool'
    )

    return data.createPoll.pollId
}

export async function getPoll(pollId: string): Promise<PollForVoting | null> {
    const data = await graphqlRequest<{ getPoll: PollForVoting | null }>(
        GET_POLL,
        { pollId },
        'apiKey'
    )

    return data.getPoll
}

export async function submitVote(input: {
    pollId: string
    option: string
    voterId: string
}): Promise<void> {
    await graphqlRequest(SUBMIT_VOTE, input, 'apiKey')
}

export async function closePoll(pollId: string): Promise<void> {
    await graphqlRequest(CLOSE_POLL, { pollId }, 'userPool')
}

export function subscribeToVoteUpdates(
    pollId: string,
    onUpdate: (voteCounts: string) => void,
    onError?: (error: unknown) => void
): Subscription {
    return graphqlSubscribe<{ onVoteUpdate?: { voteCounts: string } }>(
        ON_VOTE_UPDATE,
        { pollId },
        'apiKey',
        {
            next: (data) => {
                if (data.onVoteUpdate) onUpdate(data.onVoteUpdate.voteCounts)
            },
            error: onError,
        }
    )
}
