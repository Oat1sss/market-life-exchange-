"use client";

import { useEffect, useState } from "react";
import { currency } from "@/domain/money";

interface TokocryptoOrderBookProps {
  readonly currentPriceMinor: bigint;
  readonly isUp: boolean;
  readonly symbol: string;
}

interface ApiLevel {
  price: string;
  quantity: number;
  own: boolean;
}

interface ApiBook {
  symbol: string;
  tick: number;
  midPrice: string;
  spreadBp: number;
  asks: ApiLevel[];
  bids: ApiLevel[];
  ownOrderCount: number;
}

function priceLabel(minor: string): string {
  return (Number(BigInt(minor)) / 100).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center justify-between py-1.5">
      <span className="h-2.5 w-24 rounded bg-[#2b313a]" />
      <span className="h-2.5 w-10 rounded bg-[#2b313a]" />
    </div>
  );
}

/**
 * The book is served by the same algorithmic market maker that fills orders.
 * Polling only refreshes algorithmic liquidity and the player's resting limit
 * orders; price levels stay pinned to the game tick.
 */
export function TokocryptoOrderBook({
  currentPriceMinor,
  isUp,
  symbol,
}: TokocryptoOrderBookProps) {
  const [book, setBook] = useState<ApiBook | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let pulse = 0;
    let alive = true;
    let controller: AbortController | undefined;

    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(
          `/api/market/book?symbol=${encodeURIComponent(symbol)}&pulse=${pulse}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as ApiBook;
        if (!alive) return;
        setBook(data);
        setFailed(false);
      } catch (error) {
        if (!alive || (error as Error).name === "AbortError") return;
        setFailed(true);
      } finally {
        pulse += 1;
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 1500);

    return () => {
      alive = false;
      window.clearInterval(timer);
      controller?.abort();
    };
  }, [symbol]);

  const levels = book ? [...book.asks, ...book.bids] : [];
  const maxQty = Math.max(1, ...levels.map((level) => level.quantity));
  const midMinor = book?.midPrice ?? currentPriceMinor.toString();
  const bestSpread = book
    ? BigInt(book.asks[0]?.price ?? midMinor) - BigInt(book.bids[0]?.price ?? midMinor)
    : 0n;

  return (
    <div className="flex flex-col rounded-xl border border-[#2b313a] bg-[#181a20] p-3 text-xs text-[#eaecef] shadow-xl">
      <div className="mb-2 flex items-center justify-between border-b border-[#2b313a] pb-2 font-semibold">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#848e9c]">
          Buku Pesanan
          <span className="inline-flex items-center gap-1 rounded bg-[#0ecb81]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#0ecb81]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0ecb81]" />
            ALGO
          </span>
        </span>
        <span className="text-[10px] text-[#848e9c]">
          Spread {book ? `${book.spreadBp} bp` : "…"} · {currency(bestSpread)}
        </span>
      </div>

      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-[#848e9c]">
        <span>Harga (Rp)</span>
        <span>Ukuran ({book?.symbol ?? symbol})</span>
      </div>

      <div className="flex flex-col space-y-0.5">
        {!book
          ? Array.from({ length: 6 }, (_, index) => <SkeletonRow key={index} />)
          : [...book.asks].reverse().map((level, index) => (
              <div
                key={`ask-${index}-${level.price}`}
                className={`relative flex items-center justify-between py-0.5 tabular-nums ${
                  level.own ? "text-gold" : ""
                }`}
              >
                <div
                  className="absolute right-0 top-0 h-full rounded-l bg-[#f6465d]/12"
                  style={{ width: `${Math.round((level.quantity / maxQty) * 100)}%` }}
                />
                <span className="relative z-10 flex items-center gap-1 font-medium text-[#f6465d]">
                  {level.own ? (
                    <span className="rounded bg-gold/20 px-1 py-px text-[8px] font-black text-gold">
                      KAMU
                    </span>
                  ) : null}
                  {priceLabel(level.price)}
                </span>
                <span className="relative z-10 text-[#eaecef]">{level.quantity}</span>
              </div>
            ))}
      </div>

      <div className="my-2 flex items-center justify-between rounded-lg bg-[#12161a] px-2.5 py-2">
        <div className="flex items-center gap-1.5 font-bold tabular-nums">
          <span className={`text-base ${isUp ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
            {currency(BigInt(midMinor))}
          </span>
          <span className="text-xs">{isUp ? "↑" : "↓"}</span>
        </div>
        <span className="text-[10px] text-[#848e9c]">Harga Pasar</span>
      </div>

      <div className="flex flex-col space-y-0.5">
        {!book
          ? Array.from({ length: 6 }, (_, index) => <SkeletonRow key={index} />)
          : book.bids.map((level, index) => (
              <div
                key={`bid-${index}-${level.price}`}
                className="relative flex items-center justify-between py-0.5 tabular-nums"
              >
                <div
                  className="absolute right-0 top-0 h-full rounded-l bg-[#0ecb81]/12"
                  style={{ width: `${Math.round((level.quantity / maxQty) * 100)}%` }}
                />
                <span className="relative z-10 flex items-center gap-1 font-medium text-[#0ecb81]">
                  {level.own ? (
                    <span className="rounded bg-gold/20 px-1 py-px text-[8px] font-black text-gold">
                      KAMU
                    </span>
                  ) : null}
                  {priceLabel(level.price)}
                </span>
                <span className="relative z-10 text-[#eaecef]">{level.quantity}</span>
              </div>
            ))}
      </div>

      <p className="mt-2.5 border-t border-[#2b313a] pt-2 text-[9px] leading-4 text-[#5e6673]">
        {failed
          ? "Buku pesanan gagal dimuat. Mencoba lagi…"
          : book && book.ownOrderCount > 0
            ? `${book.ownOrderCount} order limit kamu ikut menjadi likuiditas di buku ini.`
            : "Kedalaman dibentuk market maker algoritmik dan diperbarui tiap 1,5 detik."}
      </p>
    </div>
  );
}
