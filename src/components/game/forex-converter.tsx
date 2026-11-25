"use client";

import { useState } from "react";
import {
  CURRENCY_LABELS,
  FOREX_CURRENCIES,
  formatForexRate,
  type ForexCurrency,
} from "@/domain/forex";

export function ForexConverter({
  rates,
}: {
  readonly rates: Record<ForexCurrency, number>;
}) {
  const [amount, setAmount] = useState("10.000.000");
  const [from, setFrom] = useState<ForexCurrency>("IDR");
  const [to, setTo] = useState<ForexCurrency>("USD");

  const parsed = parseAmount(amount);
  const converted = parsed > 0 ? (parsed / rates[from]) * rates[to] : 0;
  const decimals = to === "IDR" ? 0 : 2;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="space-y-4 p-4">
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Jumlah
        </span>
        <div className="mt-1 flex items-center rounded-lg border border-line bg-elevated px-3 focus-within:border-brand/60">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ""))}
            className="h-10 w-full bg-transparent text-sm font-semibold tabular-nums text-white outline-none"
            placeholder="1.000.000"
            aria-label="Jumlah yang dikonversi"
          />
        </div>
      </label>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Dari
          </span>
          <select
            value={from}
            onChange={(event) => setFrom(event.target.value as ForexCurrency)}
            className="mt-1 h-10 w-full rounded-lg border border-line bg-elevated px-2 text-xs font-bold text-white outline-none focus:border-brand/60"
          >
            {FOREX_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCY_LABELS[code]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={swap}
          aria-label="Tukar mata uang"
          className="mb-0.5 h-10 w-10 rounded-lg border border-line bg-surface-2 text-sm font-black text-muted transition hover:border-brand/40 hover:text-brand"
        >
          ⇄
        </button>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Ke
          </span>
          <select
            value={to}
            onChange={(event) => setTo(event.target.value as ForexCurrency)}
            className="mt-1 h-10 w-full rounded-lg border border-line bg-elevated px-2 text-xs font-bold text-white outline-none focus:border-brand/60"
          >
            {FOREX_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCY_LABELS[code]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-brand/25 bg-brand/[0.06] p-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
          Hasil konversi
        </p>
        <p className="mt-1 text-2xl font-black tabular-nums text-white">
          {to === "IDR" ? "Rp " : ""}
          {formatForexRate(converted, decimals)}
          {to === "IDR" ? "" : ` ${to}`}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          1 {from} ={" "}
          <strong className="text-[#c7ccd4]">
            {formatForexRate(rates[to] / rates[from], 6)} {to}
          </strong>
        </p>
      </div>

      <p className="text-[10px] leading-5 text-muted">
        Kurs referensi memakai rupiah sebagai poros. Nilai tukar bergerak setiap
        kali pasar dimajukan; konversi tidak mengubah saldo akun.
      </p>
    </div>
  );
}

function parseAmount(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
