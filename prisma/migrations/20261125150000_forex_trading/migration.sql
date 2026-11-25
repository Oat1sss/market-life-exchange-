-- Forex becomes tradable with the same demo cash account as stocks and crypto.
-- `units` holds whole foreign-currency units; rates are rupiah per unit in
-- minor units (100 = Rp 1,00).

-- CreateTable
CREATE TABLE "forex_holdings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "units" BIGINT NOT NULL,
    "average_rate_minor" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forex_holdings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forex_holdings_units_positive" CHECK ("units" > 0),
    CONSTRAINT "forex_holdings_rate_positive" CHECK ("average_rate_minor" > 0)
);

-- CreateTable
CREATE TABLE "forex_trades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "pair" VARCHAR(9) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "units" BIGINT NOT NULL,
    "rate_minor" BIGINT NOT NULL,
    "gross_minor" BIGINT NOT NULL,
    "fee_minor" BIGINT NOT NULL,
    "net_minor" BIGINT NOT NULL,
    "tick" INTEGER NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forex_trades_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forex_trades_units_positive" CHECK ("units" > 0),
    CONSTRAINT "forex_trades_gross_positive" CHECK ("gross_minor" > 0),
    CONSTRAINT "forex_trades_net_non_negative" CHECK ("net_minor" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "forex_holdings_game_id_currency_key" ON "forex_holdings"("game_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "forex_trades_game_id_idempotency_key_key" ON "forex_trades"("game_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "forex_trades_game_id_created_at_idx" ON "forex_trades"("game_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "forex_holdings" ADD CONSTRAINT "forex_holdings_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forex_trades" ADD CONSTRAINT "forex_trades_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
