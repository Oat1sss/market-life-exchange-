import { prisma } from "@/server/db";
import { currency } from "@/domain/money";

interface TickerRow {
  symbol: string;
  priceMinor: bigint;
  changePct: number;
}

export async function MarketTicker({
  gameId,
  tick,
}: {
  gameId: string;
  tick: number;
}) {
  const assets = await prisma.asset.findMany({
    orderBy: { symbol: "asc" },
    take: 18,
  });

  const [current, previous] = await Promise.all([
    prisma.pricePoint.findMany({
      where: { gameId, tick, assetId: { in: assets.map((asset) => asset.id) } },
    }),
    tick > 0
      ? prisma.pricePoint.findMany({
          where: {
            gameId,
            tick: tick - 1,
            assetId: { in: assets.map((asset) => asset.id) },
          },
        })
      : Promise.resolve([]),
  ]);

  const currentMap = new Map(current.map((point) => [point.assetId, point.priceMinor]));
  const previousMap = new Map(previous.map((point) => [point.assetId, point.priceMinor]));

  const rows: TickerRow[] = assets.map((asset) => {
    const priceMinor = currentMap.get(asset.id) ?? asset.fundamentalMinor;
    const prevMinor = previousMap.get(asset.id) ?? priceMinor;
    return {
      symbol: asset.symbol,
      priceMinor,
      changePct:
        prevMinor > 0n
          ? (Number(priceMinor - prevMinor) / Number(prevMinor)) * 100
          : 0,
    };
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-line bg-[#0a0d10]">
      <div className="mx-auto flex w-full max-w-[1440px] items-center px-4">
        <span className="mr-3 hidden shrink-0 items-center gap-1.5 border-r border-line pr-3 text-[10px] font-black uppercase tracking-[0.16em] text-brand sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(0,192,135,0.9)]" />
          Pasar
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex w-max items-center">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex items-center"
                aria-hidden={copy === 1 ? true : undefined}
              >
                {rows.map((row) => {
                  const up = row.changePct >= 0;
                  return (
                    <span
                      key={`${copy}-${row.symbol}`}
                      className="flex shrink-0 items-center gap-2 whitespace-nowrap border-r border-line/60 px-4 py-2 text-[11px]"
                    >
                      <span className="font-bold text-[#c7ccd4]">{row.symbol}</span>
                      <span className="tabular-nums text-white">
                        {currency(row.priceMinor)}
                      </span>
                      <span
                        className={`font-bold tabular-nums ${
                          up ? "text-up" : "text-down"
                        }`}
                      >
                        {up ? "+" : ""}
                        {row.changePct.toFixed(2)}%
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
