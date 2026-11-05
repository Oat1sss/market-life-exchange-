# MarketLife — Database Schema Proposal

Target: PostgreSQL 16 + Prisma. All tables use `snake_case` columns, `uuid` primary keys (`gen_random_uuid()`), `created_at`/`updated_at` audit columns. All monetary values are `BIGINT` **minor units** (1 credit = 100 minor units), named with the `_minor` suffix. Quantities are `INTEGER` whole units (> 0).

## 1. Tables

**users** — identity only.
`id, email UNIQUE CITEXT, password_hash, display_name, created_at, updated_at`

**games** — one save; owns the clock and the seed.
`id, user_id FK, seed BIGINT, status ENUM('ACTIVE','RETIRED','DECEASED'), tick INT DEFAULT 0, start_date DATE, created_at, updated_at`
Index: `(user_id, status)` with a partial unique index ensuring at most one `ACTIVE` game per user.
Game date = `start_date + tick months`.

**characters** — 1:1 with game.
`id, game_id UNIQUE FK, first_name, last_name, background ENUM, birth_age INT DEFAULT 18, health SMALLINT, happiness SMALLINT, knowledge SMALLINT, reputation SMALLINT, created_at`
Check constraints: each stat between 0 and 100.

**portfolios** — cash account; 1:1 with game for MVP.
`id, game_id UNIQUE FK, cash_minor BIGINT DEFAULT 0, updated_at`
Check: `cash_minor >= 0`.

**assets** — static catalog (seeded, not user-owned).
`id, symbol TEXT UNIQUE, name, sector ENUM, kind ENUM('STOCK','CRYPTO'), fundamental_minor BIGINT, volatility_bp INT, beta_bp INT, created_at`
`volatility_bp`/`beta_bp` are basis points (integer) to avoid floats.

**price_points** — server-authoritative history, one row per asset per tick.
`id, game_id FK, asset_id FK, tick INT, price_minor BIGINT, sentiment_bp INT, fundamental_minor BIGINT, created_at`
UNIQUE `(game_id, asset_id, tick)`. Index `(game_id, asset_id, tick DESC)` for latest-price lookups.

**holdings** — aggregate position per asset.
`id, portfolio_id FK, asset_id FK, quantity INT, average_cost_minor BIGINT, updated_at`
UNIQUE `(portfolio_id, asset_id)`. Checks: `quantity > 0`, `average_cost_minor > 0`.

**orders** — intents and their fill outcome; also the idempotency anchor.
`id, game_id FK, asset_id FK, side ENUM('BUY','SELL'), type ENUM('MARKET','LIMIT'), quantity INT, limit_price_minor BIGINT NULL, status ENUM('PENDING','FILLED','CANCELLED','REJECTED'), fill_price_minor BIGINT NULL, gross_minor BIGINT NULL, fee_minor BIGINT NULL, net_minor BIGINT NULL, tick_placed INT, tick_resolved INT NULL, idempotency_key UUID, created_at, updated_at`
UNIQUE `(game_id, idempotency_key)`; index `(game_id, status)` for resting limit orders and `(game_id, created_at DESC)` for trade history.

**ledger_entries** — append-only audit of every balance/quantity change.
`id, game_id FK, portfolio_id FK, sequence INT, account ENUM('CASH','ASSET'), asset_id FK NULL, direction ENUM('DEBIT','CREDIT'), amount_minor BIGINT, balance_after_minor BIGINT, reason ENUM('DEPOSIT','TRADE_BUY','TRADE_SELL','FEE','SALARY','EXPENSE','EDUCATION','LIFE_EVENT','ADJUSTMENT'), ref_type TEXT, ref_id UUID, tick INT, created_at`
UNIQUE `(game_id, sequence)`, index `(game_id, created_at)`. No updates or deletes at the application layer; corrections use compensating `ADJUSTMENT` entries.

**careers** — employment history.
`id, character_id FK, title, employer, annual_salary_minor BIGINT, level INT, started_tick INT, ended_tick INT NULL, reason ENUM('HIRED','PROMOTED','RESIGNED','LAID_OFF') NULL`

