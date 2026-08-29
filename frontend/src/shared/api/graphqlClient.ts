import { generateClient } from 'aws-amplify/api'

/**
 * `apiKey` is the anonymous voter path; `userPool` requires a signed-in host.
 * Every call names one explicitly rather than relying on the configured default.
 */
export type AuthMode = 'apiKey' | 'userPool'

export interface Subscription {
    unsubscribe: () => void
}

/**
 * Amplify types `graphql()` against generated operation types we do not use, so
 * its signature rejects a plain variables record. Narrowing the client to the
 * shape actually called keeps that single cast here rather than at every caller.
 */
interface GraphqlClient {
    graphql: (options: {
        query: string
        variables: Record<string, unknown>
        authMode: AuthMode
    }) => unknown
}

function client(): GraphqlClient {
    return generateClient() as unknown as GraphqlClient
}

/**
 * Single entry point for GraphQL calls.
 *
 * Callers pass the shape they expect and get it back typed, which keeps the
 * `as { data: ... }` cast in one place instead of repeated at every call site.
 */
export async function graphqlRequest<TData>(
    query: string,
    variables: Record<string, unknown>,
    authMode: AuthMode
): Promise<TData> {
    const response = (await client().graphql({ query, variables, authMode })) as {
        data: TData
    }

    return response.data
}

/**
 * Subscriptions return an Observable rather than a Promise, which the Amplify
 * types do not express — the cast is contained here so components never need it.
 */
export function graphqlSubscribe<TData>(
    query: string,
    variables: Record<string, unknown>,
    authMode: AuthMode,
    handlers: { next: (data: TData) => void; error?: (error: unknown) => void }
): Subscription {
    const observable = client().graphql({ query, variables, authMode }) as {
        subscribe: (handlers: {
            next: (payload: { data?: TData }) => void
            error?: (error: unknown) => void
        }) => Subscription
    }

    return observable.subscribe({
        next: ({ data }) => {
            if (data) handlers.next(data)
        },
        error: handlers.error,
    })
}

/**
 * AppSync surfaces a resolver's `$util.error(message, type)` as a typed GraphQL
 * error. Reading the type lets the UI distinguish "already voted" from "poll
 * closed" from a plain network failure.
 */
export function graphqlErrorType(error: unknown): string | undefined {
    return (error as { errors?: { errorType?: string }[] } | null)?.errors?.[0]
        ?.errorType
}
