# LivePoll — Real-Time Polling App

A full-stack, real-time polling application built on a serverless AWS backend. Hosts sign in, create a poll, and share a link — anyone can vote anonymously, and results update live on every connected screen with zero refreshes.

Built as a hands-on project to learn AWS infrastructure-as-code, serverless architecture, and real-time systems from the ground up.

**Status: Actively developed** — core product is fully working end-to-end; see [Roadmap](#roadmap) for what's next.

---

## Live Demo
`[Add deployed link here once live — see Roadmap]`

## Screenshots
`[Add screenshots of poll creation, voting, and live results here]`

---

## What It Does

- **Hosts sign in** (Cognito) and create a poll with a question and 2–6 options
- **Voters** open the shared link and vote — no account needed
- **Results update live** on every connected screen the instant a vote comes in, via GraphQL subscriptions over WebSocket
- **Hosts can close a poll** — once closed, voting is blocked for everyone, enforced at the database level, not just in the UI
- **Hosts get a dashboard** at `/dashboard` listing every poll they've created — status, vote totals, and creation date, with click-through to live results
- **Polls can expire on their own** — hosts optionally pick 15 minutes, 1 hour, or 24 hours at creation; voters see a live countdown, and voting stops the moment it hits zero
- **Hosts can duplicate a poll** from the dashboard, or start from a built-in template (Yes/No, Rate 1–5, multiple choice)
- **Per-poll analytics** — voters over time, time-to-first-vote, peak window and share of vote, visible only to the poll's host
- **Export results** as CSV, or copy a plain-text summary shaped for pasting into Slack
- Clean 404 handling for invalid/removed poll links, plus an app-wide error boundary
- Copy-link button for easy sharing
- Toast notifications for error states
- Skeleton loading states while data fetches

---

## Architecture

```
┌─────────────┐
│   React App  │  (TypeScript, Vite, React Router, Amplify UI)
└─────────────┘
       │
       │ GraphQL queries / mutations / subscriptions (Amplify client)
       ▼
┌────────────────────────────────────────────────────────┐
│                    AWS AppSync                         │
│   Mixed auth: API Key (anonymous voters)               │
│              + Cognito User Pools (authenticated hosts)│
│                                                        │
│   Query:        getPoll                                │
│                 listMyPolls    (Cognito only)          │
│                 listPollVotes  (Cognito + ownership)   │
│   Mutation:     createPoll   (Cognito only)            │
│                 submitVote   (open polls, one per voter)│
│                 closePoll    (Cognito + ownership check)│
│   Subscription: onVoteUpdate (auto-fires on submitVote)│
└────────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────┐        ┌──────────────────────┐
│   DynamoDB       │        │   Cognito User Pool  │
│  Polls + Votes   │        │ (host authentication)│
└──────────────────┘        └──────────────────────┘
       ▲
       │ UpdateItem (status → "closed")
┌──────────────────────────────┐
│  Lambda: closeExpiredPolls   │ ◀── EventBridge, every 5 min
└──────────────────────────────┘
```

**No Lambda sits in the request path** — every resolver is a **direct AppSync-to-DynamoDB resolver** written in VTL (Velocity Template Language). This keeps the API fast (no cold starts) and was a deliberate choice to get hands-on with resolver mapping templates directly, rather than defaulting to Lambda for everything.

The one Lambda in the project closes expired polls on a schedule. That is a background job with no incoming request to attach a resolver to, which is what Lambda is actually for — it is not an exception to the rule above, since no user request ever invokes it.

`submitVote` is a **pipeline resolver** rather than a unit resolver: a single VTL resolver can only touch one table, and one vote needs two writes — claim the voter's slot in `Votes`, then increment the counts in `Polls`. Still no Lambda involved.

---

## AWS Services Used

| Service | Purpose |
|---|---|
| **AWS AppSync** | GraphQL API — queries, mutations, and real-time subscriptions over WebSocket |
| **Amazon DynamoDB** | Stores polls (question, options, vote counts, status, host) |
| **Amazon Cognito** | Host authentication (sign-up, sign-in, email verification) |
| **AWS CDK** | All infrastructure defined and deployed as code (TypeScript) |
| **AWS IAM** | Permissions between AppSync, DynamoDB, and Cognito |
| **Amazon S3 + CloudFront** | Static hosting and CDN delivery for the built React app |
| **GitHub Actions + IAM OIDC** | CI/CD — deploys on push using short-lived federated credentials, no stored AWS keys |
| **AWS Lambda** | One scheduled function that closes polls past their expiry — the only Lambda in the project |
| **Amazon EventBridge** | Fires that function every 5 minutes |

Two of the five resolvers are **pipeline resolvers** rather than unit resolvers, because each needs two steps against different tables:

| Field | Step 1 | Step 2 |
|---|---|---|
| `Mutation.submitVote` | Claim the voter's slot in `Votes` (conditional put) | Increment counts in `Polls` |
| `Query.listPollVotes` | Load the poll and reject anyone who is not its host | Query that poll's votes by time |

---

## Security Model

This was one of the more interesting parts of the project to get right — enforcement happens at the **database layer**, not just the UI:

- **`createPoll`** requires a valid Cognito session (`@aws_cognito_user_pools` on the schema field). Anonymous API-key requests are rejected outright.
- **`closePoll`** uses a DynamoDB **conditional write** — comparing the poll's stored `hostId` against the caller's Cognito identity (`$ctx.identity.sub`). If they don't match, DynamoDB itself rejects the write with a `ConditionalCheckFailedException`, regardless of what the frontend shows or hides.
- **`submitVote`** uses a similar conditional write checking the poll's `status` — votes are only accepted while a poll is `"open"`. A closed poll rejects new votes at the database level even if someone calls the API directly, bypassing the UI entirely.
- **One vote per voter** — `submitVote` is a pipeline resolver: it first writes a `pollId#voterId` record to the `Votes` table with `attribute_not_exists(voteId)`, so a repeat vote fails the conditional write and never reaches the counter. The `voterId` is a random UUID the browser stores in `localStorage`. **This is deliberately imperfect**: clearing storage, opening a private window, or using another browser produces a new id and allows another vote. It raises the cost of casual ballot-stuffing; it is not identity verification. Doing this properly would mean requiring accounts for voters, which would cost the frictionless anonymous voting the app is built around.
- **Expiry is enforced by the database, not the sweep.** `submitVote`'s conditional write also checks `expiresAt`, so an expired poll rejects votes the instant it expires. The scheduled Lambda only updates the stored `status` so it reflects reality — a poll is never votable during the gap before the sweep runs.
- **`getPoll`** and voting stay open to anonymous users via API key — no account required to participate in a poll.
- **`listPollVotes`** (analytics) is a pipeline resolver whose first step loads the poll and calls `$util.unauthorized()` unless `hostId` matches the caller — vote-level data is never readable by anyone but the host. A missing poll and someone else's poll return the *same* error, so the endpoint cannot be used to probe which poll IDs exist.
- **Analytics never exposes voter identity.** The `Vote` GraphQL type deliberately omits `voterId`, exposing only `option` and `createdAt`. Because one-vote-per-voter is enforced, the vote count already equals the unique-voter count, so voter identity is never needed — voters stay anonymous even to the host who created the poll.
- **`listMyPolls`** never accepts a `hostId` argument — the resolver derives it from `$ctx.identity.sub`, so a host cannot craft a request that returns someone else's polls.

This mixed-auth, condition-enforced pattern was more work than a single-auth-mode API, but it means the security is real rather than cosmetic — a motivated user inspecting the frontend code and calling the API directly still can't bypass the rules.

---

## Data Model (DynamoDB)

### `Polls` table
| Attribute | Type | Notes |
|---|---|---|
| `pollId` (PK) | String | UUID, auto-generated by AppSync |
| `hostId` | String | Cognito user ID (`$ctx.identity.sub`) of the creator |
| `question` | String | |
| `options` | List | e.g. `["Red", "Blue", "Green"]` |
| `voteCounts` | Map (AWSJSON) | e.g. `{"Red": 3, "Blue": 1}`, updated via atomic `ADD` |
| `status` | String | `"open"` \| `"closed"` |
| `createdAt` | Number | Unix timestamp |
| `expiresAt` | Number | Optional — Unix timestamp after which voting is refused |

**Global secondary index — `hostId-index`**

| Key | Attribute | Purpose |
|---|---|---|
| Partition | `hostId` | Fetch one host's polls without scanning the table |
| Sort | `createdAt` | Returns newest-first via `scanIndexForward: false` |

**Global secondary index — `status-expiresAt-index`** (sparse)

| Key | Attribute | Purpose |
|---|---|---|
| Partition | `status` | Narrow the sweep to open polls |
| Sort | `expiresAt` | Range-query only the ones already past due |

DynamoDB only indexes items that have *both* key attributes, so polls created without an expiry never enter this index at all — the scheduled sweep reads just the handful of polls that can actually expire, never the whole table.

### `Votes` table
One record per voter per poll — the conditional write against this table is what enforces one-vote-per-voter.

| Attribute | Type | Notes |
|---|---|---|
| `voteId` (PK) | String | Composite `pollId#voterId` |
| `pollId` | String | |
| `voterId` | String | Random UUID from the voter's `localStorage` |
| `option` | String | Which option they picked |
| `createdAt` | Number | Unix timestamp |

**Global secondary index — `pollId-createdAt-index`**

| Key | Attribute | Purpose |
|---|---|---|
| Partition | `pollId` | Read one poll's votes without scanning the table |
| Sort | `createdAt` | Returns them in time order, which is what the analytics timeline needs |

---

## GraphQL Schema (summary)

```graphql
type Poll @aws_api_key @aws_cognito_user_pools {
  pollId: ID!
  hostId: String!
  question: String!
  options: [String!]!
  voteCounts: AWSJSON!
  status: String!
  createdAt: AWSTimestamp!
  expiresAt: AWSTimestamp
}

# No voterId: vote count already equals unique voters, so analytics
# never needs voter identity. Voters stay anonymous even to the host.
type Vote @aws_cognito_user_pools {
  option: String!
  createdAt: AWSTimestamp!
}

type Query {
  getPoll(pollId: ID!): Poll
  listMyPolls: [Poll!]!
    @aws_cognito_user_pools
  listPollVotes(pollId: ID!): [Vote!]!
    @aws_cognito_user_pools
}

type Mutation {
  createPoll(question: String!, options: [String!]!, expiresAt: AWSTimestamp): Poll!
    @aws_cognito_user_pools
  submitVote(pollId: ID!, option: String!, voterId: String!): Poll!
  closePoll(pollId: ID!): Poll!
    @aws_cognito_user_pools
}

type Subscription {
  onVoteUpdate(pollId: ID!): Poll
    @aws_subscribe(mutations: ["submitVote"])
}
```

---

## Frontend

- **React + TypeScript**, built with **Vite**
- **React Router** for shareable poll URLs (`/poll/:pollId`)
- **AWS Amplify** client library for GraphQL queries/mutations/subscriptions
- **Amplify UI (`Authenticator`)** for host sign-up/sign-in, wrapping only the poll-creation route
- **Feature-first architecture** — see [Project Structure](#project-structure). Components are presentational; every network call goes through a feature API module, and only one file in the codebase imports Amplify
- Visual design follows a custom **Minimalist Monochrome** design system — pure black/white palette, Playfair Display serif headlines, sharp zero-radius corners, instant hover-state inversions instead of shadows or gradients. Tokens and component classes live in `shared/styles/index.css`, so colours and spacing are defined once rather than repeated as inline styles
- **Accessibility**: every interactive element has a visible `:focus-visible` state (hover was previously faked with JS mouse handlers, which gave keyboard users nothing), result bars expose `role="meter"` with live values, and motion respects `prefers-reduced-motion`

---

## Project Structure

```
livepoll/
├── backend/                      # AWS CDK project (infrastructure)
│   ├── bin/
│   ├── lib/
│   │   ├── backend-stack.ts      # DynamoDB, AppSync, Cognito, resolvers, sweep
│   │   └── frontend-stack.ts     # S3 + CloudFront hosting
│   ├── graphql/
│   │   └── schema.graphql
│   ├── resolvers/                # VTL mapping templates
│   │   ├── createPoll.{req,res}.vtl
│   │   ├── submitVote.{req,res}.vtl        # pipeline step 2
│   │   ├── recordVote.{req,res}.vtl        # pipeline step 1
│   │   ├── closePoll.{req,res}.vtl
│   │   ├── listMyPolls.{req,res}.vtl
│   │   ├── verifyPollOwner.{req,res}.vtl   # analytics pipeline step 1
│   │   └── listPollVotes.{req,res}.vtl     # analytics pipeline step 2
│   ├── lambda/
│   │   └── closeExpiredPolls.ts  # scheduled expiry sweep (the only Lambda)
│   └── test/
│       └── backend.test.ts       # CDK template assertions
├── frontend/                     # React app (feature-first architecture)
│   └── src/
│       ├── App.tsx               # routing + error boundary
│       ├── main.tsx
│       ├── config/
│       │   └── amplify.ts
│       ├── features/             # one folder per product area
│       │   ├── polls/            # CreatePoll, PollView, pollsApi, voterId
│       │   ├── dashboard/        # Dashboard, dashboardApi
│       │   └── analytics/        # Analytics, analyticsApi,
│       │                         #   pollAnalytics, exportResults
│       ├── shared/
│       │   ├── components/       # Toast, ErrorBoundary, NotFound
│       │   ├── api/              # graphqlClient.ts — the only Amplify caller
│       │   ├── lib/              # errorLogging.ts
│       │   ├── types/            # poll.ts — domain types
│       │   └── styles/           # index.css — design tokens + components
│       └── test/setup.ts
└── README.md
```

Each feature owns its components, its GraphQL documents and its logic; `__tests__/`
sits beside the code it covers. Adding a feature means adding a folder rather than
editing five shared ones.

**The rules that keep it honest:**

- **Only `shared/api/graphqlClient.ts` imports Amplify.** Everything else calls
  named functions like `createPoll({ ... })` or `listMyPolls()`, so components
  never assemble GraphQL or cast responses.
- **GraphQL documents live in the feature's `*Api.ts`.** They were previously
  inline in components, which let `getPoll` drift into two versions with
  different selection sets.
- **Domain types live once**, in `shared/types/poll.ts`; features narrow them
  with `Pick<>` instead of redeclaring their own shapes.
- **`shared/` is for things two or more features need.** One-feature code stays
  in that feature, however tempting it is to promote it early.

---

## Local Development

**Backend:**
```bash
cd backend
npm install
npx cdk deploy
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

You'll need to update `frontend/src/amplifyconfig.ts` with your own deployed AppSync API URL, API key, and Cognito User Pool details (printed as CDK outputs after `cdk deploy`).

---

## What This Project Demonstrates

- Serverless architecture on AWS without relying on Lambda for every operation — direct AppSync-to-DynamoDB resolvers written in VTL
- Real-time systems: GraphQL subscriptions over WebSocket, no manual connection-tracking table needed (AppSync manages this internally)
- Mixed authentication on a single API: Cognito for authenticated actions, anonymous API-key access for public actions
- Database-level authorization using DynamoDB conditional writes, not just UI-level restriction
- Infrastructure entirely as code via AWS CDK (TypeScript)
- Incremental, tested development — every feature was verified working before moving to the next (see commit history)

---

## Testing

**Backend** — Jest with `aws-cdk-lib/assertions`, asserting against the synthesized CloudFormation template:

```bash
cd backend
npm test
```

23 tests covering: DynamoDB key schemas and all three GSIs, AppSync mixed-auth configuration, every resolver wired to its field, both pipeline resolvers running their steps in the right order, the expiry Lambda and its 5-minute schedule, and — since the schema is inlined into the template — that `createPoll`, `closePoll`, `listMyPolls` and `listPollVotes` carry `@aws_cognito_user_pools` while `getPoll` and `submitVote` stay open to anonymous callers.

**Frontend** — Vitest + React Testing Library, with the Amplify GraphQL client mocked so no test touches AWS:

```bash
cd frontend
npm test          # single run
npm run test:watch
```

63 tests across seven suites:

| Suite | Covers |
|---|---|
| `CreatePoll` | Validation, add/remove options, templates, duplicate prefill, expiry selection, submission |
| `PollView` | Loading skeleton, 404, vote buttons, results, closed state, countdown, duplicate-vote and closed-poll rejections, subscription cleanup |
| `Dashboard` | Listing, empty state, load failure, duplication hand-off |
| `Analytics` | Summary stats, empty timeline, CSV download, clipboard summary, non-owner rejection |
| `pollAnalytics` | Bucketing edge cases, time-to-first-vote, duration formatting |
| `exportResults` | CSV escaping (commas, quotes, newlines), summary text, filename slugs |
| `ErrorBoundary` | Fallback render and structured error reporting |

Tests sit in `__tests__/` beside the code they cover. Pure logic (`pollAnalytics`,
`exportResults`) is tested directly rather than through the DOM, which is why the
tricky cases — CSV escaping, empty buckets, clock skew — are cheap to cover.

---

## Roadmap

- [ ] Embeddable read-only poll widget for other sites
- [ ] Host profile page with display name, password change and sign-out
- [ ] Custom domain + HTTPS certificate in front of CloudFront
- [ ] Infrastructure improvements: move hardcoded config values to environment variables / SSM Parameter Store

---

## Tech Stack Summary

**Frontend:** React, TypeScript, Vite, React Router, AWS Amplify, Amplify UI
**API:** AWS AppSync (GraphQL — queries, mutations, subscriptions)
**Database:** Amazon DynamoDB
**Auth:** Amazon Cognito (mixed with anonymous API-key access)
**Infrastructure:** AWS CDK (TypeScript)