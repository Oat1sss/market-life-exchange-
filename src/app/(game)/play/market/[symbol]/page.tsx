import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { gameSnapshot } from "@/server/services/game-service";
import { portfolioSnapshot } from "@/server/services/trade-service";
import { prisma } from "@/server/db";
import { currency } from "@/domain/money";
import { analyzePrices } from "@/domain/market/analysis";
import { SpotOrderForm } from "@/components/game/spot-order-form";
import { ExchangeCandles } from "@/components/game/exchange-candles";
import { TokocryptoOrderBook } from "@/components/game/tokocrypto-orderbook";
import { TokocryptoConsole } from "@/components/game/tokocrypto-console";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/game/ui";
import { IconChevronLeft, IconCandles, IconCoin, IconWallet } from "@/components/icons";

export const instant = false;

const SECTOR_LABELS: Record<string, string> = {
  TECH: "Teknologi",
  HEALTH: "Kesehatan",
  ENERGY: "Energi",
  CONSUMER: "Konsumen",
  CRYPTO: "Kripto",
};

export default async function MarketDetailPage({
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

  const assets = await prisma.asset.findMany({ orderBy: { symbol: "asc" } });
  const asset = assets.find((a) => a.symbol === symbol);
  if (!asset) redirect("/play/market");

  const portfolio = await portfolioSnapshot(userId);
  const currentPoint = await prisma.pricePoint.findFirst({
    where: { gameId: game.gameId, assetId: asset.id },
    orderBy: { tick: "desc" },
  });
  const prevPoint = await prisma.pricePoint.findFirst({
    where: { gameId: game.gameId, assetId: asset.id, tick: { lt: game.tick } },
    orderBy: { tick: "desc" },
  });

  const currentPrice = currentPoint?.priceMinor ?? asset.fundamentalMinor;
  const prevPrice = prevPoint?.priceMinor ?? currentPrice;
  const change = currentPrice - prevPrice;
  const changePct =
    prevPrice > 0n
      ? Number(((currentPrice - prevPrice) * 10_000n) / prevPrice) / 100
      : 0;
  const isUp = change >= 0n;

  const history = await prisma.pricePoint.findMany({
    where: { gameId: game.gameId, assetId: asset.id },
    orderBy: { tick: "asc" },
    take: 240,
  });
  const points = (
    history.length > 0
      ? history
      : [{ tick: game.tick, priceMinor: currentPrice }]
  ).map((point) => ({ tick: point.tick, priceMinor: point.priceMinor }));
  const analysis = analyzePrices(points);

  const holding = portfolio?.holdings.find((h) => h.symbol === symbol);
  const openOrders = (portfolio?.pendingOrders ?? [])
    .filter((order) => order.symbol === symbol)
    .map((order) => ({
      id: order.id,
      symbol: order.symbol,
      side: order.side as "BUY" | "SELL",
      type: order.type as "MARKET" | "LIMIT",
      quantity: order.quantity,
      limitPriceMinor: order.limitPriceMinor,
    }));
  const recentTrades = (portfolio?.history ?? [])
    .filter((trade) => trade.symbol === symbol)
    .slice(0, 10)
    .map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side as "BUY" | "SELL",
      quantity: trade.quantity,
      priceMinor: trade.priceMinor,
      feeMinor: trade.feeMinor,
    }));
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
  const holdingQuantity = Object.fromEntries(
    (portfolio?.holdings ?? []).map((row) => [row.symbol, row.quantity]),
  );
  const markets = assets.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    priceMinor:
      row.id === asset.id
        ? currentPrice
        : (history.find((point) => point.assetId === row.id)?.priceMinor ??
          row.fundamentalMinor),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`${asset.kind === "CRYPTO" ? "Kripto" : "Saham"} · ${
          SECTOR_LABELS[asset.sector] ?? asset.sector
        }`}
        title={`${asset.symbol}/CR`}
        description={asset.name}
        back={
          <Link
            href="/play/market"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted transition hover:text-white"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            Kembali ke pasar
          </Link>
        }
        actions={
          <>
            <Link
              href="/play/wallet"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-[#c7ccd4] transition hover:border-brand/40 hover:text-brand"
            >
              <IconWallet className="h-3.5 w-3.5" />
              Tambah dana
            </Link>
            {asset.kind === "CRYPTO" ? (
              <Link
                href={`/play/crypto/${asset.symbol}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold text-gold transition hover:bg-gold/20"
              >
                <IconCoin className="h-3.5 w-3.5" />
                Terminal kripto
              </Link>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span
            className={`text-2xl font-black tabular-nums ${
              isUp ? "text-up" : "text-down"
            }`}
          >
            {currency(currentPrice)}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-black tabular-nums ${
              isUp ? "bg-up/10 text-up" : "bg-down/10 text-down"
            }`}
          >
            {isUp ? "+" : ""}
            {changePct.toFixed(2)}%
          </span>
        </div>
        <span className="text-[11px] text-muted">
          {change >= 0n ? "+" : ""}
          {currency(change)} pada tick #{game.tick}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] text-muted">
          <span>
            Tertinggi{" "}
            <strong className="tabular-nums text-up">{currency(analysis.highMinor)}</strong>
          </span>
          <span>
            Terendah{" "}
            <strong className="tabular-nums text-down">{currency(analysis.lowMinor)}</strong>
          </span>
          <span>
            Volatilitas{" "}
            <strong className="tabular-nums text-gold">
              {(analysis.volatilityBp / 100).toFixed(1)}%
            </strong>
          </span>
          <span>
            Fair value{" "}
            <strong className="tabular-nums text-brand">
              {currency(asset.fundamentalMinor)}
            </strong>
          </span>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Harga terakhir"
          value={currency(currentPrice)}
          tone={isUp ? "up" : "down"}
          hint={`Tick #${game.tick}`}
          icon={<IconCandles className="h-4 w-4" />}
        />
        <StatCard
          label="Perubahan"
          value={`${isUp ? "+" : ""}${changePct.toFixed(2)}%`}
          tone={isUp ? "up" : "down"}
          hint={currency(change)}
        />
        <StatCard
          label="Kepemilikan"
          value={holding ? `${holding.quantity.toLocaleString("en-US")} unit` : "0 unit"}
          hint={
            holding
              ? `${currency(holding.marketValueMinor)} nilai pasar`
              : "Belum memiliki aset ini"
          }
        />
        <StatCard
          label="Saldo tersedia"
          value={currency(game.cashMinor)}
          tone="brand"
          hint="Siap dipakai order"
        />
      </dl>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <ExchangeCandles points={points} symbol={asset.symbol} />

          <Panel>
            <PanelHeader
              title={`Tentang ${asset.symbol}`}
              subtitle={`${asset.name} · ${SECTOR_LABELS[asset.sector] ?? asset.sector}`}
            />
            <div className="grid gap-4 p-4 text-xs leading-6 text-muted sm:grid-cols-2">
              <p>
                <span className="font-bold text-white">{asset.symbol}</span> adalah
                instrumen simulasi dalam MarketLife Exchange. Harga bergerak
                setiap kali pasar dimajukan dan dipengaruhi volatilitas sektor{" "}
                <span className="font-bold text-[#c7ccd4]">
                  {SECTOR_LABELS[asset.sector] ?? asset.sector}
                </span>
                .
              </p>
              <p>
                Gunakan grafik candlestick, MA 5/20, dan buku pesanan untuk
                menentukan area masuk. Order market langsung tereksekusi,
                sedangkan limit menunggu di tick berikutnya.
              </p>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <SpotOrderForm
            markets={markets}
            defaultSymbol={asset.symbol}
            cashMinor={game.cashMinor}
            holdings={holdingQuantity}
          />
          <TokocryptoOrderBook
            currentPriceMinor={currentPrice}
            isUp={isUp}
            symbol={asset.symbol}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white">Konsol trading</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Pantau pesanan, kepemilikan, dan riwayat transaksi aset ini.
            </p>
          </div>
          <Link
            href="/play/portfolio"
            className="text-[10px] font-bold text-brand transition hover:text-brand-strong"
          >
            Buka portofolio →
          </Link>
        </div>
        <TokocryptoConsole
          positions={[]}
          openOrders={openOrders}
          holdings={holdingViews}
          tradeHistory={recentTrades}
          showFutures={false}
          holdingsLabel="Kepemilikan Saya"
          emptyHoldingsLabel={`Anda belum memiliki ${asset.symbol}.`}
          defaultTab="ORDERS"
        />
      </div>

      {!portfolio ? (
        <Panel>
          <EmptyState>
            Data portofolio belum tersedia untuk sesi ini. Muat ulang halaman
            atau buka kembali akun demo.
          </EmptyState>
        </Panel>
      ) : null}
    </div>
  );
}
