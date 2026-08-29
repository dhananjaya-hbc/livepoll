import { graphqlRequest } from '../../shared/api/graphqlClient'
import type { Poll, Vote } from '../../shared/types/poll'

/**
 * A wider selection than the voting screen's getPoll: analytics needs createdAt
 * to measure time-to-first-vote, which voters never see.
 */
const GET_POLL_DETAIL = /* GraphQL */ `
  query GetPoll($pollId: ID!) {
    getPoll(pollId: $pollId) {
      question
      options
      voteCounts
      status
      createdAt
    }
  }
`

const LIST_POLL_VOTES = /* GraphQL */ `
  query ListPollVotes($pollId: ID!) {
    listPollVotes(pollId: $pollId) {
      option
      createdAt
    }
  }
`

export type PollDetail = Pick<
    Poll,
    'question' | 'options' | 'voteCounts' | 'status' | 'createdAt'
>

export async function getPollDetail(pollId: string): Promise<PollDetail | null> {
    const data = await graphqlRequest<{ getPoll: PollDetail | null }>(
        GET_POLL_DETAIL,
        { pollId },
        'userPool'
    )

    return data.getPoll
}

/** Host-only: the resolver rejects anyone who does not own the poll. */
export async function listPollVotes(pollId: string): Promise<Vote[]> {
    const data = await graphqlRequest<{ listPollVotes: Vote[] }>(
        LIST_POLL_VOTES,
        { pollId },
        'userPool'
    )

    return data.listPollVotes
}
