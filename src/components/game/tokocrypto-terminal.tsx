"use client";

import { useActionState, useState, useTransition } from "react";
import { placeOrderAction } from "@/app/actions/trade";
import { openFuturesAction } from "@/app/actions/futures";
import { currency, formatMinor } from "@/domain/money";
import { LEVERAGE_OPTIONS, liquidationPriceMinor, marginFor } from "@/domain/futures";

interface TokocryptoTerminalProps {
  readonly symbol: string;
  readonly symbols: readonly string[];
  readonly priceMinor: bigint;
  readonly cashMinor: bigint;
  readonly holdingQuantity: number;
}

export function TokocryptoTerminal({
  symbol,
  priceMinor,
  cashMinor,
  holdingQuantity,
}: TokocryptoTerminalProps) {
  const [tab, setTab] = useState<"SPOT" | "FUTURES">("SPOT");

  // Spot States
  const [spotSide, setSpotSide] = useState<"BUY" | "SELL">("BUY");
  const [spotType, setSpotType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [spotQty, setSpotQty] = useState<string>("1");
  const [spotLimitPrice, setSpotLimitPrice] = useState<string>(
    (Number(priceMinor) / 100).toFixed(2),
  );

  // Futures States
  const [futuresSide, setFuturesSide] = useState<"LONG" | "SHORT">("LONG");
  const [futuresLeverage, setFuturesLeverage] = useState<number>(5);
  const [futuresQty, setFuturesQty] = useState<string>("1");

  // Action states
  const [spotState, spotAction, spotPending] = useActionState(placeOrderAction, {});
  const [futuresState, futuresAction, futuresPending] = useActionState(openFuturesAction, {});
  const [, startTransition] = useTransition();

  // Calculations for Spot
  const parsedSpotQty = parseInt(spotQty, 10) || 0;
  const unitPrice =
    spotType === "LIMIT" && parseFloat(spotLimitPrice) > 0
      ? BigInt(Math.round(parseFloat(spotLimitPrice) * 100))
      : priceMinor;

  const spotEstimatedGross = unitPrice * BigInt(parsedSpotQty);
  const spotFee = (spotEstimatedGross * 10n) / 10_000n; // 0.1% approx
  const spotEstimatedTotal = spotSide === "BUY" ? spotEstimatedGross + spotFee : spotEstimatedGross - spotFee;

  // Max affordable quantity calculations
  const feeMultiplier = 1001n; // 1 + 0.1% fee
  const maxBuyUnits = unitPrice > 0n ? Number((cashMinor * 1000n) / (unitPrice * feeMultiplier)) : 0;
  const maxSellUnits = holdingQuantity;

  // Quick percentage sizing for Spot
  const applySpotPercentage = (pct: number) => {
    if (spotSide === "BUY") {
      const targetUnits = Math.max(0, Math.floor(maxBuyUnits * pct));
      setSpotQty(targetUnits > 0 ? targetUnits.toString() : "1");
    } else {
      const targetUnits = Math.max(0, Math.floor(maxSellUnits * pct));
      setSpotQty(targetUnits > 0 ? targetUnits.toString() : "0");
    }
  };

  // Calculations for Futures
  const parsedFuturesQty = parseInt(futuresQty, 10) || 0;
  const futuresNotional = priceMinor * BigInt(parsedFuturesQty);
  const futuresRequiredMargin = marginFor(futuresNotional, futuresLeverage);
  const futuresOpenFee = (futuresNotional * 10n) / 10_000n;
  const futuresTotalNeeded = futuresRequiredMargin + futuresOpenFee;

  // Max affordable futures quantity
  const marginPerUnit = marginFor(priceMinor, futuresLeverage) + (priceMinor * 10n) / 10_000n;
  const maxFuturesUnits = marginPerUnit > 0n ? Number(cashMinor / marginPerUnit) : 0;

  const applyFuturesPercentage = (pct: number) => {
    const targetUnits = Math.max(0, Math.floor(maxFuturesUnits * pct));
    setFuturesQty(targetUnits > 0 ? targetUnits.toString() : "1");
  };

  const estimatedLiquidation = liquidationPriceMinor(
    futuresSide,
    priceMinor,
    futuresLeverage,
  );

  return (
    <div className="rounded-xl border border-[#2b313a] bg-[#181a20] p-4 text-[#eaecef] shadow-xl">
      {/* Top Header Mode Toggle (Spot vs Futures) */}
      <div className="mb-4 flex items-center justify-between border-b border-[#2b313a] pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("SPOT")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              tab === "SPOT"
                ? "bg-[#2b313a] text-[#00c087] shadow-sm"
                : "text-[#848e9c] hover:text-[#eaecef]"
            }`}
          >
            Spot
          </button>
          <button
            type="button"
            onClick={() => setTab("FUTURES")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              tab === "FUTURES"
                ? "bg-[#2b313a] text-[#f0b90b] shadow-sm"
                : "text-[#848e9c] hover:text-[#eaecef]"
            }`}
          >
            Futures {futuresLeverage}x
          </button>
        </div>
        <div className="text-right text-xs">
          <span className="text-[#848e9c]">Saldo: </span>
          <span className="font-semibold tabular-nums text-[#eaecef]">{currency(cashMinor)}</span>
        </div>
      </div>

      {tab === "SPOT" ? (
        /* SPOT TRADING FORM */
        <div className="space-y-4">
          {/* Tokocrypto Beli (Buy) / Jual (Sell) Toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#12161a] p-1">
            <button
              type="button"
              onClick={() => setSpotSide("BUY")}
              className={`rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${
                spotSide === "BUY"
                  ? "bg-[#0ecb81] text-white shadow"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              Beli (Buy)
            </button>
            <button
              type="button"
              onClick={() => setSpotSide("SELL")}
              className={`rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${
                spotSide === "SELL"
                  ? "bg-[#f6465d] text-white shadow"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              Jual (Sell)
            </button>
          </div>

          {/* Order Type Toggle (Limit vs Market) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSpotType("MARKET")}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                spotType === "MARKET"
                  ? "border border-[#00c087] bg-[#00c087]/10 text-[#00c087]"
                  : "border border-[#2b313a] bg-[#1e2329] text-[#848e9c] hover:text-white"
              }`}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => {
                setSpotType("LIMIT");
                setSpotLimitPrice((Number(priceMinor) / 100).toFixed(2));
              }}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                spotType === "LIMIT"
                  ? "border border-[#00c087] bg-[#00c087]/10 text-[#00c087]"
                  : "border border-[#2b313a] bg-[#1e2329] text-[#848e9c] hover:text-white"
              }`}
            >
              Limit
            </button>
          </div>

          <form
            action={(formData) => {
              formData.set("idempotencyKey", crypto.randomUUID());
              startTransition(() => {
                spotAction(formData);
              });
            }}
            className="space-y-3"
          >
            <input type="hidden" name="symbol" value={symbol} />
            <input type="hidden" name="side" value={spotSide} />
            <input type="hidden" name="type" value={spotType} />
            <input type="hidden" name="quantity" value={spotQty} />
            <input type="hidden" name="limitPrice" value={spotType === "LIMIT" ? spotLimitPrice : ""} />

            {/* Limit Price Input */}
            {spotType === "LIMIT" && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-[#848e9c]">
                  <span>Harga Limit (CR)</span>
                  <span className="tabular-nums">Pasar: {currency(priceMinor)}</span>
                </div>
                <div className="flex items-center rounded-lg border border-[#2b313a] bg-[#12161a] px-3 py-2 text-sm focus-within:border-[#00c087]">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={spotLimitPrice}
                    onChange={(e) => setSpotLimitPrice(e.target.value)}
                    className="w-full bg-transparent font-medium tabular-nums text-white outline-none"
                    placeholder="0.00"
                  />
                  <span className="text-xs font-bold text-[#848e9c]">CR</span>
                </div>
              </div>
            )}

            {/* Quantity Input */}
            <div>
              <div className="mb-1 flex justify-between text-xs text-[#848e9c]">
                <span>Jumlah ({symbol})</span>
                <span>
                  Maks:{" "}
                  <strong className="text-white">
                    {spotSide === "BUY" ? maxBuyUnits : maxSellUnits}
                  </strong>{" "}
                  unit
                </span>
              </div>
              <div className="flex items-center rounded-lg border border-[#2b313a] bg-[#12161a] px-3 py-2 text-sm focus-within:border-[#00c087]">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={spotQty}
                  onChange={(e) => setSpotQty(e.target.value)}
                  className="w-full bg-transparent font-medium tabular-nums text-white outline-none"
                  placeholder="1"
                />
                <span className="text-xs font-bold text-[#848e9c]">{symbol}</span>
              </div>
            </div>

            {/* Tokocrypto Quick Percentage Sizing Pills */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applySpotPercentage(pct)}
                  className="rounded border border-[#2b313a] bg-[#1e2329] py-1 text-xs font-semibold text-[#848e9c] transition hover:border-[#00c087] hover:text-[#00c087]"
                >
                  {pct * 100}%
                </button>
              ))}
            </div>

            {/* Order Summary Box */}
            <div className="rounded-lg bg-[#12161a] p-2.5 text-xs space-y-1.5">
              <div className="flex justify-between text-[#848e9c]">
                <span>Estimasi Total:</span>
                <span className="font-semibold tabular-nums text-white">
                  {currency(spotEstimatedTotal)}
                </span>
              </div>
              <div className="flex justify-between text-[#848e9c]">
                <span>Biaya Transaksi (0.1%):</span>
                <span className="tabular-nums text-[#848e9c]">{currency(spotFee)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={spotPending || parsedSpotQty <= 0}
              className={`w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wider text-white transition disabled:opacity-50 ${
                spotSide === "BUY"
                  ? "bg-[#0ecb81] hover:bg-[#00c087]"
                  : "bg-[#f6465d] hover:bg-[#e55353]"
              }`}
            >
              {spotPending
                ? "Memproses…"
                : `${spotSide === "BUY" ? "Beli" : "Jual"} ${symbol}`}
            </button>

            {spotState?.error && (
              <p className="rounded bg-red-950/40 p-2 text-xs text-red-400">
                ⚠️ {spotState.error}
              </p>
            )}
            {spotState?.ok && (
              <p className="rounded bg-emerald-950/40 p-2 text-xs text-emerald-400">
                ✓ Pesanan {spotSide} {symbol} berhasil diproses!
              </p>
            )}
          </form>
        </div>
      ) : (
        /* FUTURES TRADING FORM */
        <div className="space-y-4">
          {/* Tokocrypto Long / Short Toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#12161a] p-1">
            <button
              type="button"
              onClick={() => setFuturesSide("LONG")}
              className={`rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${
                futuresSide === "LONG"
                  ? "bg-[#0ecb81] text-white shadow"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              Long (Naik)
            </button>
            <button
              type="button"
              onClick={() => setFuturesSide("SHORT")}
              className={`rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${
                futuresSide === "SHORT"
                  ? "bg-[#f6465d] text-white shadow"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              Short (Turun)
            </button>
          </div>

          {/* Leverage Selector (2x, 5x, 10x, 20x) */}
          <div>
            <div className="mb-1 flex justify-between text-xs text-[#848e9c]">
              <span>Leverage (Margin Cross)</span>
              <span className="font-bold text-[#f0b90b]">{futuresLeverage}x</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {LEVERAGE_OPTIONS.map((lev) => (
                <button
                  key={lev}
                  type="button"
                  onClick={() => setFuturesLeverage(lev)}
                  className={`rounded border py-1.5 text-xs font-bold transition ${
                    futuresLeverage === lev
                      ? "border-[#f0b90b] bg-[#f0b90b]/15 text-[#f0b90b]"
                      : "border-[#2b313a] bg-[#1e2329] text-[#848e9c] hover:text-white"
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          <form
            action={(formData) => {
              formData.set("idempotencyKey", crypto.randomUUID());
              startTransition(() => {
                futuresAction(formData);
              });
            }}
            className="space-y-3"
          >
            <input type="hidden" name="symbol" value={symbol} />
            <input type="hidden" name="side" value={futuresSide} />
            <input type="hidden" name="leverage" value={futuresLeverage} />
            <input type="hidden" name="quantity" value={futuresQty} />

            {/* Quantity Input */}
            <div>
              <div className="mb-1 flex justify-between text-xs text-[#848e9c]">
                <span>Jumlah Kontrak ({symbol})</span>
                <span>
                  Maks: <strong className="text-white">{maxFuturesUnits}</strong> unit
                </span>
              </div>
              <div className="flex items-center rounded-lg border border-[#2b313a] bg-[#12161a] px-3 py-2 text-sm focus-within:border-[#f0b90b]">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={futuresQty}
                  onChange={(e) => setFuturesQty(e.target.value)}
                  className="w-full bg-transparent font-medium tabular-nums text-white outline-none"
                  placeholder="1"
                />
                <span className="text-xs font-bold text-[#848e9c]">{symbol}</span>
              </div>
            </div>

            {/* Percentage Pills */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyFuturesPercentage(pct)}
                  className="rounded border border-[#2b313a] bg-[#1e2329] py-1 text-xs font-semibold text-[#848e9c] transition hover:border-[#f0b90b] hover:text-[#f0b90b]"
                >
                  {pct * 100}%
                </button>
              ))}
            </div>

            {/* Futures Breakdown Box */}
            <div className="rounded-lg bg-[#12161a] p-2.5 text-xs space-y-1.5">
              <div className="flex justify-between text-[#848e9c]">
                <span>Nilai Posisi (Notional):</span>
                <span className="font-semibold tabular-nums text-white">
                  {currency(futuresNotional)}
                </span>
              </div>
              <div className="flex justify-between text-[#848e9c]">
                <span>Margin Diperlukan:</span>
                <span className="font-semibold tabular-nums text-[#00c087]">
                  {formatMinor(futuresRequiredMargin)}
                </span>
              </div>
              <div className="flex justify-between text-[#848e9c]">
                <span>Estimasi Harga Likuidasi:</span>
                <span className="font-semibold tabular-nums text-[#f6465d]">
                  {currency(estimatedLiquidation)}
                </span>
              </div>
              <div className="flex justify-between text-[#848e9c]">
                <span>Biaya Pembukaan (0.1%):</span>
                <span className="tabular-nums text-[#848e9c]">{currency(futuresOpenFee)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={futuresPending || parsedFuturesQty <= 0 || futuresTotalNeeded > cashMinor}
              className={`w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wider text-white transition disabled:opacity-50 ${
                futuresSide === "LONG"
                  ? "bg-[#0ecb81] hover:bg-[#00c087]"
                  : "bg-[#f6465d] hover:bg-[#e55353]"
              }`}
            >
              {futuresPending
                ? "Membuka Posisi…"
                : futuresTotalNeeded > cashMinor
                  ? "Saldo Margin Tidak Cukup"
                  : `Buka ${futuresSide} ${futuresLeverage}x (${symbol})`}
            </button>

            {futuresState?.error && (
              <p className="rounded bg-red-950/40 p-2 text-xs text-red-400">
                ⚠️ {futuresState.error}
              </p>
            )}
            {futuresState?.ok && (
              <p className="rounded bg-emerald-950/40 p-2 text-xs text-emerald-400">
                ✓ Posisi Futures {futuresSide} {futuresLeverage}x berhasil dibuka!
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
