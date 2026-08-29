# LivePoll — Frontend

React + TypeScript + Vite client for LivePoll. Hosts sign in to create and manage
polls; voters open a shared link and vote anonymously, with results updating live
over GraphQL subscriptions.

For the AWS architecture, GraphQL schema, security model and deployment, see the
[main README](../backend/README.md). This document covers working *in* this package.

---

## Getting Started

```bash
npm install
npm run dev
```

The app expects a deployed backend. `src/config/amplify.ts` holds the AppSync
endpoint, API key and Cognito pool IDs — these come from the CDK stack outputs
after `cdk deploy` (see the main README).

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Watch mode |
| `npm run lint` | ESLint |
| `npm run preview` | Serve the production build locally |

---

## Architecture

Feature-first: each product area owns its components, its GraphQL documents and
its logic. Adding a feature means adding a folder, not editing five shared ones.

```
src/
├── App.tsx                  # routes + error boundary
├── main.tsx                 # Amplify config, router mount
├── config/amplify.ts
├── features/
│   ├── polls/               # CreatePoll, PollView, pollsApi, voterId
│   ├── dashboard/           # Dashboard, dashboardApi
│   └── analytics/           # Analytics, analyticsApi, pollAnalytics, exportResults
├── shared/
│   ├── api/graphqlClient.ts # the only file that imports Amplify
│   ├── components/          # Toast, ErrorBoundary, NotFound
│   ├── lib/errorLogging.ts
│   ├── types/poll.ts        # domain types
│   └── styles/index.css     # design tokens + component classes
└── test/setup.ts
```

### Conventions

These are what stop the structure decaying back into a flat pile:

- **Only `shared/api/graphqlClient.ts` imports Amplify.** Components call named
  functions — `createPoll({ ... })`, `listMyPolls()` — and never assemble GraphQL
  or cast responses. The `as { data: ... }` cast exists in exactly one place.
- **GraphQL documents live in the feature's `*Api.ts`.** When they were inline in
  components, `getPoll` drifted into two versions with different selection sets.
- **Domain types are declared once** in `shared/types/poll.ts`. Features narrow
  them with `Pick<>` rather than redeclaring their own shapes.
- **`shared/` is only for what two or more features need.** Single-feature code
  stays in that feature, however tempting it is to promote early.
- **Tests live in `__tests__/` beside the code they cover.**

### Adding a feature

1. `src/features/<name>/` with the component and a `<name>Api.ts`
2. API functions call `graphqlRequest<T>()` / `graphqlSubscribe<T>()`
3. Route in `App.tsx` — wrap in `<Authenticator>` if host-only
4. Tests in `__tests__/`

---

## Data Flow

```
Component  →  features/<x>/<x>Api.ts  →  shared/api/graphqlClient.ts  →  AppSync
```

Two auth modes, always named explicitly at the call site:

- **`apiKey`** — anonymous voter paths (`getPoll`, `submitVote`, vote subscription)
- **`userPool`** — host-only paths (`createPoll`, `closePoll`, `listMyPolls`,
  `listPollVotes`)

Host-only routes are wrapped in Amplify's `<Authenticator>` in `App.tsx`, but that
is only a UI gate — the real enforcement is in the AppSync resolvers.

`graphqlErrorType(error)` reads the typed error AppSync returns from a resolver's
`$util.error(message, type)`, which is how the UI distinguishes `AlreadyVoted`
from `PollClosed` from a plain network failure.

---

## Design System

"Minimalist Monochrome" — pure black/white, zero border-radius, instant 100ms
state changes instead of shadows or gradients.

Tokens and component classes live in `shared/styles/index.css`. **Use the classes
rather than inline styles**: `:hover`, `:focus-visible`, `:active` and media
queries do not exist in inline styles, which is why hover was once faked with JS
mouse handlers — and keyboard users got no feedback at all.

| Class | Use |
|---|---|
| `.page`, `.page-header` | Page shell |
| `.btn` + `.btn-primary` / `.btn-ghost` / `.btn-option` / `.btn-link` / `.btn-icon` | Buttons |
| `.field`, `.field-lg`, `.field-row`, `.field-group` | Form inputs |
| `.card`, `.card-title`, `.card-footer`, `.badge` | Dashboard rows |
| `.result-row`, `.result-track`, `.result-fill` | Vote bars |
| `.stat-grid`, `.chart`, `.chart-bar` | Analytics |
| `.skeleton`, `.empty-state`, `.toast`, `.chip` | States and misc |

Spacing and type come from CSS custom properties (`--space-*`, `--text-*`), so
one-off inline styles should reference tokens — `var(--space-4)` — not raw values.

### Accessibility

- Every interactive element has a visible `:focus-visible` outline
- Result bars are `role="meter"` with live values; errors are `role="alert"`
- Icon buttons are 44×44 minimum
- All motion is wrapped in `prefers-reduced-motion`

---

## Testing

Vitest + React Testing Library, jsdom environment. **Amplify is mocked** — no test
touches AWS.

```bash
npm test
```

Mock the module, not the component:

```tsx
const { graphqlMock } = vi.hoisted(() => ({ graphqlMock: vi.fn() }))

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({ graphql: graphqlMock }),
}))
```

`vi.hoisted` matters — `vi.mock` is hoisted above imports, so a plain `const`
would be in its temporal dead zone when the factory runs.

Guidelines:

- **Query by role, label or text** — never by class or style, so the suite
  survives visual refactors. It survived the design-system and feature-first
  refactors unchanged, which is the point.
- **Test pure logic directly.** `pollAnalytics` and `exportResults` are plain
  functions, so edge cases (CSV escaping, empty buckets, clock skew) are cheap to
  cover without rendering anything.
- Components that render routes need a `<MemoryRouter>`.

---

## Notable Implementation Details

- **`voterId.ts`** generates a UUID in `localStorage` so the backend can reject a
  second vote on the same poll. Clearing storage or switching browser defeats it
  — deliberately imperfect, documented in the main README's security section.
- **Countdowns close the poll locally** the moment the deadline passes rather than
  waiting up to five minutes for the backend sweep. The backend rejects those
  votes regardless; this just keeps the UI honest.
- **`errorLogging.ts`** is a single funnel for unexpected errors — console-only
  today, with no third-party dependency. Wiring up Sentry later means editing one
  function, not every call site.
- **No charting library.** The visual language is flat black rectangles, so the
  analytics bars are CSS `div`s with an `aria-label` describing the series.
