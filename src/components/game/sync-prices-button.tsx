"use client";

import { useActionState } from "react";
import { syncRealPricesAction } from "@/app/actions/market-sync";
import type { ActionState } from "@/app/actions/game";
import { IconBolt } from "@/components/icons";

export function SyncPricesButton() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    syncRealPricesAction,
    {},
  );

  return (
    <form action={formAction} className="relative inline-flex flex-col items-end">
      <button
        type="submit"
        disabled={isPending}
        title="Sinkronkan harga kripto dengan pasar dunia nyata (CoinGecko)"
        aria-label="Sinkronkan harga kripto dunia nyata"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-2.5 text-[11px] font-bold text-gold transition hover:bg-gold/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconBolt className={`h-3.5 w-3.5 ${isPending ? "animate-pulse" : ""}`} />
        <span className="hidden md:inline">
          {isPending ? "Syncing…" : "Live Price"}
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
