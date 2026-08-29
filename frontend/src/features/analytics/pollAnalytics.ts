export interface VoteRecord {
    option: string
    createdAt: number
}

export interface TimeBucket {
    /** Unix seconds at the start of the bucket. */
    start: number
    count: number
}

/**
 * Seconds between the poll being created and its first vote arriving, or null
 * when nobody has voted yet. Votes arrive sorted, so the first is the earliest.
 */
export function timeToFirstVote(pollCreatedAt: number, votes: VoteRecord[]): number | null {
    if (votes.length === 0) return null
    return Math.max(0, votes[0].createdAt - pollCreatedAt)
}

/**
 * Splits votes into equal time buckets spanning creation to the last vote.
 *
 * Buckets are relative to the poll's own lifetime rather than fixed hours, so a
 * poll that ran for two minutes and one that ran for two days both produce a
 * readable shape.
 */
export function bucketVotes(
    pollCreatedAt: number,
    votes: VoteRecord[],
    bucketCount = 12
): TimeBucket[] {
    if (votes.length === 0 || bucketCount < 1) return []

    const start = Math.min(pollCreatedAt, votes[0].createdAt)
    const end = votes[votes.length - 1].createdAt
    // Every vote landing in the same second still deserves one bucket.
    const span = Math.max(1, end - start)
    const width = span / bucketCount

    const buckets: TimeBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
        start: Math.round(start + i * width),
        count: 0,
    }))

    for (const vote of votes) {
        const offset = Math.floor((vote.createdAt - start) / width)
        // The final vote sits exactly on the upper bound; keep it in the last bucket.
        const index = Math.min(bucketCount - 1, Math.max(0, offset))
        buckets[index].count += 1
    }

    return buckets
}

/** The busiest bucket, for reporting peak activity. */
export function peakBucket(buckets: TimeBucket[]): TimeBucket | null {
    if (buckets.length === 0) return null
    return buckets.reduce((peak, bucket) => (bucket.count > peak.count ? bucket : peak))
}

/** Human-readable duration, e.g. "2m 5s". Input is seconds. */
export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ${minutes % 60}m`

    return `${Math.floor(hours / 24)}d ${hours % 24}h`
}
