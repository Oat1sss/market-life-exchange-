"use client";

import { useActionState } from "react";
import { enrollAction, type ActionState } from "@/app/actions/game";

export function EnrollForm({ programKey }: { programKey: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    enrollAction,
    {},
  );

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="programKey" value={programKey} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enroll Now"}
      </button>
      {state?.error ? (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="mt-2 text-xs text-green-700">Enrolled successfully.</p>
      ) : null}
    </form>
  );
}
