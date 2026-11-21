"use client";

import { useActionState } from "react";
import { closeFuturesAction } from "@/app/actions/futures";

export function ClosePositionButton({ positionId }: { readonly positionId: string }) {
  const [state, formAction, pending] = useActionState(closeFuturesAction, {});

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="positionId" value={positionId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-line bg-surface-2 px-2 py-1 text-[10px] font-bold text-[#c7ccd4] transition hover:border-down/50 hover:text-down disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Menutup…" : "Tutup"}
      </button>
      {state?.error ? (
        <p className="max-w-40 text-right text-[10px] leading-4 text-down">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
