const STORAGE_KEY = 'livepoll_voter_id'

// Identifies a browser so the backend can reject a second vote on the same poll.
// Clearing storage or switching browser defeats this — it raises the cost of
// ballot stuffing, it does not make it impossible.
export function getVoterId(): string {
    try {
        const existing = localStorage.getItem(STORAGE_KEY)
        if (existing) return existing

        const voterId = crypto.randomUUID()
        localStorage.setItem(STORAGE_KEY, voterId)
        return voterId
    } catch {
        // Private mode or blocked storage — fall back to a throwaway id.
        return crypto.randomUUID()
    }
}
