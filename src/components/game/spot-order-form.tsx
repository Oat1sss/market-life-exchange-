"use client";

import { useActionState, useState } from "react";
import { placeOrderAction } from "@/app/actions/trade";
import { currency } from "@/domain/money";
import { KeyValue, Panel, cx } from "./ui";

export interface SpotMarket {
  symbol: string;
  name?: string;
  priceMinor: bigint;
}

interface SpotOrderFormProps {
  readonly markets: readonly SpotMarket[];
  readonly defaultSymbol?: string;
  readonly cashMinor: bigint;
  readonly holdings?: Readonly<Record<string, number>>;
}

type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

function toInputPrice(priceMinor: bigint): string {
  return (Number(priceMinor) / 100).toFixed(2);
}

function parseInputPrice(value: string): bigint {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0n;
  return BigInt(Math.round(parsed * 100));
}

export function SpotOrderForm({
  markets,
  defaultSymbol,
  cashMinor,
  holdings = {},
}: SpotOrderFormProps) {
  const firstMarket = markets[0];
  const [side, setSide] = useState<Side>("BUY");
  const [type, setType] = useState<OrderType>("MARKET");
  const [symbol, setSymbol] = useState<string>(
    defaultSymbol ?? firstMarket?.symbol ?? "",
  );
  const [quantity, setQuantity] = useState<string>("1");
  const [limitPrice, setLimitPrice] = useState<string>(
    firstMarket ? toInputPrice(firstMarket.priceMinor) : "",
  );

  const [state, formAction, pending] = useActionState<
    { ok?: boolean; error?: string },
    FormData
  >(async (previous, formData) => {
    formData.set("idempotencyKey", crypto.randomUUID());
    return placeOrderAction(previous, formData);
  }, {});

  const selected =
    markets.find((market) => market.symbol === symbol) ?? firstMarket;

  const marketPriceMinor = selected?.priceMinor ?? 0n;
  const unitPriceMinor =
    type === "LIMIT" ? parseInputPrice(limitPrice) : marketPriceMinor;
  const parsedQuantity = Number.parseInt(quantity, 10) || 0;
  const grossMinor = unitPriceMinor * BigInt(Math.max(0, parsedQuantity));
  const feeMinor = (grossMinor * 10n) / 10_000n;
  const totalMinor =
    side === "BUY" ? grossMinor + feeMinor : grossMinor - feeMinor;

  const maxBuyUnits =
    unitPriceMinor > 0n
      ? Math.min(
          1_000_000,
          Number((cashMinor * 10_000n) / (unitPriceMinor * 10_010n)),
        )
      : 0;
  const maxSellUnits = selected ? (holdings[selected.symbol] ?? 0) : 0;
  const maxUnits = side === "BUY" ? maxBuyUnits : maxSellUnits;

  function handleSymbolChange(nextSymbol: string) {
    setSymbol(nextSymbol);
    const next = markets.find((market) => market.symbol === nextSymbol);
    if (next) setLimitPrice(toInputPrice(next.priceMinor));
  }

  function applyPercentage(percentage: number) {
    const target = Math.max(0, Math.floor(maxUnits * percentage));
    setQuantity(target.toString());
  }

  const canSubmit =
    Boolean(selected) &&
    parsedQuantity > 0 &&
    parsedQuantity <= 1_000_000 &&
    (type === "MARKET" || unitPriceMinor > 0n) &&
    !pending;

  return (
    <Panel>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#c7ccd4]">
            Buat Order
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">Spot · biaya 0,1%</p>
        </div>
        <div className="rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-right">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted">
            Saldo
          </div>
          <div className="text-[11px] font-black tabular-nums text-white">
            {currency(cashMinor)}
          </div>
        </div>
      </div>

      <form action={formAction} className="space-y-4 p-4">
        <input type="hidden" name="symbol" value={symbol} />
        <input type="hidden" name="side" value={side} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="quantity" value={quantity} />
        <input
          type="hidden"
          name="limitPrice"
          value={type === "LIMIT" ? limitPrice : ""}
        />

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-1">
          <button
            type="button"
            onClick={() => setSide("BUY")}
            aria-pressed={side === "BUY"}
            className={cx(
              "rounded-md py-2 text-xs font-black uppercase tracking-wider transition",
              side === "BUY"
                ? "bg-up text-[#04120e] shadow"
                : "text-muted hover:text-white",
            )}
          >
            Beli
          </button>
          <button
            type="button"
            onClick={() => setSide("SELL")}
            aria-pressed={side === "SELL"}
            className={cx(
              "rounded-md py-2 text-xs font-black uppercase tracking-wider transition",
              side === "SELL"
                ? "bg-down text-white shadow"
                : "text-muted hover:text-white",
            )}
          >
            Jual
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {(["MARKET", "LIMIT"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setType(option);
                  if (option === "LIMIT" && selected) {
                    setLimitPrice(toInputPrice(selected.priceMinor));
                  }
                }}
                aria-pressed={type === option}
                className={cx(
                  "rounded border px-2.5 py-1 text-[11px] font-bold transition",
                  type === option
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-line bg-elevated text-muted hover:text-white",
                )}
              >
                {option === "MARKET" ? "Market" : "Limit"}
              </button>
            ))}
          </div>
          <span className="rounded bg-line-soft px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted">
            Spot
          </span>
        </div>

        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>Pasangan</span>
            <span className="tabular-nums text-[#c7ccd4]">
              {currency(marketPriceMinor)}
            </span>
          </span>
          <select
            value={symbol}
            onChange={(event) => handleSymbolChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm font-bold text-white outline-none transition focus:border-brand/60"
          >
            {markets.map((market) => (
              <option key={market.symbol} value={market.symbol}>
                {market.symbol}/IDR{market.name ? ` — ${market.name}` : ""}
              </option>
            ))}
          </select>
        </label>

        {type === "LIMIT" ? (
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] text-muted">
              <span>Harga limit (Rp)</span>
              <span className="tabular-nums">Pasar: {currency(marketPriceMinor)}</span>
            </span>
            <div className="flex h-10 items-center rounded-lg border border-line bg-elevated px-3 focus-within:border-brand/60">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={limitPrice}
                onChange={(event) => setLimitPrice(event.target.value)}
                className="w-full bg-transparent text-sm font-semibold tabular-nums text-white outline-none placeholder:text-[#5e6673]"
                placeholder="0.00"
              />
              <span className="ml-2 text-[10px] font-black text-muted">Rp</span>
            </div>
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>Jumlah ({selected?.symbol ?? "—"})</span>
            <span className="tabular-nums">
              Tersedia:{" "}
              <strong className="text-white">
                {side === "BUY"
                  ? currency(cashMinor)
                  : `${maxSellUnits.toLocaleString("en-US")} unit`}
              </strong>
            </span>
          </span>
          <div className="flex h-10 items-center rounded-lg border border-line bg-elevated px-3 focus-within:border-brand/60">
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full bg-transparent text-sm font-semibold tabular-nums text-white outline-none placeholder:text-[#5e6673]"
              placeholder="1"
            />
            <span className="ml-2 text-[10px] font-black text-muted">
              {selected?.symbol ?? ""}
            </span>
          </div>
        </label>

        <div className="grid grid-cols-4 gap-1.5">
          {[0.25, 0.5, 0.75, 1].map((percentage) => (
            <button
              key={percentage}
              type="button"
              onClick={() => applyPercentage(percentage)}
              className="rounded border border-line bg-elevated py-1.5 text-[10px] font-bold text-muted transition hover:border-brand/40 hover:text-brand"
            >
              {percentage * 100}%
            </button>
          ))}
        </div>

        <div className="space-y-1.5 rounded-lg border border-line bg-elevated p-3">
          <KeyValue
            label="Harga order"
            value={unitPriceMinor > 0n ? currency(unitPriceMinor) : "—"}
          />
          <KeyValue label="Nilai order" value={currency(grossMinor)} />
          <KeyValue
            label="Biaya transaksi (0,1%)"
            value={currency(feeMinor)}
            tone="default"
          />
          <div className="border-t border-line pt-1.5">
            <KeyValue
              label={side === "BUY" ? "Total dibayar" : "Total diterima"}
              value={currency(totalMinor)}
              tone={side === "BUY" ? "down" : "up"}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={cx(
            "w-full rounded-lg py-3 text-sm font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40",
            side === "BUY"
              ? "bg-up text-[#04120e] hover:bg-brand-strong"
              : "bg-down text-white hover:bg-[#ff5c70]",
          )}
        >
          {pending
            ? "Memproses…"
            : `${side === "BUY" ? "Beli" : "Jual"} ${selected?.symbol ?? ""}`}
        </button>

        {state?.error ? (
          <p className="rounded-lg border border-down/30 bg-down/10 p-2 text-[11px] leading-5 text-down">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="rounded-lg border border-up/30 bg-up/10 p-2 text-[11px] leading-5 text-up">
            Order {side === "BUY" ? "beli" : "jual"} {selected?.symbol} berhasil
            dikirim.
          </p>
        ) : null}

        <p className="text-[10px] leading-4 text-[#5e6673]">
          Order market langsung tereksekusi. Order limit menunggu hingga harga
          target tercapai pada tick pasar berikutnya.
        </p>
      </form>
    </Panel>
  );
}
