<div align="center">

# 🧡 Code Ferret

### AI code review on every pull request — automatically.

Code Ferret reads your diff, pulls the surrounding code from your repository with vector search, and posts **one markdown review** as a comment on the pull request — plus a full history in your dashboard.

Built with **Next.js 16 · Prisma 7 · Inngest · Pinecone · OpenRouter · Polar.sh · better-auth**

[Features](#-features) · [How It Works](#-how-it-works-deep-dive) · [Architecture](#-system-architecture) · [Screenshots](#-screenshots) · [Real-Life Usage](#-real-life-usage) · [Quick Start](#-quick-start)

</div>

---

## ✨ What is Code Ferret?

Code Ferret is a **GitHub App + web dashboard** that reviews every pull request in your repositories the moment it is opened. Instead of a naive "paste the diff into an LLM" approach, it:

1. **Verifies and persists** the webhook (HMAC signature check → PostgreSQL row).
2. **Chunks the diff** into 80-line review windows.
3. **Embeds the chunks into Pinecone** (per-PR vector namespace) so the AI can semantically retrieve the most relevant parts of large diffs instead of blowing the context window.
4. **Optionally retrieves repo-wide context** — if you synced your codebase, the reviewer can see how the changed code relates to the rest of the repository.
5. **Generates a structured review** (Correctness, Security, Performance, Reliability, Readability, Maintainability) via OpenRouter.
6. **Posts one markdown comment** back to the PR and archives it in your dashboard.
7. **Runs asynchronously** on Inngest with durable, resumable, step-by-step execution — a serverless function timeout never kills a review halfway.

---

## 📸 Screenshots

| Landing Page | Dashboard |
| :-: | :-: |
| ![Landing page](ss/Main.png) | ![Dashboard](ss/Dashboard.png) |

| GitHub Connect | Repositories |
| :-: | :-: |
| ![GitHub Connect](ss/Github%20Connect.png) | ![Repositories](ss/Repos.png) |

| Pull Requests | Settings |
| :-: | :-: |
| ![Pull Requests](ss/Pull%20Requests.png) | ![Settings](ss/Settings.png) |

---

## 🚀 Features

- **Automated PR reviews** — triggered by `pull_request` webhooks (`opened`, `synchronize`, `reopened`); every push to a PR gets a fresh review of the new diff.
- **Vector-grounded AI reviews** — diffs are chunked and embedded into per-PR Pinecone namespaces; the reviewer retrieves the top-10 most relevant chunks rather than guessing from a truncated diff.
- **Full-codebase sync (optional)** — index up to 200 source files per repo so the AI can reference related code elsewhere in the repository when reviewing.
- **One clean comment** — reviews are posted as a single markdown PR comment (no comment spam), and mirrored to the dashboard with Shiki syntax highlighting.
- **GitHub App auth** — install on only the repos you choose; scoped installation tokens, HMAC-verified webhooks, install survives sign-in.
- **Durable background jobs** — Inngest steps with retries and a 10s vector-indexing wait; every pipeline stage is observable and resumable.
- **Billing with Polar.sh** — Free (5 reviews/month) vs Pro (unlimited) plans, hosted checkout, customer portal, and a live usage meter in Settings.
- **Dashboard** — repo list with sync controls and infinite scroll, PR review history with status tabs, activity feed, repo summary (languages, public/private counts), and per-PR review detail pages.
- **Dark-mode-ready UI** — Tailwind CSS 4, shadcn-style components, Base UI, Streamdown markdown rendering.

---

## 🧠 How It Works (Deep Dive)

### 1. Chunking — turning a diff into review-sized pieces

Diffs can be huge. Feeding a 5,000-line diff into an LLM truncates silently and loses context. Code Ferret slides a **fixed 80-line window** over each file patch (`features/reviews/utils/chunk-code.ts`):

```
patch lines:  [0..79] [80..159] [160..239] ...
chunk id:     pr-42--src/auth.ts--part-0, part-1, ...
```

Blank slices are skipped (the Pinecone documents API rejects empty fields, and one empty chunk would fail the entire upsert).

### 2. Vector retrieval — the AI "reads" the right code

Each chunk is upserted to a **per-PR Pinecone namespace** (`owner--repo--pr-42`) via the Documents API in batches of 90, with `llama-text-embed-v2` handling embeddings:

```
owner/repo --pr-42          ← chunks of THIS diff
owner/repo --codebase       ← optional whole-repo index (from "Sync codebase")
```

After upsert, the function waits **10 seconds** for Pinecone indexing, then searches the PR namespace with the PR **title as the semantic query** — retrieving the top-10 chunks most related to what the PR claims to do. If the repo is synced, it also searches the repo-wide namespace and passes "Related code from the repository" into the prompt. This is what lets the reviewer spot, e.g., that a changed function is called elsewhere with different assumptions.

### 3. Review generation — structured, not vibes

`generateText` (Vercel AI SDK) calls an OpenRouter model with a strict system prompt. The output format is always:

```markdown
<one-line summary>

### ✅ What looks good
### ⚠️ Suggestions
### 🚨 Issues
```

The same prompt is passed repo name, PR title, retrieved PR chunks, and optional repo context — so it reviews *your* code, in *your* conventions.

### 4. Durable execution — why Inngest

The pipeline is a chain of **steps**, each individually retried:

```
mark-processing → breakdown-code → save-vectors-to-pinecone
   → [sleep 10s] → search-repo-context → generate-ai-review
   → post-pr-comment → mark-reviewed
```

If the OpenRouter call fails at step 5, Inngest re-runs *only* the failed step with the same event data — the webhook handler already returned `200` to GitHub long before. No reviews are lost to cold starts or timeouts.

---

## 🗺️ System Architecture

```mermaid
flowchart LR
    subgraph GitHub
        GH[GitHub App] -->|pull_request webhook| WH
        PR[(Pull Request)] ---|comment posted| GH
    end

    subgraph "Next.js 16 (Vercel)"
        WH["POST /api/github/webhook<br/>HMAC verify"]
        IN["POST /api/inngest<br/>serve()"]
        DASH[Dashboard<br/>/dashboard/*]
    end

    subgraph "Background (Inngest)"
        RF["review-pull-request"]
        SF["sync-repo-codebase"]
    end

    subgraph Data
        PG[(PostgreSQL<br/>Prisma 7)]
        PC[(Pinecone<br/>vector index)]
    end

    subgraph External
        AI[OpenRouter<br/>generateText]
        PO[Polar.sh<br/>billing]
    end

    WH -->|github/pr.received| IN --> RF
    DASH -->|"repo/sync.requested"| IN --> SF
    RF --> PG & PC & AI & GH
    SF --> PG & PC
    WH --> PG
    DASH --> PG
    PO -->|webhook| PG
```

### End-to-end PR review sequence

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer
    participant GH as GitHub
    participant WH as Webhook Route
    participant PG as PostgreSQL
    participant IN as Inngest
    participant FN as review-pull-request
    participant PC as Pinecone
    participant AI as OpenRouter

    Dev->>GH: Open / push a pull request
    GH->>WH: POST /api/github/webhook (pull_request, HMAC-signed)
    WH->>WH: Verify x-hub-signature-256
    WH->>PG: Upsert PullRequest (status: pending)
    WH->>IN: send("github/pr.received")
    WH-->>GH: 200 OK (fast — GitHub never waits)

    IN->>FN: Run review-pull-request
    FN->>PG: mark-processing
    FN->>GH: GET /pulls/:n/files (installation token)
    FN->>FN: Chunk patches (80-line windows)
    FN->>PC: Upsert chunks → namespace owner--repo--pr-N
    FN->>FN: sleep 10s (wait for indexing)
    FN->>PC: Search PR namespace (query = PR title, top 10)
    opt Repo is synced
        FN->>PC: Search codebase namespace
    end
    FN->>AI: generateText(system + retrieved chunks)
    AI-->>FN: Structured markdown review
    FN->>GH: POST comment on the PR
    FN->>PG: mark-reviewed (save reviewComment)
```

### GitHub App installation flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant D as Dashboard
    participant P as proxy.ts
    participant CB as /api/github/callback
    participant GH as GitHub
    participant PG as PostgreSQL

    U->>D: Click "Connect GitHub"
    D->>GH: Redirect to /apps/{APP_NAME}/installations/new?state=userId
    U->>GH: Choose repositories → Install
    GH->>CB: Redirect with installation_id
    CB->>CB: Session check (survives sign-in redirect)
    CB->>GH: GET /app/installations/:id (resolve account)
    CB->>PG: Upsert GithubInstallation (1:1 with User)
    CB-->>U: Redirect to /dashboard/github ✓
```

`proxy.ts` (Next.js 16's replacement for `middleware.ts`) guards `/dashboard/*` and bounces signed-in users off `/sign-in`, round-tripping a `callbackUrl` — which is also how an interrupted GitHub App install resumes after sign-in.

### Billing flow (Polar.sh)

```mermaid
flowchart TD
    U[User] -->|Upgrade| CO[Hosted Polar Checkout]
    CO -->|subscription.active| WH[/api/polar/webhook/]
    WH -->|syncSubscription| DB[(User.plan = "pro")]
    DB --> G{canUserReview?}
    G -->|free: used < 5| OK[Allow review]
    G -->|free: used ≥ 5| LIM[Rate limited]
    G -->|pro| OK2[Unlimited reviews]
    WH -->|subscription.paused / revoked| DB2[(User.plan = "free")]
```

Subscription state is **mirrored onto the `User` row** by the Polar webhook (customer created/updated, active, cycled, canceled, past due, paused, revoked) — the dashboard reads plan/usage straight from Postgres, never calling the Polar API on page load. Canceled Pro keeps access until `current_period_end`.

> **Note:** `FREE_MONTHLY_LIMIT = 5` and `canUserReview()` (`features/billing/server/usage.ts`) drive the Settings usage meter and landing-page copy; enforcement of the limit inside the review pipeline is scaffolded but not yet wired in — see [Roadmap](#-roadmap).

---

## 🗂️ Data Model (Prisma 7 · PostgreSQL)

```mermaid
erDiagram
    USER ||--o| GITHUB_INSTALLATION : "installs"
    USER ||--o{ PULL_REQUEST : "reviews via installation"
    USER ||--o{ REPO_SYNC : "syncs"
    USER ||--o{ SESSION : "has"
    USER ||--o{ ACCOUNT : "has"

    USER {
        string id PK
        string plan "free | pro"
        string polarCustomerId
        string subscriptionStatus
    }
    GITHUB_INSTALLATION {
        int installationId
        string accountLogin
        string accountType
    }
    PULL_REQUEST {
        string repoFullName
        int prNumber
        string headSha
        string status "pending|processing|reviewed|rate_limited"
        string reviewComment "markdown"
    }
    REPO_SYNC {
        string repoFullName
        string branch
        string status "pending|syncing|synced|failed"
        int chunkCount
    }
```

- **`PullRequest`** is unique on `[repoFullName, prNumber]` — a re-run of the webhook upserts rather than duplicating.
- **`RepoSync`** is unique on `[repoFullName]` and tracks `chunkCount` + `syncedAt` for the codebase index.
- Vector data lives in Pinecone, namespaced per PR and per repo — Postgres only stores the pointers.

---

## 🗃️ Project Structure

```
codeferret/
├── app/
│   ├── (auth)/sign-in/          # GitHub sign-in
│   ├── (protected)/dashboard/   # overview, github, repos, pull-requests/[id], settings
│   └── api/
│       ├── github/webhook/      # PR webhook entry (HMAC verified)
│       ├── github/callback/     # App installation callback
│       ├── github/repos/        # Paginated installation repos
│       ├── inngest/             # serve() — all background functions
│       ├── polar/webhook/       # Subscription sync
│       └── auth/[...all]/       # better-auth catch-all
├── features/                    # feature-sliced modules
│   ├── github/                  # App client, webhook handler, installations, repos
│   ├── reviews/                 # PR pipeline: files → chunk → vectors → AI → comment
│   ├── repo-sync/               # Whole-codebase indexing pipeline + sync button
│   ├── billing/                 # Polar client, checkout, portal, usage limits
│   ├── auth/                    # Sign-in actions, session guards, proxy logic
│   ├── ai/                      # OpenRouter provider
│   ├── pinecone/ · inngest/     # Clients
│   └── overview/ dashboard/ pull-requests/ settings/   # Dashboard data + UI
├── lib/                         # auth, db (Prisma), billing helpers, utils
├── prisma/                      # schema + migrations
├── proxy.ts                     # Next.js 16 middleware successor (route guards)
└── ss/                          # README screenshots
```

---

## 🧰 Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16.2.9** (App Router, `proxy.ts`, RSC) + **React 19.2.4** |
| Database | **PostgreSQL** (Neon) via **Prisma 7** + `@prisma/adapter-pg` |
| Background jobs | **Inngest** — durable, step-wise, retried pipelines |
| Vectors | **Pinecone** Documents API (`llama-text-embed-v2` embeddings) |
| AI | **Vercel AI SDK** `generateText` → **OpenRouter** models |
| GitHub | **Octokit** GitHub App (`App`, installation tokens, webhooks) |
| Auth | **better-auth** (GitHub OAuth, Prisma adapter, `nextCookies`) |
| Billing | **Polar.sh** (hosted checkout, portal, webhooks) |
| UI | Tailwind CSS 4, shadcn-style components, Base UI, TanStack Query 5, Streamdown + Shiki, Recharts, sonner |

---

## 🌍 Real-Life Usage

**OSS maintainers drowning in drive-by PRs.** A weekend project with 40 open PRs gets consistent first-pass reviews — naming, edge cases, security footguns — before a human ever looks. The maintainer only spends attention on the "🚨 Issues" section.

**Startups without a senior reviewer on every timezone.** A PR opened at 2 AM in Tokyo gets a structured review instantly, and the on-call senior wakes up to an already-triaged diff instead of a blank page.

**Codebase-aware reviews, not just diff-grepping.** With repo sync enabled, changing `serializeUser()` gets reviewed against *every call site* in the repository — the AI can flag that a return-type change breaks a consumer three files away.

**Onboarding and code-quality education.** Junior developers see the same six-axis checklist (Correctness, Security, Performance, Reliability, Readability, Maintainability) applied to their own code on every PR — a quiet, always-available mentor that teaches the team's standards.

**Security sweep on dependency/auth PRs.** Security-sensitive changes (auth, input validation, crypto) get a dedicated security lens — injection risks, exposed secrets, unsafe deserialization — without adding a reviewer to every PR.

**Agency / client work audit trail.** Every review is archived in the dashboard with the full markdown, so there's a permanent record of what was reviewed, when, and what was flagged — useful for compliance conversations.

---

## ⚡ Quick Start

### Prerequisites

- Node 20+ (or Bun), a PostgreSQL database (e.g. Neon), and accounts for GitHub Apps, Inngest, Pinecone, OpenRouter, and Polar.

### 1. Clone & install

```bash
git clone https://github.com/<you>/codeferret.git
cd codeferret
bun install   # or npm install
```

### 2. Environment variables

Create a `.env` (there is no `.env.example` yet — copy this):

```bash
# Database
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
NODE_ENV="development"

# better-auth
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="generate-a-long-random-string"

# GitHub OAuth app (for sign-in)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# GitHub App (Settings → General → App ID / private keys; Webhooks → secret)
GITHUB_APP_ID=""
GITHUB_APP_NAME="code-ferret-ai-code-reviewer"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_WEBHOOK_SECRET=""

# AI
OPENROUTER_API_KEY=""

# Pinecone (one serverless index; the documents API handles embeddings)
PINECONE_API_KEY=""
PINECONE_INDEX="codeferret"

# Polar.sh (Settings → API keys; product ID for the Pro plan)
POLAR_ACCESS_TOKEN=""
POLAR_PRO_PRODUCT_ID=""
POLAR_SERVER="sandbox"          # or "production"
POLAR_WEBHOOK_SECRET=""

# Background jobs
INNGEST_DEV=1
```

> ⚠️ **Security:** `.env*` and `*.pem` are gitignored — keep it that way. If you ever commit a GitHub App private key (the repo root has contained a `.pem` before), **rotate it in the GitHub App settings immediately** and purge it from git history.

### 3. Create the GitHub App

GitHub → Settings → Developer settings → **GitHub Apps → New GitHub App**:

- **Webhook URL:** `https://<your-tunnel>/api/github/webhook` (use [ngrok](https://ngrok.com) locally — `next.config.ts` already allows the ngrok dev origin)
- **Webhook secret:** matches `GITHUB_WEBHOOK_SECRET`
- **Permissions:** Pull requests (Read & Write — to post the comment), Contents (Read — to fetch diffs and sync code), Metadata (Read)
- **Subscribe to events:** `Pull request`
- **Where can this app be installed?** Any account
- Generate a **private key** (→ `GITHUB_APP_PRIVATE_KEY`) and copy the App ID (→ `GITHUB_APP_ID`)

### 4. Pinecone & OpenRouter

- Create a **serverless index** in Pinecone (any region; default `llama-text-embed-v2` via the Documents API) and set its name to `PINECONE_INDEX`.
- Create an OpenRouter API key (the code uses the `openrouter/free` router alias by default — set another model in `features/reviews/server/generate-review.ts` if you prefer).

### 5. Run it

```bash
bun prisma migrate dev   # create tables
bun run dev              # Next.js + Inngest dev mode on http://localhost:3000
```

Open `http://localhost:3000`, sign in with GitHub, install the App on a test repo, and open a PR. Watch the Inngest dev server for the `review-pull-request` run, then see the comment on your PR and in `/dashboard/pull-requests`.

### Deploy

Push to **Vercel**, set the same env vars (minus `INNGEST_DEV`), point the GitHub App webhook and Polar webhook (`/api/polar/webhook`) at your production domain, and connect your Inngest account. `bun run build` runs `prisma generate` automatically.

---

## 🧭 Roadmap

- Wire `canUserReview()` into the webhook/review pipeline to enforce the Free 5-reviews/month limit (currently display-only) and write the reserved `rate_limited` PR status.
- Per-line review comments (suggested changes) instead of one top-level comment.
- Review on `pull_request_review` and draft-PR filtering; repo-level sync scheduling.
- Team/org accounts and per-repo review configuration (checklist toggles per repository).

---

## 📄 License

MIT — do whatever brings you joy, but attribution is appreciated.

<div align="center">
Made with 🧡 by a ferret who reads diffs for a living.
</div>
