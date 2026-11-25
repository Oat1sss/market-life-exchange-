"use client";

import { useActionState } from "react";
import { issueDirectiveAction, type ControlActionState } from "@/app/actions/control";
import type { DirectiveKind } from "@/domain/economy";
import { currency } from "@/domain/money";

export interface BoardActionOption {
  kind: DirectiveKind;
  label: string;
  hint: string;
  allowed: boolean;
}

export function BoardConsole({
  symbol,
  name,
  stakePct,
  tick,
  cooldownUntil,
  options,
  dividendPreview,
  lastResolution,
}: {
  symbol: string;
  name: string;
  stakePct: number;
  tick: number;
  cooldownUntil: number | null;
  options: BoardActionOption[];
  dividendPreview: bigint;
  lastResolution: string | null;
}) {
  const [state, formAction, pending] = useActionState<ControlActionState, FormData>(
    issueDirectiveAction,
    {},
  );
  const cooling = cooldownUntil !== null && cooldownUntil > tick;

  return (
    <div className="mt-2 rounded-lg border border-line/70 bg-elevated/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-gold">
          Rapat dewan · {stakePct.toFixed(1)}%
        </span>
        <span className="text-[10px] text-muted">
          {cooling ? `RUPS lagi ${cooldownUntil! - tick} bln` : "Siap bersidang"}
        </span>
      </div>

      {lastResolution ? (
        <p className="mt-1 text-[10px] text-[#8b93a1]">{lastResolution}</p>
      ) : null}

      <form action={formAction} className="mt-2 space-y-1.5">
        <input type="hidden" name="companySymbol" value={symbol} />
        <input type="hidden" name="idempotencyKey" defaultValue="" />
        <div className="grid grid-cols-2 gap-1.5">
          {options.map((option) => (
            <button
              key={option.kind}
              type="submit"
              name="kind"
              value={option.kind}
              disabled={pending || cooling || !option.allowed}
              title={option.hint}
              onClick={(event) => {
                const form = event.currentTarget.form;
                const input = form?.querySelector<HTMLInputElement>(
                  'input[name="idempotencyKey"]',
                );
                if (input) input.value = crypto.randomUUID();
              }}
              className="rounded border border-line bg-surface px-1.5 py-1.5 text-[9.5px] font-bold leading-tight text-[#c7ccd4] transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
            >
              {option.label}
              {option.kind === "DIVIDEND" && option.allowed && dividendPreview > 0n ? (
                <span className="mt-0.5 block text-[9px] font-medium text-brand">
                  {currency(dividendPreview)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </form>

      {cooling ? (
        <p className="mt-1 text-[9.5px] text-[#5e6673]">
          Dewan {name} baru mengambil keputusan; tunggu kuartal berikutnya.
        </p>
      ) : null}
      {state.error ? <p className="mt-1 text-[9.5px] text-down">⚠️ {state.error}</p> : null}
      {state.ok ? <p className="mt-1 text-[9.5px] text-up">✓ {state.message}</p> : null}
    </div>
  );
}
