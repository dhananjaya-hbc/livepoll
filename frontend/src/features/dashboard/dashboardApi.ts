import { graphqlRequest } from '../../shared/api/graphqlClient'
import type { Poll } from '../../shared/types/poll'

const LIST_MY_POLLS = /* GraphQL */ `
  query ListMyPolls {
    listMyPolls {
      pollId
      question
      options
      status
      voteCounts
      createdAt
    }
  }
`

/** The dashboard row shape — no hostId or expiresAt needed to render a list. */
export type PollSummary = Pick<
    Poll,
    'pollId' | 'question' | 'options' | 'status' | 'voteCounts' | 'createdAt'
>

export async function listMyPolls(): Promise<PollSummary[]> {
    const data = await graphqlRequest<{ listMyPolls: PollSummary[] }>(
        LIST_MY_POLLS,
        {},
        'userPool'
    )

    return data.listMyPolls
}
