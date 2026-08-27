interface ErrorContext {
    /** Where the error came from, e.g. 'ErrorBoundary' or 'PollView.handleVote'. */
    source: string
    [key: string]: unknown
}

/**
 * Single funnel for unexpected client-side errors.
 *
 * Console-only today, deliberately — no third-party dependency. The point of
 * routing everything through here is that wiring up a real service later (Sentry
 * or similar) means changing this one function rather than every call site.
 */
export function logError(error: unknown, context: ErrorContext) {
    const report = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        url: typeof window === 'undefined' ? undefined : window.location.href,
        ...context,
    }

    console.error('[livepoll]', report)
}
