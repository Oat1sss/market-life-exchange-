-- CreateEnum
CREATE TYPE "FuturesSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "FuturesStatus" AS ENUM ('OPEN', 'CLOSED', 'LIQUIDATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerReason" ADD VALUE 'FUTURES_MARGIN';
ALTER TYPE "LedgerReason" ADD VALUE 'FUTURES_PNL';

-- CreateTable
CREATE TABLE "futures_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "side" "FuturesSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "leverage" INTEGER NOT NULL,
    "entry_price_minor" BIGINT NOT NULL,
    "margin_minor" BIGINT NOT NULL,
    "open_fee_minor" BIGINT NOT NULL,
    "close_fee_minor" BIGINT,
    "realized_minor" BIGINT,
    "status" "FuturesStatus" NOT NULL DEFAULT 'OPEN',
    "opened_tick" INTEGER NOT NULL,
    "closed_tick" INTEGER,
    "idempotency_key" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "futures_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "futures_positions_game_id_status_idx" ON "futures_positions"("game_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "futures_positions_game_id_idempotency_key_key" ON "futures_positions"("game_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "futures_positions" ADD CONSTRAINT "futures_positions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "futures_positions" ADD CONSTRAINT "futures_positions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
