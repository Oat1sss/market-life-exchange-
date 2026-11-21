"use client";

import { useActionState } from "react";
import { resolveLifeEventAction } from "@/app/actions/game";
import { cx } from "./ui";

interface LifeEventCardProps {
  readonly templateKey: string;
  readonly description: string;
  readonly choices: {
    readonly key: string;
    readonly text: string;
  }[];
}

export default function LifeEventCard({
  templateKey,
  description,
  choices,
}: LifeEventCardProps) {
  const [state, formAction, isPending] = useActionState(
    resolveLifeEventAction,
    { ok: false },
  );

  return (
    <section className="overflow-hidden rounded-xl border border-gold/30 bg-gradient-to-br from-gold/[0.08] via-surface to-surface shadow-[0_24px_70px_-45px_rgba(240,185,11,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-[11px] font-black text-gold">
            !
          </span>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-gold">
              Peristiwa terbuka
            </h2>
            <p className="text-[10px] text-muted">
              Pilih satu keputusan untuk melanjutkan bulan ini.
            </p>
          </div>
        </div>
        <span className="rounded border border-gold/30 bg-gold/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-gold">
          Perlu keputusan
        </span>
      </div>

      <form action={formAction} className="space-y-3 p-4">
        <input type="hidden" name="templateKey" value={templateKey} />
        <p className="text-sm leading-6 text-[#c7ccd4]">{description}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((choice) => (
            <label
              key={choice.key}
              className="group flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-elevated p-3 text-[11px] leading-5 text-[#c7ccd4] transition hover:border-gold/40 hover:bg-surface-2 has-[:checked]:border-gold/60 has-[:checked]:bg-gold/[0.08] has-[:checked]:text-white"
            >
              <input
                type="radio"
                name="choiceKey"
                value={choice.key}
                required
                className="mt-0.5 h-3.5 w-3.5 accent-[#f0b90b]"
              />
              <span>{choice.text}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className={cx(
              "rounded-lg bg-gold px-4 py-2 text-xs font-black uppercase tracking-wider text-[#1a1400] transition hover:bg-[#ffd23f] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {isPending ? "Memproses…" : "Ambil keputusan"}
          </button>
          {state?.error ? (
            <p className="text-[11px] font-semibold text-down">{state.error}</p>
          ) : null}
          {state?.ok ? (
            <p className="text-[11px] font-semibold text-up">
              Peristiwa berhasil diselesaikan.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
