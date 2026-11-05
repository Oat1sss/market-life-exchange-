-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'RETIRED', 'DECEASED');

-- CreateEnum
CREATE TYPE "CharacterBackground" AS ENUM ('SCHOLAR', 'HUSTLER', 'CREATIVE');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('STOCK', 'CRYPTO');

-- CreateEnum
CREATE TYPE "AssetSector" AS ENUM ('TECH', 'HEALTH', 'ENERGY', 'CONSUMER', 'CRYPTO');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'FILLED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('CASH', 'ASSET');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('DEPOSIT', 'TRADE_BUY', 'TRADE_SELL', 'FEE', 'SALARY', 'EXPENSE', 'EDUCATION', 'LIFE_EVENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CareerEndReason" AS ENUM ('HIRED', 'PROMOTED', 'RESIGNED', 'LAID_OFF');

-- CreateEnum
CREATE TYPE "EducationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'FOOD', 'TRANSPORT', 'SUBSCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCadence" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "MarketEventType" AS ENUM ('RATE_CHANGE', 'INFLATION', 'EARNINGS', 'PRODUCT', 'SECTOR_DISRUPTION', 'REGIME');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "seed" BIGINT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "tick" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "background" "CharacterBackground" NOT NULL,
    "health" INTEGER NOT NULL DEFAULT 50,
    "happiness" INTEGER NOT NULL DEFAULT 50,
    "knowledge" INTEGER NOT NULL DEFAULT 50,
    "reputation" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "cash_minor" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "symbol" VARCHAR(8) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "sector" "AssetSector" NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "fundamental_minor" BIGINT NOT NULL,
    "volatility_bp" INTEGER NOT NULL,
    "beta_bp" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_points" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "tick" INTEGER NOT NULL,
    "price_minor" BIGINT NOT NULL,
    "sentiment_bp" INTEGER NOT NULL,
    "fundamental_minor" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portfolio_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "average_cost_minor" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "limit_price_minor" BIGINT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "fill_price_minor" BIGINT,
    "gross_minor" BIGINT,
    "fee_minor" BIGINT,
    "net_minor" BIGINT,
    "tick_placed" INTEGER NOT NULL,
    "tick_resolved" INTEGER,
    "idempotency_key" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "asset_id" UUID,
    "direction" "LedgerDirection" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "balance_after_minor" BIGINT NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "ref_type" VARCHAR(40) NOT NULL,
    "ref_id" UUID NOT NULL,
    "tick" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "character_id" UUID NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "employer" VARCHAR(60) NOT NULL,
    "annual_salary_minor" BIGINT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "started_tick" INTEGER NOT NULL,
    "ended_tick" INTEGER,
    "end_reason" "CareerEndReason",

    CONSTRAINT "careers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "character_id" UUID NOT NULL,
    "program_key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "tuition_minor" BIGINT NOT NULL,
    "knowledge_gain" INTEGER NOT NULL,
    "duration_ticks" INTEGER NOT NULL,
    "started_tick" INTEGER NOT NULL,
    "completes_tick" INTEGER NOT NULL,
    "status" "EducationStatus" NOT NULL DEFAULT 'IN_PROGRESS',

    CONSTRAINT "educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "cadence" "ExpenseCadence" NOT NULL DEFAULT 'MONTHLY',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "expense_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "life_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "template_key" VARCHAR(40) NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "body" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "chosen_key" VARCHAR(40),
    "outcome" JSONB,
    "tick" INTEGER NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "life_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "tick" INTEGER NOT NULL,
    "type" "MarketEventType" NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "body" VARCHAR(160) NOT NULL,
    "effects" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "player_achievements" (
    "game_id" UUID NOT NULL,
    "achievement_key" VARCHAR(40) NOT NULL,
    "unlocked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_achievements_pkey" PRIMARY KEY ("game_id","achievement_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "games_user_id_status_idx" ON "games"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "characters_game_id_key" ON "characters"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolios_game_id_key" ON "portfolios"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_symbol_key" ON "assets"("symbol");

-- CreateIndex
CREATE INDEX "price_points_game_id_asset_id_idx" ON "price_points"("game_id", "asset_id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "price_points_game_id_asset_id_tick_key" ON "price_points"("game_id", "asset_id", "tick");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_portfolio_id_asset_id_key" ON "holdings"("portfolio_id", "asset_id");

-- CreateIndex
CREATE INDEX "orders_game_id_status_idx" ON "orders"("game_id", "status");

-- CreateIndex
CREATE INDEX "orders_game_id_created_at_idx" ON "orders"("game_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_game_id_idempotency_key_key" ON "orders"("game_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_entries_game_id_created_at_idx" ON "ledger_entries"("game_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_game_id_sequence_key" ON "ledger_entries"("game_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "careers_character_id_key" ON "careers"("character_id");

-- CreateIndex
CREATE INDEX "educations_character_id_status_idx" ON "educations"("character_id", "status");

-- CreateIndex
CREATE INDEX "expense_rules_game_id_active_idx" ON "expense_rules"("game_id", "active");

-- CreateIndex
CREATE INDEX "life_events_game_id_tick_idx" ON "life_events"("game_id", "tick");

-- CreateIndex
CREATE UNIQUE INDEX "life_events_game_id_template_key_tick_key" ON "life_events"("game_id", "template_key", "tick");

-- CreateIndex
CREATE UNIQUE INDEX "market_events_game_id_tick_type_title_key" ON "market_events"("game_id", "tick", "type", "title");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careers" ADD CONSTRAINT "careers_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educations" ADD CONSTRAINT "educations_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_rules" ADD CONSTRAINT "expense_rules_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_events" ADD CONSTRAINT "life_events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_events" ADD CONSTRAINT "market_events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_achievement_key_fkey" FOREIGN KEY ("achievement_key") REFERENCES "achievements"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
