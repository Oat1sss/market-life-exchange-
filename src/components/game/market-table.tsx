"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { currency } from "@/domain/money";

export interface MarketRow {
  symbol: string;
  name: string;
  kind: "CRYPTO" | "STOCK";
  sector: string;
  priceMinor: bigint;
  prevPriceMinor: bigint;
}

type KindFilter = "ALL" | "CRYPTO" | "STOCK";
type SortKey = "symbol" | "price" | "change";

const SECTOR_LABELS: Record<string, string> = {
  TECH: "Teknologi",
  HEALTH: "Kesehatan",
  ENERGY: "Energi",
  CONSUMER: "Konsumen",
  CRYPTO: "Kripto",
};

const brl = (minor: bigint) => currency(minor);

function changePct(row: MarketRow): number {
  if (row.prevPriceMinor === 0n) return 0;
  return (Number(row.priceMinor - row.prevPriceMinor) / Number(row.prevPriceMinor)) * 100;
}

export function MarketTable({
  rows,
  initialKind = "ALL",
  compact = false,
}: {
  rows: MarketRow[];
  initialKind?: KindFilter;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>(initialKind);
  const [sort, setSort] = useState<SortKey>("change");
  const [asc, setAsc] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = rows.filter((row) => {
      if (kind !== "ALL" && row.kind !== kind) return false;
      if (!needle) return true;
      return (
        row.symbol.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle) ||
        row.sector.toLowerCase().includes(needle)
      );
    });
    result.sort((a, b) => {
      let delta = 0;
      if (sort === "symbol") delta = a.symbol.localeCompare(b.symbol);
      if (sort === "price") delta = Number(a.priceMinor - b.priceMinor);
      if (sort === "change") delta = changePct(a) - changePct(b);
      return asc ? delta : -delta;
    });
    return compact ? result.slice(0, 8) : result;
  }, [rows, query, kind, sort, asc, compact]);

  const header = (key: SortKey, label: string, align = "text-right") => (
    <th className={`px-3 py-2 font-semibold ${align}`}>
      <button
        type="button"
        onClick={() => {
          if (sort === key) setAsc((value) => !value);
          else {
            setSort(key);
            setAsc(key === "symbol");
          }
        }}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-white"
      >
        {label}
        <span className={sort === key ? "text-[#f0b90b]" : "text-transparent"}>
          {asc ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#2b313a] bg-[#181a20] text-[#eaecef] shadow-xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2b313a] p-3">
        <div className="flex rounded-md border border-[#2b313a] p-0.5">
          {(["ALL", "CRYPTO", "STOCK"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
                kind === option
                  ? "bg-[#2b313a] text-[#f0b90b]"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              {option === "ALL" ? "Semua" : option === "CRYPTO" ? "Kripto" : "Saham"}
            </button>
          ))}
        </div>
        <div className="relative min-w-[160px] flex-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari simbol, nama, sektor…"
            className="h-8 w-full rounded-md border border-[#2b313a] bg-[#12161a] px-3 text-xs text-white outline-none placeholder:text-[#5e6673] focus:border-[#f0b90b]"
          />
        </div>
        <span className="text-[10px] tabular-nums text-[#848e9c]">
          {filtered.length} aset
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-b border-[#2b313a] text-[10px] text-[#848e9c]">
            <tr>
              {header("symbol", "Pasangan", "text-left")}
              <th className="hidden px-3 py-2 text-left font-semibold uppercase tracking-wider sm:table-cell">
                Nama
              </th>
              {header("price", "Harga terakhir")}
              {header("change", "Perubahan")}
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const pct = changePct(row);
              const up = pct > 0;
              const flat = Math.abs(pct) < 0.0001;
              const href =
                row.kind === "CRYPTO"
                  ? `/play/crypto/${row.symbol}`
                  : `/play/market/${row.symbol}`;
              return (
                <tr
                  key={`${row.kind}-${row.symbol}`}
                  className="border-b border-[#232830] transition hover:bg-[#1e232b]"
                >
                  <td className="px-3 py-2.5">
                    <Link href={href} className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          row.kind === "CRYPTO"
                            ? "bg-[#f0b90b]/15 text-[#f0b90b]"
                            : "bg-[#6f8dff]/15 text-[#6f8dff]"
                        }`}
                      >
                        {row.symbol.slice(0, 2)}
                      </span>
                      <span>
                        <span className="block font-bold text-white">{row.symbol}</span>
                        <span className="block text-[10px] uppercase text-[#5e6673]">
                          {row.kind === "CRYPTO"
                            ? "Kripto"
                            : `Saham · ${SECTOR_LABELS[row.sector] ?? row.sector}`}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-[#848e9c] sm:table-cell">
                    {row.name}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white">
                    {brl(row.priceMinor)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                      flat ? "text-[#848e9c]" : up ? "text-[#0ecb81]" : "text-[#f6465d]"
                    }`}
                  >
                    <span className="block">
                      {up ? "+" : ""}
                      {pct.toFixed(2)}%
                    </span>
                    <span className="block text-[10px] font-normal opacity-80">
                      {row.prevPriceMinor === 0n
                        ? "—"
                        : `${row.priceMinor >= row.prevPriceMinor ? "+" : "−"}${brl(
                            row.priceMinor >= row.prevPriceMinor
                              ? row.priceMinor - row.prevPriceMinor
                              : row.prevPriceMinor - row.priceMinor,
                          )}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={href}
                      className="rounded bg-[#2b313a] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#3a424e]"
                    >
                      Order
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#848e9c]">
                  Tidak ada aset yang cocok dengan pencarian.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
