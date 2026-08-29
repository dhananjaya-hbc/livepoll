import { describe, test, expect } from 'vitest'
import {
    bucketVotes,
    formatDuration,
    peakBucket,
    timeToFirstVote,
    type VoteRecord,
} from '../pollAnalytics'

function votesAt(...offsets: number[]): VoteRecord[] {
    return offsets.map((offset) => ({ option: 'Tea', createdAt: 1000 + offset }))
}

describe('timeToFirstVote', () => {
    test('is null when nobody has voted', () => {
        expect(timeToFirstVote(1000, [])).toBeNull()
    })

    test('measures from poll creation to the earliest vote', () => {
        expect(timeToFirstVote(1000, votesAt(30, 90))).toBe(30)
    })

    test('never reports negative time when a clock skews', () => {
        expect(timeToFirstVote(1000, votesAt(-5))).toBe(0)
    })
})

describe('bucketVotes', () => {
    test('returns nothing when there are no votes', () => {
        expect(bucketVotes(1000, [])).toEqual([])
    })

    test('counts every vote exactly once', () => {
        const votes = votesAt(0, 10, 20, 30, 40, 50, 60)
        const total = bucketVotes(1000, votes).reduce((sum, b) => sum + b.count, 0)

        expect(total).toBe(votes.length)
    })

    test('keeps the final vote inside the last bucket rather than overflowing', () => {
        const buckets = bucketVotes(1000, votesAt(0, 100), 4)

        expect(buckets).toHaveLength(4)
        expect(buckets[buckets.length - 1].count).toBe(1)
    })

    test('handles every vote landing in the same second', () => {
        const buckets = bucketVotes(1000, votesAt(5, 5, 5), 3)

        expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(3)
    })

    test('spreads votes across buckets over a long poll', () => {
        // Poll created at the same moment as the first vote, so both halves of
        // its lifetime contain activity.
        const buckets = bucketVotes(1000, votesAt(0, 500, 1000), 2)

        expect(buckets[0].count).toBeGreaterThan(0)
        expect(buckets[1].count).toBeGreaterThan(0)
    })

    test('leaves early buckets empty when a poll sat idle before its first vote', () => {
        const buckets = bucketVotes(0, votesAt(0, 500, 1000), 2)

        expect(buckets[0].count).toBe(0)
        expect(buckets[1].count).toBe(3)
    })
})

describe('peakBucket', () => {
    test('is null with no buckets', () => {
        expect(peakBucket([])).toBeNull()
    })

    test('finds the busiest window', () => {
        const peak = peakBucket([
            { start: 0, count: 1 },
            { start: 10, count: 7 },
            { start: 20, count: 3 },
        ])

        expect(peak?.count).toBe(7)
    })
})

describe('formatDuration', () => {
    test.each([
        [45, '45s'],
        [125, '2m 5s'],
        [3700, '1h 1m'],
        [90000, '1d 1h'],
    ])('formats %i seconds as %s', (seconds, expected) => {
        expect(formatDuration(seconds)).toBe(expected)
    })
})
