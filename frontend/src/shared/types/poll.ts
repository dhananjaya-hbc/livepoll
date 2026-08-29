/**
 * Domain types mirroring the GraphQL schema.
 *
 * `voteCounts` is AWSJSON on the wire — a JSON *string*, not an object — so it
 * is typed as such here and parsed at the edge by `parseVoteCounts`.
 */
export interface Poll {
    pollId: string
    hostId: string
    question: string
    options: string[]
    voteCounts: string
    status: PollStatus
    createdAt: number
    expiresAt: number | null
}

export type PollStatus = 'open' | 'closed'

/** A single vote, as exposed to the poll's host. Deliberately has no voter id. */
export interface Vote {
    option: string
    createdAt: number
}

export function parseVoteCounts(voteCounts: string): Record<string, number> {
    try {
        return JSON.parse(voteCounts || '{}')
    } catch {
        return {}
    }
}

export function totalVotes(counts: Record<string, number>): number {
    return Object.values(counts).reduce((sum, count) => sum + count, 0)
}
