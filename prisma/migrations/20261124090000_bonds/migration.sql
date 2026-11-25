-- Fixed-income market: tradable government and corporate bond lines.
-- One holding unit is one bond with 100 credits of face value; the static
-- catalog (coupon, rating, maturity) lives in src/domain/economy/catalog.ts.

-- AlterEnum
ALTER TYPE "LedgerReason" ADD VALUE 'BOND_BUY';
ALTER TYPE "LedgerReason" ADD VALUE 'BOND_SELL';
ALTER TYPE "LedgerReason" ADD VALUE 'BOND_COUPON';
ALTER TYPE "LedgerReason" ADD VALUE 'BOND_MATURITY';

-- CreateEnum
CREATE TYPE "BondTradeSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "bond_holdings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "bond_key" VARCHAR(16) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost_minor" BIGINT NOT NULL,
    "purchased_tick" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bond_holdings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bond_holdings_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "bond_holdings_cost_positive" CHECK ("cost_minor" > 0)
);

-- CreateTable
CREATE TABLE "bond_trades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "bond_key" VARCHAR(16) NOT NULL,
    "side" "BondTradeSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_minor" BIGINT NOT NULL,
    "gross_minor" BIGINT NOT NULL,
    "fee_minor" BIGINT NOT NULL,
    "net_minor" BIGINT NOT NULL,
    "tick" INTEGER NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bond_trades_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bond_trades_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "bond_trades_gross_positive" CHECK ("gross_minor" > 0),
    CONSTRAINT "bond_trades_net_non_negative" CHECK ("net_minor" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "bond_holdings_game_id_bond_key_key" ON "bond_holdings"("game_id", "bond_key");

-- CreateIndex
CREATE UNIQUE INDEX "bond_trades_game_id_idempotency_key_key" ON "bond_trades"("game_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "bond_trades_game_id_created_at_idx" ON "bond_trades"("game_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "bond_holdings" ADD CONSTRAINT "bond_holdings_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bond_trades" ADD CONSTRAINT "bond_trades_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
