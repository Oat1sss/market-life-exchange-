"use client";

import { currency } from "@/domain/money";

interface TokocryptoOrderBookProps {
  readonly currentPriceMinor: bigint;
  readonly isUp: boolean;
  readonly symbol: string;
}

export function TokocryptoOrderBook({
  currentPriceMinor,
  isUp,
  symbol,
}: TokocryptoOrderBookProps) {
  const price = Number(currentPriceMinor) / 100;

  // Generate realistic deterministic depth levels based on current price
  const spreadPercent = 0.0015; // 0.15% spread
  const askLevels = [
    { price: price * (1 + spreadPercent * 5), qty: 14, depth: 85 },
    { price: price * (1 + spreadPercent * 4), qty: 28, depth: 68 },
    { price: price * (1 + spreadPercent * 3), qty: 42, depth: 52 },
    { price: price * (1 + spreadPercent * 2), qty: 19, depth: 35 },
    { price: price * (1 + spreadPercent * 1), qty: 8, depth: 18 },
  ];

  const bidLevels = [
    { price: price * (1 - spreadPercent * 1), qty: 11, depth: 22 },
    { price: price * (1 - spreadPercent * 2), qty: 24, depth: 40 },
    { price: price * (1 - spreadPercent * 3), qty: 39, depth: 58 },
    { price: price * (1 - spreadPercent * 4), qty: 55, depth: 75 },
    { price: price * (1 - spreadPercent * 5), qty: 21, depth: 90 },
  ];

  return (
    <div className="flex flex-col rounded-xl border border-[#2b313a] bg-[#181a20] p-3 text-xs text-[#eaecef] shadow-xl">
      <div className="mb-2 flex items-center justify-between border-b border-[#2b313a] pb-2 font-semibold">
        <span className="text-[11px] uppercase tracking-wider text-[#848e9c]">
          Buku Pesanan (Order Book)
        </span>
        <span className="text-[10px] text-[#848e9c]">Spread 0.15%</span>
      </div>

      {/* Header labels */}
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-[#848e9c]">
        <span>Harga (Rp)</span>
        <span>Ukuran ({symbol})</span>
      </div>

      {/* Asks (Sell orders - Red) */}
      <div className="flex flex-col space-y-1">
        {askLevels.map((row, idx) => (
          <div
            key={`ask-${idx}`}
            className="relative flex items-center justify-between py-0.5 tabular-nums"
          >
            <div
              className="absolute right-0 top-0 h-full bg-[#f6465d]/12"
              style={{ width: `${row.depth}%` }}
            />
            <span className="relative z-10 font-medium text-[#f6465d]">
              {row.price.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="relative z-10 text-[#eaecef]">{row.qty}</span>
          </div>
        ))}
      </div>

      {/* Current Price Banner */}
      <div className="my-2.5 flex items-center justify-between rounded-lg bg-[#12161a] px-2.5 py-2">
        <div className="flex items-center gap-1.5 font-bold tabular-nums">
          <span
            className={`text-base ${
              isUp ? "text-[#0ecb81]" : "text-[#f6465d]"
            }`}
          >
            {currency(currentPriceMinor)}
          </span>
          <span className="text-xs">{isUp ? "↑" : "↓"}</span>
        </div>
        <span className="text-[10px] text-[#848e9c]">Harga Pasar</span>
      </div>

      {/* Bids (Buy orders - Green) */}
      <div className="flex flex-col space-y-1">
        {bidLevels.map((row, idx) => (
          <div
            key={`bid-${idx}`}
            className="relative flex items-center justify-between py-0.5 tabular-nums"
          >
            <div
              className="absolute right-0 top-0 h-full bg-[#0ecb81]/12"
              style={{ width: `${row.depth}%` }}
            />
            <span className="relative z-10 font-medium text-[#0ecb81]">
              {row.price.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="relative z-10 text-[#eaecef]">{row.qty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
