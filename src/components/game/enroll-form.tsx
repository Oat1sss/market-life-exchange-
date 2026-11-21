"use client";

import { useActionState } from "react";
import { enrollAction, type ActionState } from "@/app/actions/game";

export function EnrollForm({ programKey }: { programKey: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    enrollAction,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="programKey" value={programKey} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-2 text-xs font-black uppercase tracking-wider text-[#04120e] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Mendaftar…" : "Daftar sekarang"}
      </button>
      {state?.error ? (
        <p className="mt-2 rounded border border-down/30 bg-down/10 p-2 text-[10px] leading-4 text-down">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="mt-2 rounded border border-up/30 bg-up/10 p-2 text-[10px] leading-4 text-up">
          Pendaftaran berhasil. Program akan selesai sesuai durasi.
        </p>
      ) : null}
    </form>
  );
}
