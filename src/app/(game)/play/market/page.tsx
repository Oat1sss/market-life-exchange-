import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import {
  portfolioSnapshot,
  type HoldingRow,
} from "@/server/services/trade-service";
import { gameSnapshot } from "@/server/services/game-service";
import { currency } from "@/domain/money";
import { MarketTable } from "@/components/game/market-table";
import { SpotOrderForm } from "@/components/game/spot-order-form";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/game/ui";
import { IconBolt, IconCandles, IconCoin, IconWallet } from "@/components/icons";
import { prisma } from "@/server/db";

export const instant = false;

export default async function MarketPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await gameSnapshot(userId);
  if (!game) redirect("/play/new");

  const portfolio = await portfolioSnapshot(userId);
  const assets = await loadAssetsForGame(game.gameId, game.tick);
  const cryptoCount = assets.filter((asset) => asset.kind === "CRYPTO").length;
  const stockCount = assets.length - cryptoCount;
  const holdings = portfolio?.holdings ?? [];
  const holdingQuantity = Object.fromEntries(
    holdings.map((holding) => [holding.symbol, holding.quantity]),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pasar spot"
        title="Jelajahi pasar"
        description={`${assets.length} instrumen diperdagangkan · ${cryptoCount} kripto · ${stockCount} saham fiksi. Saldo tersedia ${currency(game.cashMinor)}.`}
        actions={
          <>
            <Link
              href="/play/crypto"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold text-gold transition hover:bg-gold/20"
            >
              <IconBolt className="h-3.5 w-3.5" />
              Terminal kripto
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
          label="Total instrumen"
          value={assets.length}
          hint="Spot saham & kripto"
          icon={<IconCandles className="h-4 w-4" />}
        />
        <StatCard
          label="Pasar kripto"
          value={cryptoCount}
          hint="Terminal spot + futures"
          tone="gold"
          icon={<IconCoin className="h-4 w-4" />}
        />
        <StatCard
          label="Saham fiksi"
          value={stockCount}
          hint="Empat sektor"
          tone="brand"
          icon={<IconCandles className="h-4 w-4" />}
        />
        <StatCard
          label="Saldo tersedia"
          value={currency(game.cashMinor)}
          hint="Siap dipakai order"
          icon={<IconWallet className="h-4 w-4" />}
        />
      </dl>

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white">Watchlist pasar</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Filter kripto atau saham, lalu buka halaman aset untuk grafik dan order.
            </p>
          </div>
          <span className="rounded border border-line bg-surface px-2 py-1 text-[10px] font-bold text-muted">
            Data tick #{game.tick}
          </span>
        </div>
        <MarketTable rows={assets} />
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SpotOrderForm
            markets={assets.map((asset) => ({
              symbol: asset.symbol,
              name: asset.name,
              priceMinor: asset.priceMinor,
            }))}
            cashMinor={game.cashMinor}
            holdings={holdingQuantity}
          />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <Panel>
            <PanelHeader
              title="Kepemilikan"
              subtitle={`${holdings.length} aset di portofolio`}
              action={
                <Link
                  href="/play/portfolio"
                  className="text-[10px] font-bold text-brand transition hover:text-brand-strong"
                >
                  Semua →
                </Link>
              }
            />
            <HoldingsList holdings={holdings.slice(0, 6)} />
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-line bg-gradient-to-r from-brand/10 to-transparent px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#c7ccd4]">
                Cara order
              </h2>
            </div>
            <div className="space-y-3 p-4 text-[11px] leading-5 text-muted">
              <p>
                <span className="font-bold text-up">Market</span> mengeksekusi
                order langsung pada harga terakhir. Cocok untuk masuk atau keluar
                cepat.
              </p>
              <p>
                <span className="font-bold text-gold">Limit</span> menyimpan
                order sampai harga target tercapai pada tick pasar berikutnya.
                Order bisa dibatalkan dari halaman portofolio.
              </p>
              <p>
                Setiap transaksi dikenakan biaya simulasi 0,1% dan tercatat di
                ledger akun.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

async function loadAssetsForGame(gameId: string, tick: number) {
  const assets = await prisma.asset.findMany({
    orderBy: { symbol: "asc" },
  });
  const currentPoints = await prisma.pricePoint.findMany({
    where: { gameId, tick },
  });
  const prevPoints =
    tick > 0
      ? await prisma.pricePoint.findMany({
          where: { gameId, tick: tick - 1 },
        })
      : [];

  const currentMap = new Map(currentPoints.map((p) => [p.assetId, p.priceMinor]));
  const prevMap = new Map(prevPoints.map((p) => [p.assetId, p.priceMinor]));

  return assets.map((asset) => {
    const priceMinor = currentMap.get(asset.id) ?? asset.fundamentalMinor;
    const prevMinor = prevMap.get(asset.id) ?? priceMinor;
    return {
      symbol: asset.symbol,
      name: asset.name,
      sector: asset.sector,
      kind: asset.kind,
      priceMinor,
      prevPriceMinor: prevMinor,
    };
  });
}

function HoldingsList({ holdings }: { holdings: HoldingRow[] }) {
  if (holdings.length === 0) {
    return (
      <div className="p-4">
        <EmptyState>
          Belum ada kepemilikan. Pilih aset di atas untuk membuat order pertama.
        </EmptyState>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line/70">
      {holdings.map((holding) => {
        const up = holding.unrealizedMinor >= 0n;
        return (
          <li
            key={holding.symbol}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-line-soft text-[10px] font-black text-[#c7ccd4]">
                {holding.symbol.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">{holding.symbol}</div>
                <div className="truncate text-[10px] text-muted">
                  {holding.quantity.toLocaleString("en-US")} unit · {holding.name}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-bold tabular-nums text-white">
                {currency(holding.marketValueMinor)}
              </div>
              <div
                className={`text-[10px] font-bold tabular-nums ${
                  up ? "text-up" : "text-down"
                }`}
              >
                {up ? "+" : ""}
                {currency(holding.unrealizedMinor)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
