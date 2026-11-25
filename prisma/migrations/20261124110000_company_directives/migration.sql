-- Company control: board decisions issued by a controlling shareholder.
-- Directives are inputs to the deterministic economy replay (applied at
-- `at_month`), so they are append-only records, not mutations of world state.

-- AlterEnum
ALTER TYPE "LedgerReason" ADD VALUE 'DIVIDEND';

-- CreateEnum
CREATE TYPE "DirectiveKind" AS ENUM ('DIVIDEND', 'BUYBACK', 'EXPANSION', 'CUT_COSTS');

-- CreateTable
CREATE TABLE "company_directives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "company_symbol" VARCHAR(12) NOT NULL,
    "kind" "DirectiveKind" NOT NULL,
    "at_month" INTEGER NOT NULL,
    "payout_minor" BIGINT NOT NULL DEFAULT 0,
    "player_payout_minor" BIGINT NOT NULL DEFAULT 0,
    "idempotency_key" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_directives_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "company_directives_payout_non_negative" CHECK ("payout_minor" >= 0),
    CONSTRAINT "company_directives_player_payout_non_negative" CHECK ("player_payout_minor" >= 0),
    CONSTRAINT "company_directives_player_payout_capped" CHECK ("player_payout_minor" <= "payout_minor")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_directives_game_id_idempotency_key_key" ON "company_directives"("game_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "company_directives_game_id_at_month_idx" ON "company_directives"("game_id", "at_month");

-- AddForeignKey
ALTER TABLE "company_directives" ADD CONSTRAINT "company_directives_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
