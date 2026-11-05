import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";

export const instant = false;
import { portfolioSnapshot, type HoldingRow, type PortfolioSnapshot } from "@/server/services/trade-service";
import { gameSnapshot } from "@/server/services/game-service";
import { currency } from "@/domain/money";
import TradeForm from "@/components/game/trade-form";
import { prisma } from "@/server/db";



export default async function PortfolioPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await gameSnapshot(userId);
  if (!game) redirect("/play/new");

  const portfolio = await portfolioSnapshot(userId);
  const allAssets = await prisma.asset.findMany({
    select: { symbol: true },
    orderBy: { symbol: "asc" },
  });
  const symbols = allAssets.map((a) => a.symbol);

  return (
    <>
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-sm text-muted">
            Month {game.tick} · Portfolio value: {currency(portfolio?.portfolioValue ?? 0n)} · Cash: {currency(portfolio?.cashMinor ?? 0n)}
          </p>
        </div>
      </header>

      {/* Holdings Section */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Current Holdings
        </h2>
        <HoldingsTable holdings={portfolio?.holdings ?? []} />
      </section>

      {/* Open Orders Section */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Open Orders (Resting Limits)
        </h2>
        <OrdersTable orders={portfolio?.pendingOrders ?? []} />
      </section>

      {/* Trade History Section */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Trade History
        </h2>
        <TradesTable trades={portfolio?.history ?? []} />
      </section>

      {/* Order Placement Form */}
      <section className="rounded border border-border-subtle bg-background p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Place an order
        </h2>
        <TradeForm symbols={symbols} />
      </section>
    </>
  );
}

function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-foreground/[0.02]">
            <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-muted">Symbol</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-muted">Name</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Shares</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Avg cost</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Mark</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Value</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Unrealized P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            return (
              <tr key={h.symbol} className="border-b border-border-subtle/50 hover:bg-foreground/[0.01]">
                <td className="px-4 py-2 font-medium">{h.symbol}</td>
                <td className="px-4 py-2 text-muted">{h.name}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {h.quantity.toLocaleString("en-US")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {currency(h.avgCostMinor)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {currency(h.currentPriceMinor)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">
                  {currency(h.marketValueMinor)}
                </td>
                <td
                  className={`px-4 py-2 text-right tabular-nums font-medium ${
                    h.unrealizedMinor > 0n
                      ? "text-green-700"
                      : h.unrealizedMinor < 0n
                        ? "text-red-700"
                        : "text-muted"
                  }`}
                >
                  {h.unrealizedMinor > 0n ? "+" : ""}
                  {currency(h.unrealizedMinor)}
                </td>
              </tr>
            );
          })}
          {holdings.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                No active holdings. Buy assets on the market page.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({
  orders,
}: {
  orders: PortfolioSnapshot["pendingOrders"];
}) {
  return (
    <div className="overflow-x-auto rounded border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-foreground/[0.02]">
            <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-muted">Order ID</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-muted">Symbol</th>
            <th className="px-4 py-2 text-center text-xs uppercase tracking-widest text-muted">Side</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Type</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Qty</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Limit Price</th>
            <th className="px-4 py-2 text-center text-xs uppercase tracking-widest text-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border-subtle/50">
              <td className="px-4 py-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
              <td className="px-4 py-2 font-medium">{o.symbol}</td>
              <td className="px-4 py-2 text-center">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    o.side === "BUY" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {o.side}
                </span>
              </td>
              <td className="px-4 py-2 text-right">{o.type}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {o.quantity.toLocaleString("en-US")}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {o.limitPriceMinor != null ? currency(o.limitPriceMinor) : "—"}
              </td>
              <td className="px-4 py-2 text-center">
                <span className="text-xs font-medium text-amber-700">Pending</span>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-4 text-center text-sm text-muted">
                No open resting orders.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TradesTable({
  trades,
}: {
  trades: PortfolioSnapshot["history"];
}) {
  return (
    <div className="overflow-x-auto rounded border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-foreground/[0.02]">
            <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-muted">Trade ID</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-muted">Symbol</th>
            <th className="px-4 py-2 text-center text-xs uppercase tracking-widest text-muted">Side</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Type</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Qty</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Fill Price</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Fee</th>
            <th className="px-4 py-2 text-right text-xs uppercase tracking-widest text-muted">Net Total</th>
            <th className="px-4 py-2 text-center text-xs uppercase tracking-widest text-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            return (
              <tr key={t.id} className="border-b border-border-subtle/50">
                <td className="px-4 py-2 font-mono text-xs">{t.id.slice(0, 8)}</td>
                <td className="px-4 py-2 font-medium">{t.symbol}</td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.side === "BUY" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {t.side}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{t.type}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {t.quantity.toLocaleString("en-US")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {t.fillPriceMinor != null ? currency(t.fillPriceMinor) : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted">
                  {currency(t.feeMinor)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">
                  {t.netMinor != null ? currency(t.netMinor) : "—"}
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`text-xs font-medium ${
                      t.status === "FILLED"
                        ? "text-emerald-700"
                        : t.status === "CANCELLED"
                          ? "text-muted"
                          : "text-red-700"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
              </tr>
            );
          })}
          {trades.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-4 text-center text-sm text-muted">
                No trades yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
