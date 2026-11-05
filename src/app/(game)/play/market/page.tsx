import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";

export const instant = false;
import { portfolioSnapshot, type HoldingRow } from "@/server/services/trade-service";
import { gameSnapshot } from "@/server/services/game-service";
import { currency } from "@/domain/money";
import TradeForm from "@/components/game/trade-form";
import { prisma } from "@/server/db";



export default async function MarketPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await gameSnapshot(userId);
  if (!game) redirect("/play/new");

  const portfolio = await portfolioSnapshot(userId);
  const assets = await loadAssetsForGame(game.gameId, game.tick);

  return (
    <>
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
          <p className="mt-1 text-sm text-muted">
            Month {game.tick} · Cash available: {currency(game.cashMinor)}
          </p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Asset prices
        </h2>
        <AssetGrid assets={assets} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
            Place an order
          </h2>
          <TradeForm symbols={assets.map((a) => a.symbol)} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
            My holdings
          </h2>
          <HoldingsList holdings={portfolio?.holdings ?? []} />
        </section>
      </div>
    </>
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
    const changeMinor = priceMinor - prevMinor;
    return {
      symbol: asset.symbol,
      name: asset.name,
      sector: asset.sector,
      kind: asset.kind,
      priceMinor,
      changeMinor,
    };
  });
}

function AssetGrid({
  assets,
}: {
  assets: {
    readonly symbol: string;
    readonly name: string;
    readonly sector: string;
    readonly kind: string;
    readonly priceMinor: bigint;
    readonly changeMinor: bigint;
  }[];
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((asset) => (
        <AssetRow key={asset.symbol} asset={asset} />
      ))}
    </ul>
  );
}

function AssetRow({
  asset,
}: {
  asset: {
    readonly symbol: string;
    readonly name: string;
    readonly sector: string;
    readonly kind: string;
    readonly priceMinor: bigint;
    readonly changeMinor: bigint;
  };
}) {
  return (
    <li className="rounded border border-border-subtle bg-background p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{asset.symbol}</span>
        <span className="text-xs uppercase tracking-wider text-muted">{asset.sector}</span>
      </div>
      <div className="text-xs text-muted truncate">{asset.name}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-xl font-medium tabular-nums">
          {currency(asset.priceMinor)}
        </span>
        <span
          className={`text-sm tabular-nums font-medium ${
            asset.changeMinor > 0n
              ? "text-green-700"
              : asset.changeMinor < 0n
                ? "text-red-700"
                : "text-muted"
          }`}
        >
          {asset.changeMinor > 0n ? "+" : ""}
          {currency(asset.changeMinor)}
        </span>
      </div>
    </li>
  );
}

function HoldingsList({ holdings }: { holdings: HoldingRow[] }) {
  return (
    <ul className="space-y-2">
      {holdings.map((h) => (
        <li
          key={h.symbol}
          className="rounded border border-border-subtle bg-background p-3 text-sm"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">{h.symbol}</span>
            <span className="text-muted tabular-nums">
              {h.quantity.toLocaleString("en-US")} shares
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-xs">
            <span className="text-muted">Avg cost</span>
            <span className="tabular-nums">{currency(h.avgCostMinor)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-xs">
            <span className="text-muted">Current</span>
            <span className="tabular-nums">{currency(h.currentPriceMinor)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-muted text-xs">Value</span>
            <span className="tabular-nums font-medium">
              {currency(h.marketValueMinor)}
            </span>
          </div>
        </li>
      ))}
      {holdings.length === 0 && (
        <li className="rounded border border-dashed border-border-subtle p-4 text-center text-sm text-muted">
          No holdings yet.
        </li>
      )}
    </ul>
  );
}