**educations**
`id, character_id FK, program_key, name, tuition_minor BIGINT, knowledge_gain INT, duration_ticks INT, started_tick INT, completes_tick INT, status ENUM('IN_PROGRESS','COMPLETED','ABANDONED')`

**expense_rules** — recurring obligations per game (snapshotted at creation so balance changes are historical).
`id, game_id FK, label, category ENUM('RENT','FOOD','TRANSPORT','SUBSCRIPTION','OTHER'), amount_minor BIGINT, cadence ENUM('MONTHLY','ANNUAL'), active BOOLEAN`

**life_events** — emitted instances, not templates.
`id, game_id FK, template_key, title, body, choices JSONB, chosen_key TEXT NULL, outcome JSONB NULL, tick INT, resolved_at TIMESTAMPTZ NULL, created_at`
UNIQUE `(game_id, template_key, tick)` so one template cannot fire twice in the same month. Pending events block `advance` until resolved (or auto-resolve with the default option, per rules).

**market_events** — headline + shock payload per tick.
`id, game_id FK, tick INT, type ENUM('RATE_CHANGE','INFLATION','EARNINGS','PRODUCT','SECTOR_DISRUPTION','REGIME'), title, body, effects JSONB, created_at`
UNIQUE `(game_id, tick, type, title)`; one or two headlines per tick.

**achievements** (static) + **player_achievements**
`achievements: key UNIQUE, name, description, hidden BOOLEAN`
`player_achievements: game_id FK, achievement_key FK, unlocked_at` — PK `(game_id, achievement_key)` for idempotent unlocks.

## 2. Relationship summary

```
users 1─1 games 1─1 characters
                  ├─1 portfolios 1─n holdings n─1 assets
                  ├─n orders n─1 assets
                  ├─n ledger_entries
                  ├─n careers (via character)
                  ├─n educations (via character)
                  ├─n expense_rules
                  ├─n life_events
                  ├─n market_events
                  ├─n player_achievements n─1 achievements
price_points n─1 assets, scoped by game
```

## 3. Transaction model

**Buy (market), all inside one transaction:**

```sql
-- 1. idempotency: unique (game_id, idempotency_key) insert; on conflict -> return existing order
INSERT INTO orders (...) VALUES (...) ON CONFLICT (game_id, idempotency_key) DO NOTHING RETURNING id;

-- 2. price read: current tick price (server-chosen tick)
SELECT price_minor FROM price_points WHERE game_id=$1 AND asset_id=$2 ORDER BY tick DESC LIMIT 1;

-- 3. atomic debit: guard replaces SELECT-then-UPDATE
UPDATE portfolios SET cash_minor = cash_minor - $total
 WHERE id=$p AND cash_minor >= $total RETURNING cash_minor;   -- 0 rows => insufficient funds

-- 4. position upsert with weighted average cost
-- 5. ledger entries (cash DEBIT, asset CREDIT) + order FILLED
COMMIT;
```

**Sell:** acquire position row `FOR UPDATE`, verify `quantity >= q`, credit `proceeds - fee`, reduce quantity or delete row when zero, append ledger entries. Moving average cost is left unchanged on partial sells; realized P&L is `(fill_price - average_cost) * q` and is derived from the ledger, not stored.

**Advance tick:** `SELECT ... FOR UPDATE` on the game row to serialize concurrent advances; reject if the game is not `ACTIVE` or a pending life event blocks it; then write price points, salary/expense ledger entries, life events, achievements, increment `tick`, all in one transaction.

**Rounding rule (documented, tested):** annual salary → monthly via integer division with the remainder stored in `careers` as an accumulated minor-unit credit so the 12-month total equals the annual figure exactly. Fees: `notional * 10 / 10000` rounded **up** to the next minor unit, minimum 100 minor units.

## 4. Migration and seeding

- `prisma migrate dev` locally; `prisma migrate deploy` in deployment.
- `prisma/seed.ts` inserts the 5 assets, achievement definitions, expense defaults, event templates (as TS constants referenced by key, not rows, for MVP).
- Tests use a separate database and truncate between suites.

## 5. Deliberate omissions (schema-ready, not playable)

Loans/debt, business entities, property, dependents, multiple concurrent saves, order book depth. Their absence does not change the tables above; additions will be additive migrations.
