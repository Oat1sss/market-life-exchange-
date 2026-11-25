import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import {
  portfolioSnapshot,
  type HoldingRow,
  type PortfolioSnapshot,
} from "@/server/services/trade-service";
import { gameSnapshot } from "@/server/services/game-service";
import { futuresSnapshot } from "@/server/services/futures-service";
import { forexSnapshot } from "@/server/services/forex-service";
import { PositionsTable } from "@/components/game/positions-table";
import { currency } from "@/domain/money";
import { SpotOrderForm } from "@/components/game/spot-order-form";
import { Sparkline, type ChartPoint } from "@/components/game/price-chart";
import { CancelOrderButton } from "@/components/game/cancel-order-button";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  SideBadge,
  StatCard,
  StatusBadge,
} from "@/components/game/ui";
import {
  IconArrowRight,
  IconCandles,
  IconChartUp,
  IconPie,
  IconWallet,
} from "@/components/icons";
import { prisma } from "@/server/db";

export const instant = false;

export default async function PortfolioPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await gameSnapshot(userId);
  if (!game) redirect("/play/new");

  const [portfolio, futures, forex] = await Promise.all([
    portfolioSnapshot(userId),
    futuresSnapshot(userId),
    forexSnapshot(userId),
  ]);
  const forexHoldings = forex?.holdings ?? [];
  const forexValue = forex?.holdingsValueMinor ?? 0n;
  const forexUnrealized = forexHoldings.reduce(
    (sum, holding) => sum + holding.unrealizedMinor,
    0n,
  );
  const futuresPositions = futures?.positions ?? [];
  const futuresEquity = futures?.equityMinor ?? 0n;
  const futuresUnrealized = futures?.unrealizedMinor ?? 0n;
  const holdings = portfolio?.holdings ?? [];
  const pendingOrders = portfolio?.pendingOrders ?? [];
  const history = portfolio?.history ?? [];

  const assets = await prisma.asset.findMany({ orderBy: { symbol: "asc" } });
  const points = await prisma.pricePoint.findMany({
    where: { gameId: game.gameId, tick: game.tick },
  });
  const priceByAsset = new Map(points.map((point) => [point.assetId, point.priceMinor]));
  const markets = assets.map((asset) => ({
    symbol: asset.symbol,
    name: asset.name,
    priceMinor: priceByAsset.get(asset.id) ?? asset.fundamentalMinor,
  }));
  const holdingQuantity = Object.fromEntries(
    holdings.map((holding) => [holding.symbol, holding.quantity]),
  );

  const assetIdBySymbol = new Map(assets.map((asset) => [asset.symbol, asset.id]));
  const sparkBySymbol = new Map<string, ChartPoint[]>();
  for (const holding of holdings) {
    const assetId = assetIdBySymbol.get(holding.symbol);
    const series = assetId ? portfolio?.priceHistory.get(assetId) : undefined;
    if (series && series.length > 1) sparkBySymbol.set(holding.symbol, series);
  }

  const cashMinor = portfolio?.cashMinor ?? game.cashMinor;
  const holdingsValue = portfolio?.holdingsValueMinor ?? 0n;
  const assetValue = holdingsValue + forexValue;
  const netWorth = cashMinor + assetValue + futuresEquity;
  const unrealized =
    holdings.reduce((sum, holding) => sum + holding.unrealizedMinor, 0n) +
    futuresUnrealized +
    forexUnrealized;
  const allocation =
    netWorth > 0n ? Number((assetValue * 10_000n) / netWorth) / 100 : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Akun demo · Portofolio spot"
        title="Portofolio saya"
        description={`Ringkasan aset, order aktif, dan riwayat transaksi. Pasar ke-${game.tick} · ${game.date}.`}
        actions={
          <>
            <Link
              href="/play/market"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-[#c7ccd4] transition hover:border-brand/40 hover:text-brand"
            >
              <IconCandles className="h-3.5 w-3.5" />
              Jelajahi pasar
            </Link>
            <Link
              href="/play/wallet"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
            >
              <IconWallet className="h-3.5 w-3.5" />
              Tambah dana
            </Link>
          </>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total ekuitas"
          value={currency(netWorth)}
          tone="brand"
          hint={`${holdings.length} aset · ${forexHoldings.length} valas · ${futuresPositions.length} futures · ${pendingOrders.length} order aktif`}
          icon={<IconPie className="h-4 w-4" />}
        />
        <StatCard
          label="Saldo tunai"
          value={currency(cashMinor)}
          hint="Siap dipakai order spot"
          icon={<IconWallet className="h-4 w-4" />}
        />
        <StatCard
          label="Nilai aset"
          value={currency(assetValue)}
          hint={`${allocation.toFixed(2)}% dari ekuitas`}
          icon={<IconCandles className="h-4 w-4" />}
        />
        <StatCard
          label="Unrealized P&L"
          value={`${unrealized > 0n ? "+" : ""}${currency(unrealized)}`}
          tone={unrealized > 0n ? "up" : unrealized < 0n ? "down" : "default"}
          hint="Spot dan futures terhadap harga masuk"
          icon={<IconChartUp className="h-4 w-4" />}
        />
      </dl>

      <Panel>
        <PanelHeader
          title="Alokasi portofolio"
          subtitle={`Aset ${allocation.toFixed(2)}% · Kas ${(100 - allocation).toFixed(2)}%`}
          action={
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Tick #{game.tick}
            </span>
          }
        />
        <div className="space-y-2.5 p-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-brand transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, allocation))}%` }}
            />
            <div
              className="h-full bg-gold/80 transition-all duration-500"
              style={{ width: `${Math.max(0, 100 - allocation)}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand" />
              Aset {currency(assetValue)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gold/80" />
              Kas {currency(cashMinor)}
            </span>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Kepemilikan"
              subtitle="Harga mark mengikuti tick pasar terakhir"
              action={
                <Link
                  href="/play/market"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-brand transition hover:text-brand-strong"
                >
                  Tambah aset
                  <IconArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <HoldingsTable holdings={holdings} sparks={sparkBySymbol} />
          </Panel>

          <Panel>
            <PanelHeader
              title="Posisi futures"
              subtitle={`Ekuitas margin ${currency(futuresEquity)} · unrealized ${futuresUnrealized > 0n ? "+" : ""}${currency(futuresUnrealized)}`}
              action={
                <Link
                  href="/play/crypto"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-gold transition hover:text-gold/80"
                >
                  Buka terminal
                  <IconArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <div className="p-4">
              <PositionsTable positions={futuresPositions} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Posisi valas"
              subtitle={`${forexHoldings.length} mata uang · nilai ${currency(forexValue)} · unrealized ${forexUnrealized > 0n ? "+" : ""}${currency(forexUnrealized)}`}
              action={
                <Link
                  href="/play/forex"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-gold transition hover:text-gold/80"
                >
                  Tukar valas
                  <IconArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5 font-semibold">Mata uang</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Unit</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Kurs rata-rata</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Kurs kini</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Nilai</th>
                    <th className="px-4 py-2.5 text-right font-semibold">P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {forexHoldings.map((holding) => {
                    const up = holding.unrealizedMinor >= 0n;
                    return (
                      <tr key={holding.currency} className="transition hover:bg-surface-2/40">
                        <td className="px-4 py-3">
                          <span className="font-bold text-white">{holding.currency}</span>
                          <span className="ml-1.5 text-[10px] text-[#5e6673]">
                            {holding.pair}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                          {holding.units.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted">
                          {currency(holding.averageRateMinor)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-white">
                          {currency(holding.currentRateMinor)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-white">
                          {currency(holding.valueMinor)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold tabular-nums ${
                            up ? "text-up" : "text-down"
                          }`}
                        >
                          {up ? "+" : ""}
                          {currency(holding.unrealizedMinor)}
                        </td>
                      </tr>
                    );
                  })}
                  {forexHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6">
                        <EmptyState>
                          Belum ada saldo valas. Beli dolar atau mata uang lain
                          di halaman forex.
                        </EmptyState>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Order terbuka"
              subtitle="Order limit menunggu harga target di tick berikutnya"
            />
            <OrdersTable orders={pendingOrders} />
          </Panel>

          <Panel>
            <PanelHeader
              title="Riwayat transaksi"
              subtitle="25 transaksi terakhir di akun ini"
            />
            <TradesTable trades={history} />
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <SpotOrderForm
            markets={markets}
            cashMinor={cashMinor}
            holdings={holdingQuantity}
          />

          <Panel className="overflow-hidden">
            <div className="border-b border-line bg-gradient-to-r from-gold/10 to-transparent px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#c7ccd4]">
                Catatan portofolio
              </h2>
            </div>
            <div className="space-y-3 p-4 text-[11px] leading-5 text-muted">
              <p>
                <span className="font-bold text-up">Unrealized P&L</span> menghitung
                selisih nilai pasar dengan harga rata-rata beli, belum termasuk
                biaya transaksi.
              </p>
              <p>
                Order <span className="font-bold text-gold">limit</span> dapat
                dibatalkan kapan saja sebelum tereksekusi. Dana tidak terkunci
                saat order dibuat.
              </p>
              <p>
                Jual aset lewat panel order di samping, atau buka halaman aset
                untuk grafik candlestick dan analisis lengkap.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function HoldingsTable({
  holdings,
  sparks,
}: {
  holdings: HoldingRow[];
  sparks: Map<string, ChartPoint[]>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2.5 font-semibold">Aset</th>
            <th className="px-3 py-2.5 text-right font-semibold">Jumlah</th>
            <th className="px-3 py-2.5 text-right font-semibold">Rata-rata</th>
            <th className="px-3 py-2.5 text-right font-semibold">Harga mark</th>
            <th className="px-3 py-2.5 text-right font-semibold">Nilai pasar</th>
            <th className="px-3 py-2.5 text-right font-semibold">P&amp;L</th>
            <th className="hidden px-4 py-2.5 text-right font-semibold lg:table-cell">
              Tren
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {holdings.map((holding) => {
            const up = holding.unrealizedMinor >= 0n;
            const series = sparks.get(holding.symbol);
            return (
              <tr key={holding.symbol} className="transition hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <Link
                    href={`/play/market/${holding.symbol}`}
                    className="flex items-center gap-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/12 text-[10px] font-black text-brand">
                      {holding.symbol.slice(0, 2)}
                    </span>
                    <span>
                      <span className="block font-bold text-white">
                        {holding.symbol}
                      </span>
                      <span className="block text-[10px] uppercase text-[#5e6673]">
                        {holding.name}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                  {holding.quantity.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted">
                  {currency(holding.avgCostMinor)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-white">
                  {currency(holding.currentPriceMinor)}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-white">
                  {currency(holding.marketValueMinor)}
                </td>
                <td
                  className={`px-3 py-3 text-right font-bold tabular-nums ${
                    up ? "text-up" : "text-down"
                  }`}
                >
                  {up ? "+" : ""}
                  {currency(holding.unrealizedMinor)}
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  {series ? (
                    <div className="ml-auto w-24">
                      <Sparkline
                        points={series}
                        id={`portfolio-${holding.symbol}`}
                        positive={up}
                      />
                    </div>
                  ) : (
                    <span className="block text-right text-[10px] text-[#5e6673]">
                      —
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {holdings.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6">
                <EmptyState>
                  Belum ada kepemilikan. Pilih aset di panel order untuk membuat
                  transaksi pertama.
                </EmptyState>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ orders }: { orders: PortfolioSnapshot["pendingOrders"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2.5 font-semibold">Pasangan</th>
            <th className="px-3 py-2.5 font-semibold">Sisi</th>
            <th className="px-3 py-2.5 font-semibold">Tipe</th>
            <th className="px-3 py-2.5 text-right font-semibold">Harga limit</th>
            <th className="px-3 py-2.5 text-right font-semibold">Jumlah</th>
            <th className="px-3 py-2.5 text-center font-semibold">Status</th>
            <th className="px-4 py-2.5 text-right font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {orders.map((order) => (
            <tr key={order.id} className="transition hover:bg-surface-2/40">
              <td className="px-4 py-3">
                <span className="font-bold text-white">{order.symbol}</span>
                <span className="ml-1.5 text-[10px] text-[#5e6673]">/IDR</span>
              </td>
              <td className="px-3 py-3">
                <SideBadge side={order.side} />
              </td>
              <td className="px-3 py-3 text-[#c7ccd4]">
                {order.type === "LIMIT" ? "Limit" : "Market"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-white">
                {order.limitPriceMinor != null
                  ? currency(order.limitPriceMinor)
                  : "—"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                {order.quantity.toLocaleString("en-US")}
              </td>
              <td className="px-3 py-3 text-center">
                <StatusBadge status="PENDING" />
              </td>
              <td className="px-4 py-3 text-right">
                <CancelOrderButton orderId={order.id} />
              </td>
            </tr>
          ))}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6">
                <EmptyState>
                  Tidak ada order terbuka. Order limit yang belum tereksekusi
                  akan muncul di sini.
                </EmptyState>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TradesTable({ trades }: { trades: PortfolioSnapshot["history"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2.5 font-semibold">Waktu</th>
            <th className="px-3 py-2.5 font-semibold">Pasangan</th>
            <th className="px-3 py-2.5 font-semibold">Sisi</th>
            <th className="px-3 py-2.5 font-semibold">Tipe</th>
            <th className="px-3 py-2.5 text-right font-semibold">Jumlah</th>
            <th className="px-3 py-2.5 text-right font-semibold">Harga</th>
            <th className="px-3 py-2.5 text-right font-semibold">Biaya</th>
            <th className="px-3 py-2.5 text-right font-semibold">Total</th>
            <th className="px-4 py-2.5 text-center font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {trades.map((trade) => (
            <tr key={trade.id} className="transition hover:bg-surface-2/40">
              <td className="px-4 py-3 tabular-nums text-muted">
                #{trade.tickResolved ?? trade.tickPlaced}
              </td>
              <td className="px-3 py-3 font-bold text-white">{trade.symbol}</td>
              <td className="px-3 py-3">
                <SideBadge side={trade.side} />
              </td>
              <td className="px-3 py-3 text-[#c7ccd4]">
                {trade.type === "LIMIT" ? "Limit" : "Market"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                {trade.quantity.toLocaleString("en-US")}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-white">
                {trade.fillPriceMinor != null
                  ? currency(trade.fillPriceMinor)
                  : trade.limitPriceMinor != null
                    ? currency(trade.limitPriceMinor)
                    : "—"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-muted">
                {currency(trade.feeMinor)}
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-white">
                {trade.netMinor != null ? currency(trade.netMinor) : "—"}
              </td>
              <td className="px-4 py-3 text-center">
                <StatusBadge status={trade.status} />
              </td>
            </tr>
          ))}
          {trades.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-6">
                <EmptyState>
                  Belum ada transaksi. Order pertama Anda akan tercatat di sini.
                </EmptyState>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
