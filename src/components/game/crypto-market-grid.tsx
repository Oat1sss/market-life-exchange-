"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconSearch } from "@/components/icons";
import { currency } from "@/domain/money";
import { Sparkline, type ChartPoint } from "./price-chart";
import { cx } from "./ui";

export interface CryptoMarketItem {
  readonly symbol: string;
  readonly name: string;
  readonly priceMinor: bigint;
  readonly points: readonly ChartPoint[];
  readonly changeBp: number;
  readonly volatilityBp: number;
}

type Filter = "ALL" | "UP" | "DOWN";

const INITIAL_COUNT = 12;

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "ALL", label: "Semua" },
  { key: "UP", label: "Naik" },
  { key: "DOWN", label: "Turun" },
];

export function CryptoMarketGrid({
  assets,
}: {
  readonly assets: readonly CryptoMarketItem[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expanded, setExpanded] = useState(false);

  const counts = useMemo(
    () => ({
      ALL: assets.length,
      UP: assets.filter((asset) => asset.changeBp > 0).length,
      DOWN: assets.filter((asset) => asset.changeBp < 0).length,
    }),
    [assets],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (filter === "UP" && asset.changeBp <= 0) return false;
      if (filter === "DOWN" && asset.changeBp >= 0) return false;
      if (needle.length === 0) return true;
      return (
        asset.symbol.toLowerCase().includes(needle) ||
        asset.name.toLowerCase().includes(needle)
      );
    });
  }, [assets, filter, query]);

  const visible = expanded ? filtered : filtered.slice(0, INITIAL_COUNT);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 sm:w-72">
          <span className="sr-only">Cari pasar kripto</span>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setExpanded(false);
            }}
            placeholder="Cari simbol atau nama koin..."
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-muted focus:border-brand/60"
          />
        </label>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setFilter(item.key);
                setExpanded(false);
              }}
              aria-pressed={filter === item.key}
              className={cx(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-bold transition",
                filter === item.key
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-line bg-surface text-muted hover:text-white",
              )}
            >
              {item.label}
              <span className="text-[10px] tabular-nums opacity-60">
                {counts[item.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
          <p className="text-sm font-bold text-white">Pasar tidak ditemukan</p>
          <p className="mt-1 text-xs text-muted">
            Coba kata kunci lain atau ubah filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("ALL");
            }}
            className="mt-3 rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold text-muted transition hover:border-brand/40 hover:text-brand"
          >
            Reset pencarian
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((asset) => {
              const direction =
                asset.changeBp > 0 ? "up" : asset.changeBp < 0 ? "down" : "flat";
              return (
                <article
                  key={asset.symbol}
                  className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-[0_18px_50px_-38px_rgba(0,0,0,0.9)] transition hover:border-brand/50"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-white transition group-hover:text-brand">
                            {asset.symbol}/IDR
                          </span>
                          <span className="truncate text-xs text-muted">
                            {asset.name}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted">
                          Volatilitas {(asset.volatilityBp / 100).toFixed(1)}%
                        </div>
                      </div>
                      <span
                        className={cx(
                          "shrink-0 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums",
                          direction === "up"
                            ? "bg-up/15 text-up"
                            : direction === "down"
                              ? "bg-down/15 text-down"
                              : "bg-line-soft text-muted",
                        )}
                      >
                        {direction === "up" ? "+" : ""}
                        {(asset.changeBp / 100).toFixed(2)}%
                      </span>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="text-xl font-black tabular-nums text-white">
                        {currency(asset.priceMinor)}
                      </div>
                      <div className="w-24 shrink-0">
                        <Sparkline
                          points={asset.points}
                          id={`spark-${asset.symbol}`}
                          positive={asset.changeBp >= 0}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-line pt-3">
                    <Link
                      href={`/play/crypto/${asset.symbol}`}
                      className="flex w-full items-center justify-center rounded-lg bg-surface-2 py-2 text-xs font-bold text-white transition hover:bg-brand hover:text-[#04120e]"
                    >
                      Trading {asset.symbol} →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {filtered.length > INITIAL_COUNT ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-[11px] font-bold text-muted transition hover:border-brand/40 hover:text-brand"
              >
                {expanded
                  ? "Ringkas daftar"
                  : `Tampilkan semua ${filtered.length} pasar`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
