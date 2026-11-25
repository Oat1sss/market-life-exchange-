"use client";

import { useEffect, useMemo, useState } from "react";
import { currency } from "@/domain/money";

interface TokocryptoOrderBookProps {
  readonly currentPriceMinor: bigint;
  readonly isUp: boolean;
  readonly symbol: string;
}

interface Level {
  price: number;
  qty: number;
  depth: number;
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function symbolSeed(symbol: string): number {
  let value = 7;
  for (let index = 0; index < symbol.length; index += 1) {
    value = (value * 31 + symbol.charCodeAt(index)) >>> 0;
  }
  return value;
}

function buildBook(
  price: number,
  symbol: string,
  pulse: number,
): { asks: Level[]; bids: Level[]; spreadPct: number; spreadMinor: bigint } {
  const rand = seeded(symbolSeed(symbol) + pulse * 97);
  const spreadPct = 0.0006 + rand() * 0.0012;
  const step = price * 0.0007;

  const rawAsks = Array.from({ length: 7 }, (_, index) => {
    const priceLevel = price * (1 + spreadPct / 2) + step * index;
    return { price: priceLevel, qty: 2 + Math.floor(rand() * 48) };
  });
  const rawBids = Array.from({ length: 7 }, (_, index) => {
    const priceLevel = price * (1 - spreadPct / 2) - step * index;
    return { price: priceLevel, qty: 2 + Math.floor(rand() * 48) };
  });

  const maxQty = Math.max(...rawAsks.map((row) => row.qty), ...rawBids.map((row) => row.qty));
  const asks: Level[] = rawAsks
    .reverse()
    .map((row) => ({ ...row, depth: Math.round((row.qty / maxQty) * 100) }));
  const bids: Level[] = rawBids.map((row) => ({
    ...row,
    depth: Math.round((row.qty / maxQty) * 100),
  }));

  return {
    asks,
    bids,
    spreadPct,
    spreadMinor: BigInt(Math.round(price * spreadPct * 100)),
  };
}

export function TokocryptoOrderBook({
  currentPriceMinor,
  isUp,
  symbol,
}: TokocryptoOrderBookProps) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setPulse((value) => value + 1), 1500);
    return () => window.clearInterval(timer);
  }, [symbol]);

  const price = Number(currentPriceMinor) / 100;
  const { asks, bids, spreadPct, spreadMinor } = useMemo(
    () => buildBook(price, symbol, pulse),
    // pulse drives the refresh; price re-seeds when the market advances
    [price, symbol, pulse],
  );

  return (
    <div className="flex flex-col rounded-xl border border-[#2b313a] bg-[#181a20] p-3 text-xs text-[#eaecef] shadow-xl">
      <div className="mb-2 flex items-center justify-between border-b border-[#2b313a] pb-2 font-semibold">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#848e9c]">
          Buku Pesanan
          <span className="inline-flex items-center gap-1 rounded bg-[#0ecb81]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#0ecb81]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0ecb81]" />
            LIVE
          </span>
        </span>
        <span className="text-[10px] text-[#848e9c]">
          Spread {(spreadPct * 100).toFixed(2)}% ·{" "}
          {currency(spreadMinor)}
        </span>
      </div>

      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-[#848e9c]">
        <span>Harga (Rp)</span>
        <span>Ukuran ({symbol})</span>
      </div>

      <div className="flex flex-col space-y-0.5">
        {asks.map((row, idx) => (
          <div
            key={`ask-${idx}-${pulse}`}
            className="relative flex items-center justify-between py-0.5 tabular-nums transition-colors duration-500"
          >
            <div
              className="absolute right-0 top-0 h-full rounded-l bg-[#f6465d]/12 transition-all duration-500"
              style={{ width: `${row.depth}%` }}
            />
            <span className="relative z-10 font-medium text-[#f6465d]">
              {row.price.toLocaleString("id-ID", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="relative z-10 text-[#eaecef]">{row.qty}</span>
          </div>
        ))}
      </div>

      <div className="my-2 flex items-center justify-between rounded-lg bg-[#12161a] px-2.5 py-2">
        <div className="flex items-center gap-1.5 font-bold tabular-nums">
          <span
            className={`text-base ${isUp ? "text-[#0ecb81]" : "text-[#f6465d]"}`}
          >
            {currency(currentPriceMinor)}
          </span>
          <span className="text-xs">{isUp ? "↑" : "↓"}</span>
        </div>
        <span className="text-[10px] text-[#848e9c]">Harga Pasar</span>
      </div>

      <div className="flex flex-col space-y-0.5">
        {bids.map((row, idx) => (
          <div
            key={`bid-${idx}-${pulse}`}
            className="relative flex items-center justify-between py-0.5 tabular-nums transition-colors duration-500"
          >
            <div
              className="absolute right-0 top-0 h-full rounded-l bg-[#0ecb81]/12 transition-all duration-500"
              style={{ width: `${row.depth}%` }}
            />
            <span className="relative z-10 font-medium text-[#0ecb81]">
              {row.price.toLocaleString("id-ID", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="relative z-10 text-[#eaecef]">{row.qty}</span>
          </div>
        ))}
      </div>

      <p className="mt-2.5 border-t border-[#2b313a] pt-2 text-[9px] leading-4 text-[#5e6673]">
        Kedalaman order book disimulasikan dan diperbarui tiap 1,5 detik.
      </p>
    </div>
  );
}
