import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { gameSnapshot } from "@/server/services/game-service";
import { portfolioSnapshot } from "@/server/services/trade-service";
import { futuresSnapshot } from "@/server/services/futures-service";
import { prisma } from "@/server/db";
import { currency } from "@/domain/money";
import {
  analyzePrices,
  generateCryptoInsight,
  type PriceSample,
} from "@/domain/market/analysis";
import { RealtimeCandleChart } from "@/components/game/realtime-candle-chart";
import { TokocryptoOrderBook } from "@/components/game/tokocrypto-orderbook";
import { TokocryptoTerminal } from "@/components/game/tokocrypto-terminal";
import { TokocryptoConsole } from "@/components/game/tokocrypto-console";

export const instant = false;

export default async function TokocryptoDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await gameSnapshot(userId);
  if (!game) redirect("/play/new");

  const resolved = await params;
  const symbol = resolved.symbol.toUpperCase();

  const allCryptoAssets = await prisma.asset.findMany({
    where: { kind: "CRYPTO" },
    orderBy: { symbol: "asc" },
  });

  const asset = allCryptoAssets.find((a) => a.symbol === symbol);
  if (!asset) redirect("/play/crypto");

  const fromTick = Math.max(0, game.tick - 35);
  const rows = await prisma.pricePoint.findMany({
    where: { gameId: game.gameId, assetId: asset.id, tick: { gte: fromTick } },
    orderBy: { tick: "asc" },
  });

  const points: PriceSample[] = rows.map((r) => ({
    tick: r.tick,
    priceMinor: r.priceMinor,
  }));

  const currentPoint = points.at(-1);
  const prevPoint = points.length >= 2 ? points.at(-2) : undefined;

  const currentPrice = currentPoint?.priceMinor ?? asset.fundamentalMinor;
  const prevPrice = prevPoint?.priceMinor ?? currentPrice;
  const priceChange = currentPrice - prevPrice;
  const changePercent =
    prevPrice > 0n ? Number(((currentPrice - prevPrice) * 10_000n) / prevPrice) / 100 : 0;
  const isUp = priceChange >= 0n;

  // Quantitative and technical analysis
  const analysis = analyzePrices(points);
  const insight = generateCryptoInsight(analysis, asset.fundamentalMinor, currentPrice);

  // User's portfolio and futures positions
  const [portfolio, futures] = await Promise.all([
    portfolioSnapshot(userId),
    futuresSnapshot(userId),
  ]);

  const holding = portfolio?.holdings.find((h) => h.symbol === symbol);
  const openOrders = (portfolio?.pendingOrders ?? [])
    .filter((o) => o.symbol === symbol)
    .map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side as "BUY" | "SELL",
      type: o.type as "MARKET" | "LIMIT",
      quantity: o.quantity,
      limitPriceMinor: o.limitPriceMinor,
    }));

  const recentTrades = (portfolio?.history ?? [])
    .filter((t) => t.symbol === symbol)
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side as "BUY" | "SELL",
      quantity: t.quantity,
      priceMinor: t.priceMinor,
      feeMinor: t.feeMinor,
    }));

  const cryptoPositions = (futures?.positions ?? []).filter((p) => p.symbol === symbol);

  const holdingViews = holding
    ? [
        {
          symbol: holding.symbol,
          quantity: holding.quantity,
          avgCostMinor: holding.avgCostMinor,
          currentPriceMinor: holding.currentPriceMinor,
          marketValueMinor: holding.marketValueMinor,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Tokocrypto Top Navigation & Pair Selector Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#2b313a] bg-[#181a20] p-3 text-[#eaecef] shadow-xl md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/play/crypto"
            className="flex items-center gap-1.5 rounded-lg bg-[#2b313a] px-3 py-1.5 text-xs font-semibold text-[#848e9c] transition hover:text-white"
          >
            <span>← Tokocrypto Pasar</span>
          </Link>

          {/* Quick Coin Tabs */}
          <div className="flex items-center gap-1.5">
            {allCryptoAssets.map((crypto) => {
              const active = crypto.symbol === symbol;
              return (
                <Link
                  key={crypto.symbol}
                  href={`/play/crypto/${crypto.symbol}`}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    active
                      ? "bg-[#00c087] text-white shadow-md"
                      : "bg-[#12161a] text-[#848e9c] hover:bg-[#2b313a] hover:text-white"
                  }`}
                >
                  {crypto.symbol}/CR
                </Link>
              );
            })}
          </div>
        </div>

        {/* Global Wallet Summary */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div>
            <span className="text-[#848e9c]">Saldo Tunai: </span>
            <span className="font-bold tabular-nums text-white">
              {currency(game.cashMinor)}
            </span>
          </div>
          <span className="text-[#2b313a]">|</span>
          <div>
            <span className="text-[#848e9c]">Ekuitas Futures: </span>
            <span className="font-bold tabular-nums text-[#00c087]">
              {currency(futures?.equityMinor ?? 0n)}
            </span>
          </div>
        </div>
      </div>

      {/* Tokocrypto Ticker Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#2b313a] bg-[#181a20] p-4 text-[#eaecef] shadow-xl">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white">{asset.symbol}/CR</span>
              <span className="rounded bg-[#2b313a] px-2 py-0.5 text-[10px] font-bold text-[#848e9c]">
                {asset.name}
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span
                className={`text-2xl font-black tabular-nums ${
                  isUp ? "text-[#0ecb81]" : "text-[#f6465d]"
                }`}
              >
                {currency(currentPrice)}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                  isUp
                    ? "bg-[#0ecb81]/15 text-[#0ecb81]"
                    : "bg-[#f6465d]/15 text-[#f6465d]"
                }`}
              >
                {isUp ? "+" : ""}
                {changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* 24h High, Low, Volatility, Fundamental */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
          <div>
            <div className="text-[10px] uppercase text-[#848e9c]">Tertinggi (High)</div>
            <div className="font-semibold tabular-nums text-white">
              {currency(analysis.highMinor)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[#848e9c]">Terendah (Low)</div>
            <div className="font-semibold tabular-nums text-white">
              {currency(analysis.lowMinor)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[#848e9c]">Volatilitas</div>
            <div className="font-semibold tabular-nums text-[#f0b90b]">
              {(analysis.volatilityBp / 100).toFixed(1)}% ({insight.volatilityRisk})
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[#848e9c]">Valuasi Fair Value</div>
            <div className="font-semibold tabular-nums text-[#00c087]">
              {currency(asset.fundamentalMinor)}{" "}
              <span className="text-[10px] text-[#848e9c]">
                ({insight.valuationGapBp > 0 ? "+" : ""}
                {(insight.valuationGapBp / 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart + Orderbook + Terminal */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Left & Center: Chart & Analysis (8 cols) */}
        <div className="space-y-4 xl:col-span-8">
          <RealtimeCandleChart
            points={points}
            symbol={asset.symbol}
            name={asset.name}
            kind="CRYPTO"
          />

          {/* Tokocrypto Sinyal & Analisis Teknikal */}
          <div className="rounded-xl border border-[#2b313a] bg-[#181a20] p-4 text-[#eaecef] shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-[#2b313a] pb-2 font-bold text-xs uppercase tracking-wider text-[#848e9c]">
              <span>Analisis Teknikal &amp; Algoritma Pasar</span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  insight.signal === "BULLISH"
                    ? "bg-[#0ecb81]/20 text-[#0ecb81]"
                    : insight.signal === "BEARISH"
                      ? "bg-[#f6465d]/20 text-[#f6465d]"
                      : "bg-[#f0b90b]/20 text-[#f0b90b]"
                }`}
              >
                Sinyal: {insight.signalLabel}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-[#12161a] p-3 text-xs">
                <div className="font-bold text-[#00c087]">Strategi Spot (Beli/Jual)</div>
                <p className="mt-1 text-[#848e9c] leading-relaxed">
                  {insight.spotAdvice}
                </p>
              </div>
              <div className="rounded-lg bg-[#12161a] p-3 text-xs">
                <div className="font-bold text-[#f0b90b]">Strategi Futures (Kontrak Berjangka)</div>
                <p className="mt-1 text-[#848e9c] leading-relaxed">
                  {insight.futuresAdvice}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Orderbook & Trading Terminal (4 cols) */}
        <div className="space-y-4 xl:col-span-4">
          <TokocryptoTerminal
            symbol={asset.symbol}
            symbols={allCryptoAssets.map((a) => a.symbol)}
            priceMinor={currentPrice}
            cashMinor={game.cashMinor}
            holdingQuantity={holding?.quantity ?? 0}
          />

          <TokocryptoOrderBook
            currentPriceMinor={currentPrice}
            isUp={isUp}
            symbol={asset.symbol}
          />
        </div>
      </div>

      {/* Bottom Tokocrypto Console (Positions, Orders, Holdings, History) */}
      <TokocryptoConsole
        positions={cryptoPositions}
        openOrders={openOrders}
        holdings={holdingViews}
        tradeHistory={recentTrades}
      />
    </div>
  );
}
