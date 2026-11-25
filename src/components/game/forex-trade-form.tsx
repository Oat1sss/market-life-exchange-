"use client";

import { useActionState, useMemo, useState } from "react";
import { tradeForexAction } from "@/app/actions/forex";
import { currency } from "@/domain/money";
import { formatForexRate } from "@/domain/forex";
import { cx } from "./ui";

export interface ForexMarketOption {
  symbol: string;
  base: string;
  note: string;
  /** Rupiah per one unit of the base currency, before spread. */
  baseRateIdr: number;
  /** Half-spread in basis points. */
  spreadBp: number;
}

interface ForexTradeFormProps {
  readonly markets: readonly ForexMarketOption[];
  readonly cashMinor: bigint;
  readonly holdings: Readonly<Record<string, { units: bigint; averageRateMinor: bigint }>>;
}

function impactBp(units: number): number {
  return units >= 100_000 ? 50 : units >= 10_000 ? 25 : units >= 1_000 ? 10 : 0;
}

function rateDecimals(rate: number): number {
  if (rate >= 10) return 0;
  if (rate >= 1) return 2;
  return 4;
}

export function ForexTradeForm({ markets, cashMinor, holdings }: ForexTradeFormProps) {
  const first = markets[0];
  const [pair, setPair] = useState(first?.symbol ?? "");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [units, setUnits] = useState("100");

  const [state, formAction, pending] = useActionState<
    { ok?: boolean; error?: string },
    FormData
  >(async (previous, formData) => {
    formData.set("idempotencyKey", crypto.randomUUID());
    return tradeForexAction(previous, formData);
  }, {});

  const selected = markets.find((market) => market.symbol === pair) ?? first;
  const parsedUnits = Math.max(0, Number.parseInt(units, 10) || 0);
  const held = selected ? holdings[selected.base] : undefined;

  const rate = useMemo(() => {
    if (!selected) return 0;
    const half = selected.spreadBp / 10_000;
    const impact = impactBp(parsedUnits) / 10_000;
    return side === "BUY"
      ? selected.baseRateIdr * (1 + half) * (1 + impact)
      : selected.baseRateIdr * (1 - half) * (1 - impact);
  }, [parsedUnits, selected, side]);

  const gross = BigInt(Math.max(0, Math.round(rate * 100 * parsedUnits)));
  const fee = (gross * 10n) / 10_000n + (side === "BUY" ? 50n : 0n);
  const total = side === "BUY" ? gross + fee : gross - fee;
  const maxBuy = rate > 0 ? Math.floor(Number(cashMinor) / (rate * 100 * 1.001)) : 0;
  const maxUnits = side === "BUY" ? Math.max(0, maxBuy) : Number(held?.units ?? 0n);

  const canSubmit =
    Boolean(selected) && parsedUnits > 0 && parsedUnits <= 1_000_000_000 && !pending;

  return (
    <form action={formAction} className="space-y-3.5 p-4">
      <input type="hidden" name="pair" value={pair} />
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="units" value={units} />

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-1">
        <button
          type="button"
          onClick={() => setSide("BUY")}
          aria-pressed={side === "BUY"}
          className={cx(
            "rounded-md py-2 text-xs font-black uppercase tracking-wider transition",
            side === "BUY" ? "bg-up text-[#04120e] shadow" : "text-muted hover:text-white",
          )}
        >
          Beli valas
        </button>
        <button
          type="button"
          onClick={() => setSide("SELL")}
          aria-pressed={side === "SELL"}
          className={cx(
            "rounded-md py-2 text-xs font-black uppercase tracking-wider transition",
            side === "SELL" ? "bg-down text-white shadow" : "text-muted hover:text-white",
          )}
        >
          Jual valas
        </button>
      </div>

      <label className="block">
        <span className="mb-1 flex items-center justify-between text-[11px] text-muted">
          <span>Pasangan</span>
          <span className="tabular-nums text-[#c7ccd4]">
            1 {selected?.base ?? "—"} = Rp {formatForexRate(rate, rateDecimals(rate))}
          </span>
        </span>
        <select
          value={pair}
          onChange={(event) => setPair(event.target.value)}
          className="h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm font-bold text-white outline-none transition focus:border-brand/60"
        >
          {markets.map((market) => (
            <option key={market.symbol} value={market.symbol}>
              {market.symbol} — {market.note}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 flex items-center justify-between text-[11px] text-muted">
          <span>Jumlah ({selected?.base ?? "unit"})</span>
          <span className="tabular-nums">
            {side === "BUY" ? (
              <>
                Saldo <strong className="text-white">{currency(cashMinor)}</strong>
              </>
            ) : (
              <>
                Dimiliki{" "}
                <strong className="text-white">
                  {(held?.units ?? 0n).toLocaleString("id-ID")} {selected?.base}
                </strong>
              </>
            )}
          </span>
        </span>
        <div className="flex h-10 items-center rounded-lg border border-line bg-elevated px-3 focus-within:border-brand/60">
          <input
            type="number"
            min="1"
            step="1"
            value={units}
            onChange={(event) => setUnits(event.target.value)}
            className="w-full bg-transparent text-sm font-semibold tabular-nums text-white outline-none"
            placeholder="100"
          />
          <span className="ml-2 text-[10px] font-black text-muted">{selected?.base}</span>
        </div>
      </label>

      <div className="flex flex-wrap gap-1.5">
        {[100, 1_000, 10_000].map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setUnits(amount.toString())}
            className="rounded border border-line bg-elevated px-2 py-1 text-[10px] font-bold text-muted transition hover:text-white"
          >
            {amount.toLocaleString("id-ID")}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setUnits(maxUnits.toString())}
          className="rounded border border-brand/30 bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand transition hover:bg-brand/20"
        >
          Maks
        </button>
      </div>

      <div className="space-y-1 rounded-lg border border-line bg-elevated px-3 py-2.5 text-[11px]">
        <div className="flex justify-between text-muted">
          <span>Kurs eksekusi</span>
          <span className="tabular-nums text-white">
            Rp {formatForexRate(rate, rateDecimals(rate))}
          </span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Nilai transaksi</span>
          <span className="tabular-nums text-white">{currency(gross)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Biaya 0,1%</span>
          <span className="tabular-nums text-white">{currency(fee)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-1.5 font-bold text-white">
          <span>{side === "BUY" ? "Total bayar" : "Total terima"}</span>
          <span className="tabular-nums">{currency(total)}</span>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-[11px] text-down">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-lg border border-up/30 bg-up/10 px-3 py-2 text-[11px] text-up">
          Order valas dieksekusi pada kurs algoritmik.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className={cx(
          "w-full rounded-lg py-2.5 text-xs font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50",
          side === "BUY"
            ? "bg-up text-[#04120e] hover:bg-up/90"
            : "bg-down text-white hover:bg-down/90",
        )}
      >
        {pending
          ? "Mengeksekusi…"
          : `${side === "BUY" ? "Beli" : "Jual"} ${selected?.base ?? ""}`}
      </button>

      <p className="text-[10px] leading-4 text-muted">
        Order langsung tereksekusi lewat market maker algoritmik; kas rupiah dan
        portofolio dipakai bersama dengan saham dan kripto.
      </p>
    </form>
  );
}
