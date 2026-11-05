# MarketLife — Architecture Proposal

Status: proposal for the MVP. Written after auditing an empty repository.

## 1. Guiding constraints

1. **The server is the only authority.** Prices, fills, income, expenses, life-event outcomes, ages and balances are computed server-side. The client sends intents ("buy 5 shares of NOVA with idempotency key K"), never outcomes.
2. **Money is integer minor units.** All authoritative amounts are `BIGINT` minor units (1/100 credit). No `number` arithmetic on balances, prices, or P&L. `Money` is a value object wrapping `bigint`.
3. **Every balance change is explainable.** Cash only moves through ledger entries written inside the same database transaction that moves the balance. `ledger_entries` is append-only.
4. **Determinism where it matters.** Market evolution is a pure function of `(seed, tick index, asset, prior state)`. Tests can replay a game exactly.
5. **Time is explicit.** Three clocks exist and never get mixed (see §4).

## 2. Layering

```
src/
  app/                  Next.js App Router: routes, layouts, pages
    (auth)/             login, register
    (game)/             character creation, dashboard, market, portfolio, career
    api/                thin route handlers -> service calls (no game rules here)
  components/           presentational React + Tailwind, no Prisma, no rules
  domain/               PURE game rules. No I/O, no Prisma, no fetch.
    money.ts            integer minor-unit arithmetic + formatting
    rng.ts              seeded PRNG + deterministic helpers
    calendar.ts         game clock: tick <-> game date, life stages
    character.ts        stat bounds, aging, life-stage rules
    market/             price model, sentiment, event application
    payroll.ts          salary/expense math per tick
    achievements.ts     unlock rules (pure predicates)
  server/               orchestration + persistence
    db.ts               Prisma client singleton
    auth.ts             Auth.js config, session helpers
    services/
      game-service.ts   create game, advance tick (one DB transaction)
      trade-service.ts  place/cancel/fill orders (idempotent, transactional)
      portfolio.ts      valuation from latest tick + holdings
    repositories/       Prisma queries, kept free of game rules
  lib/validation/       Zod schemas shared by client forms and route handlers
prisma/
  schema.prisma
  seed.ts               asset catalog, event templates, achievements
tests/
  unit/                 Vitest: domain + services against a test DB
  e2e/                  Playwright: register -> create -> trade -> advance -> reload
```

Dependency rule: `app -> components -> (types only)`, `app -> server -> domain`, `domain -> nothing`.
An ESLint boundary rule (later phase) enforces that `domain/` never imports from `server/`, `app/`, or Prisma.

## 3. Request flow (example: market buy)

1. Client form validates shape with the **same** Zod schema the server uses, then POSTs `{assetSymbol, quantity, idempotencyKey}`.
2. Route handler: authenticates session, parses with Zod, resolves the caller's active game **by `userId` from the session** (never from the body).
3. `TradeService.placeOrder` opens a Prisma transaction:
   a. `INSERT` order with unique `(game_id, idempotency_key)`; a duplicate key short-circuits to the existing order (safe replay, no double spend).
   b. Reject non-`ACTIVE` game states, unknown assets, `quantity <= 0`, or a limit order with a malformed price.
   c. Quote price from the **current tick's** stored price (market) or the limit condition.
   d. Conditional debit: `UPDATE portfolios SET cash_minor = cash_minor - total WHERE id = ? AND cash_minor >= total`; zero rows updated ⇒ "insufficient funds", transaction rolls back.
   e. Upsert holding: weighted-average cost, integer math (documented rounding rule).
   f. Append ledger entries (cash leg + asset leg) and mark the order `FILLED`.
4. Response returns the updated snapshot; the client revalidates and refetches the page.

Read-only endpoints (dashboard, market, portfolio) never mutate and always derive cash/holdings from the database, not from a client payload.

## 4. The three clocks

| Clock | Unit | Stored as | Owned by | Rules |
|---|---|---|---|---|
| Real time | wall clock | `created_at`, `updated_at` | Postgres | Audit only. Never used to decide game outcomes. |
| Game time | one tick = one in-game month | `games.tick` (int) | server | Advanced only by `advance` mutation; enforced monotonic. |
| Market time | equal to game time in MVP | `price_points.tick` | server | Price for tick `n` is written when advancing to `n`; orders fill at tick `n` price only. |

