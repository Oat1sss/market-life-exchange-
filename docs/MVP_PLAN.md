# MarketLife — MVP Implementation Plan

Requirement from the brief: do not build the whole project in one pass. Each task below is independently shippable and ends with a green check. Phase numbers follow the brief.

## Phase 1 — Repository audit (done)

Result: the working directory is empty (no git repo, no `package.json`). Toolchain: Node 26.13, npm 11.20, git 2.56. **PostgreSQL and Docker are not installed on this machine**, so database-backed work needs a reachable `DATABASE_URL` (local install of Postgres 16 or a managed instance) before Phase 4 completes. Domain-only work (Phases 2–3, and the money/RNG/calendar core) is testable without a database.

## Phase 2–3 — Design (done in this pass)

- `docs/ARCHITECTURE.md` — layering, clocks, market model, transaction model.
- `docs/GAME_DESIGN.md` — identity, loop, systems, MVP event/achievement lists.
- `docs/DATABASE.md` — Prisma/Postgres schema proposal and transaction flows.

## Task 1 (executed in this pass) — Foundation: scaffold + integer money + deterministic RNG

Scope, deliberately small:

1. Next.js (App Router) + TypeScript + Tailwind + ESLint scaffold, with Vitest configured.
2. `src/domain/money.ts`: a `Money` value object over `bigint` minor units with checked arithmetic, fee math, percentage/P&L math, and display formatting.
3. `src/domain/rng.ts`: seeded, stateless-hash PRNG (`HMAC`-style derivation over seed/tick/label) with Gaussian sampling, so market history is reproducible.
4. Unit tests for both, including the invariants from ARCHITECTURE §6.

Verification: `npm test` green, `npm run build` succeeds, `npx tsc --noEmit` clean.

Explicitly **not** in Task 1: Prisma models, auth, pages beyond the placeholder, trading, ticking.

## Task 2 — Prisma schema + first migration + seed

- Translate `docs/DATABASE.md` into `prisma/schema.prisma` with enums, uniques, checks and indexes.
- `prisma migrate dev --name init` against a real database; add the partial unique index for one active game per user via a SQL migration.
- Seed the 5 assets and achievement definitions.
- Acceptance: `prisma migrate reset && prisma db seed` succeeds; `prisma validate` clean; a smoke test reads seeded assets.

## Task 3 — Auth.js credentials + registration/login

- Auth.js v5 credentials provider, Argon2id hashes, Zod-validated register/login forms, session-scoped helpers.
- Middleware protecting `/play/*`.
- Tests: hash/verify roundtrip, duplicate email rejection, unauthenticated redirect.

## Task 4 — Character creation + game creation

- `/play/new` form (name + background), server action creating `game`, `character`, `portfolio`, `expense_rules`, first `price_points` in **one transaction**.
- Acceptance: new user reaches the dashboard with 240,000 minor units and 5 seeded prices.

## Task 5 — Dashboard + advance-tick service

- Dashboard reads: date, age, stats, cash, net worth, headline, month report.
- `advance` mutation with game-row lock, one-month increment, price generation, salary + expense ledger entries, age/stat drift.
- Idempotent advance key; rejecting a second advance for the same tick.
- Acceptance: balances stay consistent across 24 ticks; concurrent advance attempts produce one tick.

## Task 6 — Market page, order service, portfolio

- Market list + asset detail with price history; buy/sell forms (market + limit), resting limit resolution on advance.
- Ledger-backed trade history and realized P&L.
- Tests: insufficient funds rollback, duplicate idempotency key, oversell rejection, fee rounding, weighted average cost.
- Acceptance: buy → advance → portfolio value changes → sell → realized P&L correct.

## Task 7 — Life events, education, careers, achievements

- At least three events with server-resolved outcomes; pending-event gating of `advance`.
- Education enrollment with tuition debit + completion on tick; promotion rule; achievement unlocks.
- Tests for each rule and for idempotent unlocks.

## Phase 8 — QA pass

- Playwright acceptance spec covering the full MVP path plus refresh/logout persistence.
- Property-style tests for accounting invariants over randomized 100-tick simulations (seeded, so failures reproduce).
- Fix issues found; no skipped tests.

## Phase 9 — Visual/responsive polish

- Typography, dark mode, mobile layout, empty/error/shortfall states, accessible focus and labels.

## Phase 10 — Documentation

- `README.md`: local setup, env vars, migrations, seeding, test commands, deployment notes, known limitations.

## Risk register

| Risk | Mitigation |
|---|---|
| No local Postgres | Require `DATABASE_URL` early (Task 2); document managed-DB setup; keep domain tests DB-free. |
| Byte-size of Prisma BigInt in JSON | Serialize money as strings at the API boundary; never `JSON.stringify` a BigInt directly. |
| Time manipulation | No client-supplied ticks; monotonic increment under row lock. |
| Duplicate submits on slow mobile networks | Idempotency keys on every mutation, unique-constrained. |
| Drift between UI and server rules | All rules in `src/domain`, imported by services; UI receives computed results only. |
