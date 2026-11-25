import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";

export const instant = false;

import { gameSnapshot } from "@/server/services/game-service";
import { portfolioSnapshot } from "@/server/services/trade-service";
import { futuresSnapshot } from "@/server/services/futures-service";
import { prisma } from "@/server/db";
import { currency } from "@/domain/money";
import { analyzePrices, type MarketAnalysis } from "@/domain/market/analysis";
import type { ChartPoint } from "@/components/game/price-chart";
import { CryptoMarketGrid } from "@/components/game/crypto-market-grid";
import { TokocryptoTerminal } from "@/components/game/tokocrypto-terminal";
import { TokocryptoConsole } from "@/components/game/tokocrypto-console";

interface CryptoAssetView {
  symbol: string;
  name: string;
  priceMinor: bigint;
  points: ChartPoint[];
  analysis: MarketAnalysis;
}

export default async function TokocryptoHubPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await gameSnapshot(userId);
  if (!game) redirect("/play/new");

  const assets = await prisma.asset.findMany({
    where: { kind: "CRYPTO" },
    orderBy: { symbol: "asc" },
  });
  const assetIds = assets.map((asset) => asset.id);
  const from = Math.max(0, game.tick - 29);
  const rows = await prisma.pricePoint.findMany({
    where: { gameId: game.gameId, assetId: { in: assetIds }, tick: { gte: from } },
    orderBy: { tick: "asc" },
  });

  const byAsset = new Map<string, ChartPoint[]>();
  for (const row of rows) {
    const slot = byAsset.get(row.assetId) ?? [];
    slot.push({ tick: row.tick, priceMinor: row.priceMinor });
    byAsset.set(row.assetId, slot);
  }

  const crypto: CryptoAssetView[] = assets.map((asset) => {
    const points = byAsset.get(asset.id) ?? [];
    const priceMinor = points.at(-1)?.priceMinor ?? asset.fundamentalMinor;
    return {
      symbol: asset.symbol,
      name: asset.name,
      priceMinor,
      points,
      analysis: analyzePrices(points),
    };
  });
  const symbols = crypto.map((asset) => asset.symbol);

  const [portfolio, futures] = await Promise.all([
    portfolioSnapshot(userId),
    futuresSnapshot(userId),
  ]);

  const cryptoHoldings = (portfolio?.holdings ?? []).filter((holding) =>
    symbols.includes(holding.symbol),
  );
  const openCryptoOrders = (portfolio?.pendingOrders ?? [])
    .filter((order) => symbols.includes(order.symbol))
    .map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side as "BUY" | "SELL",
      type: o.type as "MARKET" | "LIMIT",
      quantity: o.quantity,
      limitPriceMinor: o.limitPriceMinor,
    }));

  const totalSpotCryptoValue = cryptoHoldings.reduce(
    (sum, h) => sum + h.marketValueMinor,
    0n,
  );

  const holdingViews = cryptoHoldings.map((h) => ({
    symbol: h.symbol,
    quantity: h.quantity,
    avgCostMinor: h.avgCostMinor,
    currentPriceMinor: h.currentPriceMinor,
    marketValueMinor: h.marketValueMinor,
  }));

  const recentTrades = (portfolio?.history ?? [])
    .filter((t) => symbols.includes(t.symbol))
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side as "BUY" | "SELL",
      quantity: t.quantity,
      priceMinor: t.priceMinor,
      feeMinor: t.feeMinor,
    }));

  const futuresPositions = futures?.positions ?? [];

  // Default featured asset
  const defaultAsset = crypto.find((c) => c.symbol === "BTC") ?? crypto[0]!;

  return (
    <div className="space-y-6">
      {/* Tokocrypto Banner & Wallet Overview */}
      <div className="rounded-xl border border-[#2b313a] bg-gradient-to-r from-[#181a20] via-[#1e2329] to-[#181a20] p-6 text-[#eaecef] shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#00c087] px-2 py-0.5 text-xs font-black text-black">
                TOKOCRYPTO
              </span>
              <span className="text-xs font-semibold text-[#848e9c]">Terminal Pasar &amp; Derivatif</span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              Pasar Kripto Indonesia
            </h1>
            <p className="mt-1 text-xs text-[#848e9c]">
              Bulan ke-{game.tick} · Perdagangan Spot instan &amp; Futures dengan leverage hingga 20x.
            </p>
          </div>

          {/* Quick Wallet Stats in Tokocrypto format */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[#12161a] p-3 border border-[#2b313a]">
              <div className="text-[10px] uppercase tracking-wider text-[#848e9c]">Saldo Tunai</div>
              <div className="mt-1 font-bold tabular-nums text-white">
                {currency(game.cashMinor)}
              </div>
            </div>

            <div className="rounded-lg bg-[#12161a] p-3 border border-[#2b313a]">
              <div className="text-[10px] uppercase tracking-wider text-[#848e9c]">Aset Spot Kripto</div>
              <div className="mt-1 font-bold tabular-nums text-[#00c087]">
                {currency(totalSpotCryptoValue)}
              </div>
            </div>

            <div className="rounded-lg bg-[#12161a] p-3 border border-[#2b313a]">
              <div className="text-[10px] uppercase tracking-wider text-[#848e9c]">Ekuitas Futures</div>
              <div className="mt-1 font-bold tabular-nums text-[#f0b90b]">
                {currency(futures?.equityMinor ?? 0n)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tokocrypto Market Tickers Grid */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#eaecef]">
              Daftar Pasar Kripto
            </h2>
            <p className="mt-0.5 text-[11px] text-[#848e9c]">
              Cari dan filter pasar, lalu buka terminal grafik untuk mulai trading.
            </p>
          </div>
          <span className="text-xs text-[#848e9c]">{crypto.length} pasar tersedia</span>
        </div>

        <CryptoMarketGrid
          assets={crypto.map((asset) => ({
            symbol: asset.symbol,
            name: asset.name,
            priceMinor: asset.priceMinor,
            points: asset.points,
            changeBp: asset.analysis.changeBp,
            volatilityBp: asset.analysis.volatilityBp,
          }))}
        />
      </section>

      {/* Fast Quick Trading Station for Top Crypto */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="mb-2 font-bold text-xs uppercase tracking-wider text-[#848e9c]">
            Terminal Transaksi Cepat ({defaultAsset.symbol}/IDR)
          </div>
          <TokocryptoTerminal
            symbol={defaultAsset.symbol}
            symbols={symbols}
            priceMinor={defaultAsset.priceMinor}
            cashMinor={game.cashMinor}
            holdingQuantity={cryptoHoldings.find((h) => h.symbol === defaultAsset.symbol)?.quantity ?? 0}
          />
        </div>

        <div className="lg:col-span-6">
          <div className="mb-2 font-bold text-xs uppercase tracking-wider text-[#848e9c]">
            Panduan &amp; Aturan Perdagangan Tokocrypto
          </div>
          <div className="rounded-xl border border-[#2b313a] bg-[#181a20] p-5 text-xs text-[#eaecef] shadow-xl space-y-3">
            <div className="rounded-lg bg-[#12161a] p-3 border border-[#2b313a]">
              <div className="font-bold text-[#00c087]">1. Perdagangan Spot (Beli &amp; Jual)</div>
              <p className="mt-1 text-[#848e9c] leading-relaxed">
                Eksekusi instan langsung masuk ke saldo aset dompet Anda. Anda dapat memasang pesanan <strong>Market</strong> (langsung pada harga saat ini) atau <strong>Limit</strong> (menunggu target harga tercapai). Biaya transaksi: 0.1%.
              </p>
            </div>

            <div className="rounded-lg bg-[#12161a] p-3 border border-[#2b313a]">
              <div className="font-bold text-[#f0b90b]">2. Perdagangan Futures (Kontrak Berjangka 2x–20x)</div>
              <p className="mt-1 text-[#848e9c] leading-relaxed">
                Manfaatkan modal dengan margin leverage <strong>Long (Beli saat harga diprediksi naik)</strong> atau <strong>Short (Jual saat harga diprediksi turun)</strong>. Likuidasi terjadi otomatis apabila ekuitas margin habis mencapai 0.
              </p>
            </div>

            <div className="rounded-lg bg-[#12161a] p-3 border border-[#2b313a]">
              <div className="font-bold text-white">3. Manajemen Risiko &amp; Analisis Real-time</div>
              <p className="mt-1 text-[#848e9c] leading-relaxed">
                Gunakan tombol persentase <strong>25%, 50%, 75%, 100%</strong> untuk kalkulasi cepat ukuran posisi yang aman tanpa melebihi batas saldo tunai Anda.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Global Bottom Console */}
      <TokocryptoConsole
        positions={futuresPositions}
        openOrders={openCryptoOrders}
        holdings={holdingViews}
        tradeHistory={recentTrades}
      />
    </div>
  );
}
