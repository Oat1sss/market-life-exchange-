"use client";

import { useActionState, useEffect, useState } from "react";
import { placeOrderAction } from "@/app/actions/trade";

type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

interface TradeFormProps {
  readonly symbols: readonly string[];
  readonly defaultSymbol?: string;
}

export default function TradeForm({ symbols, defaultSymbol }: TradeFormProps) {
  const [orderState, orderAction, orderPending] = useActionState<{
    ok?: boolean;
    error?: string;
  }, FormData>(placeOrderAction, {});

  const [side, setSide] = useState<Side>("BUY");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [type, setType] = useState<OrderType>("MARKET");
  const [symbol, setSymbol] = useState<string>(defaultSymbol ?? symbols[0] ?? "");
  const [quantity, setQuantity] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>("");

  // One key per order attempt: keep it across retries after a validation
  // error, then rotate it once the order is accepted so the next order is new.
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);
  useEffect(() => {
    if (orderState?.ok) setIdempotencyKey(crypto.randomUUID());
  }, [orderState]);

  return (
    <div className="space-y-6">
      <SideToggle
        side={side}
        onSideChange={setSide}
        disabled={orderPending}
      />

      <form
        id="order-form"
        action={orderAction}
        className="space-y-4"
      >
        <input type="hidden" name="symbol" value={symbol} />
        <input type="hidden" name="side" value={side} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="limitPrice" value={limitPrice} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <div>
          <label className="mb-1 block text-sm text-muted">Symbol</label>
          <select
            name="symbol-input"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
            }}
            className="rounded border border-border-subtle bg-background px-3 py-2 text-sm"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted">Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                        setType("MARKET");
              }}
              className={`rounded border px-3 py-1 text-sm font-medium ${
                type === "MARKET"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border-subtle bg-background hover:border-border"
              }`}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => {
                setType("LIMIT");
              }}
              className={`rounded border px-3 py-1 text-sm font-medium ${
                type === "LIMIT"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border-subtle bg-background hover:border-border"
              }`}
            >
              Limit
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted">Quantity</label>
          <input
            type="number"
            min="1"
            step="1"
            name="quantity-input"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
            }}
            className="rounded border border-border-subtle bg-background px-3 py-2 text-sm"
          />
        </div>

        {type === "LIMIT" && (
          <div>
            <label className="mb-1 block text-sm text-muted">
              Limit price (CR)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              name="limitPrice-input"
              value={limitPrice}
              onChange={(e) => {
                setLimitPrice(e.target.value);
              }}
              className="rounded border border-border-subtle bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={orderPending}
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {orderPending ? "Submitting…" : `${side} ${quantity}`}
          </button>
        </div>

        {orderState?.error ? (
          <p className="text-sm text-red-600">{orderState.error}</p>
        ) : null}
        {orderState?.ok ? (
          <p className="text-sm text-green-700">Order placed.</p>
        ) : null}
      </form>
    </div>
  );
}

function SideToggle({
  side,
  onSideChange,
  disabled,
}: {
  side: Side;
  onSideChange: (side: Side) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onSideChange("BUY")}
        disabled={disabled}
        className={`rounded border px-3 py-1 text-sm font-medium ${
          side === "BUY"
            ? "border-green-600 bg-green-600 text-white"
            : "border-border-subtle bg-background hover:border-border"
        } disabled:opacity-50`}
      >
        Buy
      </button>
      <button
        type="button"
        onClick={() => onSideChange("SELL")}
        disabled={disabled}
        className={`rounded border px-3 py-1 text-sm font-medium ${
          side === "SELL"
            ? "border-red-600 bg-red-600 text-white"
            : "border-border-subtle bg-background hover:border-border"
        } disabled:opacity-50`}
      >
        Sell
      </button>
    </div>
  );
}
