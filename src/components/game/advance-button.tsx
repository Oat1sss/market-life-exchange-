"use client";

import { useActionState } from "react";
import { advanceAction, type ActionState } from "@/app/actions/game";
import { IconRefresh } from "@/components/icons";

export function AdvanceButton({ isLarge = false }: { isLarge?: boolean }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    advanceAction,
    {},
  );

  return (
    <form action={formAction} className="relative inline-flex flex-col items-end">
      <button
        type="submit"
        disabled={isPending}
        title="Majukan pasar 1 bulan"
        aria-label="Majukan pasar satu bulan"
        className={
          isLarge
            ? "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-[#04120e] transition hover:bg-brand-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            : "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-bold text-[#c7ccd4] transition hover:border-brand/40 hover:text-brand active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        <IconRefresh className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        <span className={isLarge ? "" : "hidden sm:inline"}>
          {isPending ? "Memajukan…" : "Majukan"}
        </span>
      </button>
      {state?.error ? (
        <p className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-down/30 bg-[#1a1113] p-2 text-right text-[10px] leading-4 text-down shadow-xl">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
