"use client";

import { useActionState, useState } from "react";
import { openFuturesAction } from "@/app/actions/futures";
import type { ActionState } from "@/app/actions/game";
import { LEVERAGE_OPTIONS } from "@/domain/futures";
import { cx } from "./ui";

const fieldClass =
  "h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm font-semibold text-white outline-none transition focus:border-brand/60";

export default function FuturesForm({
  symbols,
  defaultSymbol,
}: {
  readonly symbols: readonly string[];
  readonly defaultSymbol?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      formData.set("idempotencyKey", crypto.randomUUID());
      return openFuturesAction(previous, formData);
    },
    {},
  );
  const [symbol, setSymbol] = useState<string>(defaultSymbol ?? symbols[0] ?? "");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [leverage, setLeverage] = useState<number>(5);
  const [quantity, setQuantity] = useState<string>("1");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="symbol" value={symbol} />
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="leverage" value={leverage} />
      <input type="hidden" name="quantity" value={quantity} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
            Pasangan
          </span>
          <select
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            className={fieldClass}
          >
            {symbols.map((option) => (
              <option key={option} value={option}>
                {option}/IDR
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
            Arah posisi
          </span>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-1">
            <button
              type="button"
              onClick={() => setSide("LONG")}
              aria-pressed={side === "LONG"}
              className={cx(
                "rounded-md py-2 text-xs font-black uppercase tracking-wider transition",
                side === "LONG"
                  ? "bg-up text-[#04120e] shadow"
                  : "text-muted hover:text-white",
              )}
            >
              Long
            </button>
            <button
              type="button"
              onClick={() => setSide("SHORT")}
              aria-pressed={side === "SHORT"}
              className={cx(
                "rounded-md py-2 text-xs font-black uppercase tracking-wider transition",
                side === "SHORT"
                  ? "bg-down text-white shadow"
                  : "text-muted hover:text-white",
              )}
            >
              Short
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
            Leverage
          </span>
          <select
            value={leverage}
            onChange={(event) => setLeverage(Number(event.target.value))}
            className={fieldClass}
          >
            {LEVERAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}x
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
            Jumlah (unit)
          </span>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      <div className="rounded-lg border border-gold/20 bg-gold/[0.06] p-3 text-[10px] leading-5 text-muted">
        Margin yang dibutuhkan dihitung otomatis dari harga masuk, jumlah, dan
        leverage. Posisi dapat dilikuidasi jika ekuitas margin habis.
      </div>

      <button
        type="submit"
        disabled={pending}
        className={cx(
          "w-full rounded-lg py-3 text-sm font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40",
          side === "LONG"
            ? "bg-up text-[#04120e] hover:bg-brand-strong"
            : "bg-down text-white hover:bg-[#ff5c70]",
        )}
      >
        {pending
          ? "Membuka posisi…"
          : `Buka ${side === "LONG" ? "long" : "short"} ${leverage}x`}
      </button>

      {state?.error ? (
        <p className="rounded-lg border border-down/30 bg-down/10 p-2 text-[11px] leading-5 text-down">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg border border-up/30 bg-up/10 p-2 text-[11px] leading-5 text-up">
          Posisi futures berhasil dibuka.
        </p>
      ) : null}
    </form>
  );
}
