"use client";

import { useActionState, useState } from "react";
import {
  depositAction,
  type DepositActionState,
} from "@/app/actions/wallet";
import {
  DEPOSIT_METHODS,
  depositFeeMinor,
  depositNetMinor,
  type DepositMethodKey,
} from "@/domain/funding";
import { currency } from "@/domain/money";

const PRESETS = [5_000n, 10_000n, 25_000n, 50_000n, 100_000n];

function formatInput(minor: bigint): string {
  return (Number(minor) / 100).toFixed(2);
}

function parseAmount(value: string): bigint {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0n;
  return BigInt(Math.round(parsed * 100));
}

export function DepositForm() {
  const [state, formAction, pending] = useActionState<DepositActionState, FormData>(
    async (previous, formData) => {
      formData.set("idempotencyKey", crypto.randomUUID());
      return depositAction(previous, formData);
    },
    {},
  );
  const [methodKey, setMethodKey] = useState<DepositMethodKey>("VIRTUAL_ACCOUNT");
  const [amount, setAmount] = useState<string>("10000");

  const method =
    DEPOSIT_METHODS.find((entry) => entry.key === methodKey) ?? DEPOSIT_METHODS[0]!;
  const amountMinor = parseAmount(amount);
  const feeMinor = depositFeeMinor(amountMinor, method.feeBp);
  const netMinor = depositNetMinor(amountMinor, method.feeBp);
  const belowMin = amountMinor > 0n && amountMinor < method.minMinor;
  const aboveMax = amountMinor > method.maxMinor;
  const invalid = amountMinor <= 0n || belowMin || aboveMax;

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="xl:col-span-7 space-y-4">
        <div className="rounded-xl border border-[#2b313a] bg-[#181a20] p-4 text-[#eaecef] shadow-xl">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#848e9c]">
            1. Pilih metode deposit
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEPOSIT_METHODS.map((entry) => {
              const active = entry.key === methodKey;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => {
                    setMethodKey(entry.key);
                    setAmount(formatInput(entry.minMinor));
                  }}
                  className={`rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-[#00c087] bg-[#00c087]/10"
                      : "border-[#2b313a] bg-[#12161a] hover:border-[#848e9c]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{entry.label}</span>
                    {entry.badge ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          active
                            ? "bg-[#00c087]/20 text-[#00c087]"
                            : "bg-[#2b313a] text-[#848e9c]"
                        }`}
                      >
                        {entry.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#848e9c]">
                    {entry.description}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-[#f0b90b]">
                    {entry.eta}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <form
          action={formAction}
          className="rounded-xl border border-[#2b313a] bg-[#181a20] p-4 text-[#eaecef] shadow-xl"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#848e9c]">
            2. Nominal deposit
          </h2>
          <input type="hidden" name="method" value={methodKey} />

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-[#848e9c]">
              <span>Jumlah (Rp)</span>
              <span className="tabular-nums">
                Min {currency(method.minMinor)} · Maks {currency(method.maxMinor)}
              </span>
            </div>
            <div
              className={`flex items-center rounded-lg border bg-[#12161a] px-3 py-2.5 focus-within:border-[#00c087] ${
                belowMin || aboveMax ? "border-[#f6465d]" : "border-[#2b313a]"
              }`}
            >
              <span className="mr-2 text-sm font-bold text-[#848e9c]">Rp</span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full bg-transparent text-lg font-bold tabular-nums text-white outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(formatInput(preset))}
                className={`rounded border py-1.5 text-[11px] font-bold tabular-nums transition ${
                  amountMinor === preset
                    ? "border-[#00c087] bg-[#00c087]/15 text-[#00c087]"
                    : "border-[#2b313a] bg-[#12161a] text-[#848e9c] hover:text-white"
                }`}
              >
                {Number(preset / 1000n)}K
              </button>
            ))}
          </div>

          <dl className="mt-4 space-y-1.5 rounded-lg bg-[#12161a] p-3 text-xs">
            <div className="flex justify-between text-[#848e9c]">
              <dt>Nominal deposit</dt>
              <dd className="tabular-nums text-white">{currency(amountMinor)}</dd>
            </div>
            <div className="flex justify-between text-[#848e9c]">
              <dt>Biaya metode ({method.feeBp / 100}%)</dt>
              <dd className="tabular-nums text-[#f6465d]">−{currency(feeMinor)}</dd>
            </div>
            <div className="flex justify-between border-t border-[#2b313a] pt-1.5 font-bold">
              <dt className="text-white">Saldo diterima</dt>
              <dd className="tabular-nums text-[#00c087]">{currency(netMinor)}</dd>
            </div>
          </dl>

          {belowMin ? (
            <p className="mt-2 text-xs text-[#f6465d]">
              Nominal minimum {method.label} adalah {currency(method.minMinor)}.
            </p>
          ) : null}
          {aboveMax ? (
            <p className="mt-2 text-xs text-[#f6465d]">
              Nominal maksimum {method.label} adalah {currency(method.maxMinor)}.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending || invalid}
            className="mt-4 w-full rounded-lg bg-[#00c087] py-3 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-[#0ecb81] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Memproses deposit…" : `Deposit via ${method.label}`}
          </button>

          {state.error ? (
            <p className="mt-3 rounded bg-red-950/40 p-2 text-xs text-red-400">
              ⚠️ {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <div className="mt-3 rounded bg-emerald-950/40 p-3 text-xs text-emerald-300">
              <p className="font-bold">✓ {state.message}</p>
              {state.result ? (
                <p className="mt-1 tabular-nums text-emerald-400/80">
                  Diterima {state.result.credited} · Biaya {state.result.fee} · Saldo{" "}
                  {state.result.balance}
                </p>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>

      <aside className="xl:col-span-5 space-y-4">
        <div className="rounded-xl border border-[#2b313a] bg-[#181a20] p-4 text-[#eaecef] shadow-xl">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#848e9c]">
            Cara kerja saldo demo
          </h2>
          <ol className="mt-3 space-y-3 text-xs leading-relaxed text-[#848e9c]">
            <li className="rounded-lg bg-[#12161a] p-3">
              <span className="font-bold text-[#00c087]">1. Simulasi penuh.</span>{" "}
              Tidak ada uang sungguhan yang berpindah. Semua metode langsung
              mengisi saldo demo.
            </li>
            <li className="rounded-lg bg-[#12161a] p-3">
              <span className="font-bold text-[#f0b90b]">2. Biaya transparan.</span>{" "}
              Transfer bank dan virtual account gratis; e-wallet, kartu, dan
              setoran kripto memakai biaya kecil yang dipotong dari nominal.
            </li>
            <li className="rounded-lg bg-[#12161a] p-3">
              <span className="font-bold text-white">3. Tercatat di ledger.</span>{" "}
              Setiap deposit masuk sebagai entri <code>DEPOSIT</code> dan tidak
              bisa diubah, sama seperti transaksi bursa sungguhan.
            </li>
            <li className="rounded-lg bg-[#12161a] p-3">
              <span className="font-bold text-[#f6465d]">4. Batas wajar.</span>{" "}
              Setiap metode punya minimum dan maksimum agar latihan ukuran posisi
              tetap realistis.
            </li>
          </ol>
        </div>
      </aside>
    </div>
  );
}
