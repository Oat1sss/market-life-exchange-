"use client";

import { useActionState, useState } from "react";
import { bondTradeAction, type BondActionState } from "@/app/actions/bonds";
import { bondFeeMinor, couponPerBondMinor } from "@/domain/bonds";
import { currency } from "@/domain/money";

export interface BondTicketLine {
  key: string;
  name: string;
  issuer: "GOVERNMENT" | "CORPORATE";
  rating: string;
  couponBp: number;
  yieldBp: number;
  priceMinor: bigint;
  monthsLeft: number;
  monthlyCouponMinor: bigint;
}

function pct(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}

function parseQuantity(value: string, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(max, Math.floor(parsed)));
}

export function BondTicket({
  lines,
  cashMinor,
}: {
  lines: BondTicketLine[];
  cashMinor: bigint;
}) {
  const [state, formAction, pending] = useActionState<BondActionState, FormData>(
    async (previous, formData) => {
      formData.set("idempotencyKey", crypto.randomUUID());
      return bondTradeAction(previous, formData);
    },
    {},
  );
  const [bondKey, setBondKey] = useState(lines[0]?.key ?? "");
  const [quantity, setQuantity] = useState("10");

  const line = lines.find((candidate) => candidate.key === bondKey) ?? lines[0];
  if (!line) return null;

  const maxQuantity = Math.min(50_000, Math.floor(Number(cashMinor / line.priceMinor)));
  const parsed = parseQuantity(quantity, maxQuantity);
  const gross = line.priceMinor * BigInt(parsed);
  const fee = parsed > 0 ? bondFeeMinor(gross) : 0n;
  const total = gross + fee;
  const monthlyCoupon = couponPerBondMinor(line.couponBp) * BigInt(parsed);
  const insufficient = parsed > 0 && total > cashMinor;
  const matured = line.monthsLeft <= 0;

  return (
    <form action={formAction} className="space-y-3 p-4">
      <input type="hidden" name="side" value="BUY" />
      <input type="hidden" name="bondKey" value={line.key} />

      <label className="block text-xs">
        <span className="mb-1 block text-muted">Pilih obligasi</span>
        <select
          value={bondKey}
          onChange={(event) => {
            setBondKey(event.target.value);
            setQuantity("10");
          }}
          className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm font-bold text-white focus:border-brand focus:outline-none"
        >
          {lines.map((candidate) => (
            <option key={candidate.key} value={candidate.key}>
              {candidate.name} · {pct(candidate.yieldBp)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-elevated p-3 text-xs">
        <div>
          <div className="text-muted">Harga / unit</div>
          <div className="mt-0.5 font-bold tabular-nums text-white">
            {currency(line.priceMinor)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-muted">Kupon / bulan</div>
          <div className="mt-0.5 font-bold tabular-nums text-brand">
            {currency(line.monthlyCouponMinor)}
          </div>
        </div>
        <div>
          <div className="text-muted">Yield efektif</div>
          <div className="mt-0.5 font-bold tabular-nums text-gold">{pct(line.yieldBp)}</div>
        </div>
        <div className="text-right">
          <div className="text-muted">Jatuh tempo</div>
          <div className="mt-0.5 font-bold tabular-nums text-white">
            {line.monthsLeft > 0 ? `${line.monthsLeft} bln` : "Selesai"}
          </div>
        </div>
      </div>

      <label className="block text-xs">
        <span className="mb-1 flex items-center justify-between text-muted">
          <span>Jumlah unit (1 unit = 100 nominal Rp)</span>
          <span className="tabular-nums">Maks {maxQuantity.toLocaleString("id-ID")}</span>
        </span>
        <input
          name="quantity"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-lg font-bold tabular-nums text-white focus:border-brand focus:outline-none"
        />
      </label>

      <div className="flex gap-1.5">
        {[1, 5, 10, 25].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setQuantity(String(Math.min(preset, Math.max(1, maxQuantity))))}
            className={`flex-1 rounded border py-1.5 text-[11px] font-bold tabular-nums transition ${
              parsed === preset
                ? "border-brand bg-brand/15 text-brand"
                : "border-line bg-elevated text-muted hover:text-white"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <dl className="space-y-1.5 rounded-lg bg-elevated p-3 text-xs">
        <div className="flex justify-between text-muted">
          <dt>Nilai transaksi</dt>
          <dd className="tabular-nums text-white">{currency(gross)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>Biaya (0,05%)</dt>
          <dd className="tabular-nums text-down">−{currency(fee)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-1.5 font-bold">
          <dt className="text-white">Total dibayar</dt>
          <dd className="tabular-nums text-brand">{currency(total)}</dd>
        </div>
        <div className="flex justify-between text-[11px]">
          <dt className="text-muted">Kupon diterima tiap bulan</dt>
          <dd className="tabular-nums text-brand">{currency(monthlyCoupon)}</dd>
        </div>
      </dl>

      <button
        type="submit"
        disabled={pending || matured || parsed <= 0 || insufficient}
        className="w-full rounded-lg bg-brand py-2.5 text-xs font-black uppercase tracking-wider text-[#04120e] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Memproses…" : matured ? "Obligasi sudah jatuh tempo" : "Beli obligasi"}
      </button>

      {insufficient ? (
        <p className="text-[11px] text-down">Kas tidak cukup untuk jumlah ini.</p>
      ) : null}
      {state.error ? (
        <p className="rounded bg-down/10 p-2 text-[11px] text-down">⚠️ {state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="rounded bg-up/10 p-2 text-[11px] text-up">✓ {state.message}</p>
      ) : null}
    </form>
  );
}

export function BondSellForm({
  bondKey,
  quantity,
  name,
}: {
  bondKey: string;
  quantity: number;
  name: string;
}) {
  const [state, formAction, pending] = useActionState<BondActionState, FormData>(
    async (previous, formData) => {
      formData.set("idempotencyKey", crypto.randomUUID());
      return bondTradeAction(previous, formData);
    },
    {},
  );
  const [units, setUnits] = useState("1");
  const parsed = parseQuantity(units, quantity);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="side" value="SELL" />
      <input type="hidden" name="bondKey" value={bondKey} />
      <div className="flex items-center gap-1.5">
        <input
          name="quantity"
          type="number"
          min="1"
          max={quantity}
          step="1"
          value={units}
          onChange={(event) => setUnits(event.target.value)}
          aria-label={`Jumlah ${name} yang dijual`}
          className="w-16 rounded border border-line bg-elevated px-2 py-1.5 text-right text-xs font-bold tabular-nums text-white focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || parsed <= 0}
          className="rounded border border-line bg-elevated px-2.5 py-1.5 text-[11px] font-bold text-[#c7ccd4] transition hover:border-brand/40 hover:text-brand disabled:opacity-40"
        >
          {pending ? "…" : "Jual"}
        </button>
      </div>
      {state.error ? <span className="text-[10px] text-down">{state.error}</span> : null}
      {state.ok ? <span className="text-[10px] text-up">Terjual</span> : null}
    </form>
  );
}
