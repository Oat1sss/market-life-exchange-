"use client";

import { useActionState } from "react";
import { cancelOrderAction } from "@/app/actions/trade";

export function CancelOrderButton({ orderId }: { readonly orderId: string }) {
  const [state, formAction, pending] = useActionState(cancelOrderAction, {});

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-down/30 bg-down/10 px-2 py-1 text-[10px] font-bold text-down transition hover:border-down/60 hover:bg-down/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Membatalkan…" : "Batalkan"}
      </button>
      {state?.error ? (
        <p className="max-w-40 text-right text-[10px] leading-4 text-down">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
