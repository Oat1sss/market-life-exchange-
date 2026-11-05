import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { gameSnapshot } from "@/server/services/game-service";
import { portfolioSnapshot } from "@/server/services/trade-service";
import { prisma } from "@/server/db";
import { currency } from "@/domain/money";
import TradeForm from "@/components/game/trade-form";

export const instant = false;

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

  return (
    <>
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{asset.symbol}</h1>
            <span className="text-sm uppercase tracking-wider text-muted">{asset.sector}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{asset.name}</p>
        </div>
        <div className="text-right tabular-nums">
          <div className="text-2xl font-medium">{currency(currentPrice)}</div>
          <div
            className={`text-sm font-medium ${
              change > 0n
                ? "text-green-700"
                : change < 0n
                  ? "text-red-700"
                  : "text-muted"
            }`}
          >
            {change > 0n ? "+" : ""}
            {currency(change)} today
          </div>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Order
        </h2>
        {portfolio ? (
          <TradeForm symbols={[asset.symbol]} />
        ) : (
          <p className="rounded border border-border-subtle bg-background p-4 text-sm text-muted">
            No active game found for this session.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          My holding
        </h2>
        {portfolio && portfolio.holdings.find((h) => h.symbol === asset.symbol) ? (
          <HoldingLine holding={portfolio.holdings.find((h) => h.symbol === asset.symbol)!} />
        ) : (            <p className="rounded border border-border-subtle bg-background p-4 text-sm text-muted">
            You do not hold {asset.symbol} yet.
          </p>
        )}

        {!portfolio && (
          <p className="rounded border border-border-subtle bg-background p-4 text-sm text-muted">
            No active game found for this session.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Open orders
        </h2>
        {portfolio && (
          <OrdersList
            orders={portfolio.pendingOrders.filter((o) => o.symbol === asset.symbol)}
          />
        )}

        {!portfolio && (
          <p className="rounded border border-border-subtle bg-background p-4 text-sm text-muted">
            No active game found for this session.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Recent trades
        </h2>
        {portfolio && (
          <TradesList
            trades={portfolio.history.filter((t) => t.symbol === asset.symbol).slice(0, 10)}
          />
        )}

        {!portfolio && (
          <p className="rounded border border-border-subtle bg-background p-4 text-sm text-muted">
            No active game found for this session.
          </p>
        )}
      </section>
    </>
  );
}

function HoldingLine({ holding }: { holding: { symbol: string; quantity: number; avgCostMinor: bigint; currentPriceMinor: bigint; marketValueMinor: bigint } }) {
  const qty = BigInt(holding.quantity);
  const pnl = holding.marketValueMinor - holding.avgCostMinor * qty;
  return (
    <ul className="space-y-2">
      <li className="rounded border border-border-subtle bg-background p-3 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">{holding.symbol}</span>
          <span className="tabular-nums text-muted">
            {holding.quantity.toLocaleString("en-US")} shares
          </span>
        </div>
        <div className="mt-1 grid gap-x-4 grid-cols-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">Avg cost</span>
            <span className="tabular-nums">{currency(holding.avgCostMinor)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Current</span>
            <span className="tabular-nums">{currency(holding.currentPriceMinor)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Value</span>
            <span className="tabular-nums font-medium">{currency(holding.marketValueMinor)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">P&amp;L</span>
            <span className={`tabular-nums font-medium ${pnl >= 0n ? "text-green-700" : "text-red-700"}`}>
              {pnl >= 0n ? "+" : ""}
              {currency(pnl)}
            </span>
          </div>
        </div>
      </li>
    </ul>
  );
}

function OrdersList({ orders }: { orders: Array<{ id: string; symbol: string; side: "BUY" | "SELL"; type: "MARKET" | "LIMIT"; quantity: number; limitPriceMinor: bigint | null; filled: boolean }> }) {
  return (
    <ul className="space-y-2">
      {orders.map((o) => (
        <li
          key={o.id}
          className="rounded border border-border-subtle bg-background p-3 text-sm"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs text-muted">{o.id.slice(0, 8)}</span>
            <span
              className={`text-xs font-medium ${
                o.side === "BUY" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {o.side}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-muted">{o.type}</span>
            <span className="tabular-nums">{o.quantity.toLocaleString("en-US")} shares</span>
          </div>
          {o.limitPriceMinor != null && (
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-muted">Limit</span>
              <span className="tabular-nums">{currency(o.limitPriceMinor)}</span>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-muted text-xs">Status</span>
            <span className={`text-xs ${o.filled ? "text-green-700" : "text-amber-700"}`}>
              {o.filled ? "Filled" : "Pending"}
            </span>
          </div>
        </li>
      ))}
      {orders.length === 0 && (
        <li className="rounded border border-dashed border-border-subtle p-4 text-center text-sm text-muted">
          No open orders for this asset.
        </li>
      )}
    </ul>
  );
}

function TradesList({ trades }: { trades: Array<{ id: string; symbol: string; side: "BUY" | "SELL"; quantity: number; priceMinor: bigint; feeMinor: bigint; createdAt: number }> }) {
  return (
    <ul className="space-y-2">
      {trades.map((t) => {
        const total = BigInt(t.quantity) * t.priceMinor + t.feeMinor;
        return (
          <li
            key={t.id}
            className="rounded border border-border-subtle bg-background p-3 text-sm"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs text-muted">{t.id.slice(0, 8)}</span>
              <span
                className={`text-xs font-medium ${
                  t.side === "BUY" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {t.side}
              </span>
            </div>
            <div className="mt-1 grid gap-x-4 grid-cols-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Qty</span>
                <span className="tabular-nums">{t.quantity.toLocaleString("en-US")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Price</span>
                <span className="tabular-nums">{currency(t.priceMinor)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Fee</span>
                <span className="tabular-nums">{currency(t.feeMinor)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total</span>
                <span className="tabular-nums font-medium">{currency(total)}</span>
              </div>
            </div>
          </li>
        );
      })}
      {trades.length === 0 && (
        <li className="rounded border border-dashed border-border-subtle p-4 text-center text-sm text-muted">
          No trades for this asset yet.
        </li>
      )}
    </ul>
  );
}