The client cannot choose a tick. `advance` does not accept a target tick; it advances by exactly one, and only if the game is `ACTIVE`. Future real-time limits (max N advances per minute) can be added in the same guard without schema change.

## 5. Market model (deterministic)

For each asset at each tick:

```
sentiment'  = clamp(sentiment * decay + marketNoise(seed, tick, asset) + eventShock)
drift       = (fundamental - price) / fundamental * meanReversion
return      = drift + sentiment' * beta + volatility * gaussian(seed, tick, asset)
price'      = max(minPrice, round(price * (1 + return)))
```

- `seed` comes from `games.seed`, generated once at game creation (crypto RNG), then persisted. Replays use the stored seed.
- Randomness derives from `HMAC(seed, "market" | tick | symbol)` → a uniform value → Box–Muller for a normal. No global `Math.random`, no mutable RNG state to persist.
- Prices are integer minor units; intermediate math uses fixed-point scaled integers, not floats, before the final rounding.
- Sanity clamps: max ±25% move per tick, floor at 1 minor unit, and price is never `0`.

The client may render a chart from `price_points`, but a chart is presentation only. Server price history is the source of truth and includes the sentiment/fundamental snapshot per tick for debuggability.

## 6. Transaction and integrity model

- **Ledger-first accounting.** `ledger_entries` rows (`cash` and `asset` legs) are appended in the same transaction as the balance/quantity change. Each row stores `balance_after_minor` and a per-game monotonic `sequence`, making tampering and accounting drift detectable.
- **Idempotency.** Client-generated UUID `idempotency_key` for trades, advance, and life-event choices, unique per game. Retries return the original result.
- **Ownership checks.** Every query is scoped by the session `userId` through the game relation. Route handlers never accept `gameId`/`userId` from the request body.
- **Transactions.** Prisma `$transaction` with `Serializable` isolation (or `ReadCommitted` + conditional `UPDATE` guards) for every mutation.
- **Invariants checked by tests:** cash never negative; `quantity > 0` for holdings; holdings equal the sum of filled order deltas; `sum(ledger cash deltas) == cash balance`; average cost stays positive; fees accounted exactly.
- **Audit trail.** Orders, ledger entries and life-event resolutions are retained forever for a game; UI exposes trade history.

## 7. Authentication

Auth.js (v5) with a credentials provider (email + Argon2id/bcrypt hash), JWT session cookie, `httpOnly` + `sameSite=lax`. Middleware protects `(game)` routes; every route handler re-checks the session server-side. Registration is rate-limited and validates with Zod. OAuth is out of MVP scope.

## 8. Failure and abuse handling

- All mutations return typed results (`{ok: true, ...}` / `{ok: false, code, message}`); HTTP codes are mapped from the code, not scattered through the code.
- Insufficient funds, duplicate orders, stale limit orders, invalid quantities, and locked game states are explicit, testable error codes.
- Zod validation at every boundary; Prisma parameterized queries only (no raw SQL with interpolation).
- Secrets in `.env`, never in client bundles; only `NEXT_PUBLIC_*` values reach the browser.

## 9. Testing strategy

- **Vitest (unit):** money, calendar, RNG determinism, price model properties (no zero/negative price, bounded move), payroll, achievement predicates, trade accounting invariants.
- **Vitest (service/integration):** against a disposable Postgres database (`DATABASE_URL_TEST`) — duplicate idempotency keys, insufficient funds rollback, ownership isolation, advance-time effects.
- **Playwright (e2e):** the MVP acceptance path in one spec file.
- Fixes must keep the failing check green; no skipped assertions.

## 10. Deployment shape

Next.js on a Node host (single region), managed PostgreSQL, Prisma migrations applied in CI/CD before rollout, secrets via environment variables. Health endpoint verifies DB connectivity. No background workers in MVP: all simulation is triggered by player actions and computed synchronously.

## 11. Known MVP simplifications

- One active save per user (schema supports many via `gameId`).
- Whole-unit share/coin quantities (no fractional quantities).
- One asset price per game tick (no intra-month chart granularity).
- Business ownership and loans are schema-reserved but not playable.
