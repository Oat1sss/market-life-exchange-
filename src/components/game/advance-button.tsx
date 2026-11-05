"use client";

import { useActionState } from "react";
import { advanceAction, type ActionState } from "@/app/actions/game";

export function AdvanceButton({ isLarge = false }: { isLarge?: boolean }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    advanceAction,
    {},
  );

  return (
    <form action={formAction} className="inline-flex">
      <button
        type="submit"
        disabled={isPending || Boolean(state?.error)}
        className={
          isLarge
            ? "rounded border border-border-subtle bg-foreground px-5 py-3 text-base font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            : "rounded border border-border-subtle bg-background px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
        }
      >
        {isPending ? "Advancing…" : state?.error == null ? "Advance a month" : "Try again"}
        {state?.error ? <p className="mt-1 select-none text-xs text-red-600">{state.error}</p> : null}
      </button>
    </form>
  );
}
