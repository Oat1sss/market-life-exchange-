-- MarketLife integrity constraints identical to docs/DATABASE.md: DB-level
-- guards for stats bounds, cash sanity, position sanity, and at most one
-- ACTIVE game per user. Applied as a separate raw migration because Prisma
-- does not derive CHECK constraints or partial indexes from the schema.

ALTER TABLE characters
  ADD CONSTRAINT characters_stats_bounds CHECK (
    health BETWEEN 0 AND 100
    AND happiness BETWEEN 0 AND 100
    AND knowledge BETWEEN 0 AND 100
    AND reputation BETWEEN 0 AND 100
  );

ALTER TABLE portfolios
  ADD CONSTRAINT portfolios_cash_non_negative CHECK (cash_minor >= 0);

ALTER TABLE holdings
  ADD CONSTRAINT holdings_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT holdings_average_cost_positive CHECK (average_cost_minor > 0);

ALTER TABLE orders
  ADD CONSTRAINT orders_quantity_positive CHECK (quantity > 0);

ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_amount_positive CHECK (amount_minor > 0);

-- At most one ACTIVE game per user.
CREATE UNIQUE INDEX games_one_active_per_user
  ON games (user_id)
  WHERE status = 'ACTIVE';
