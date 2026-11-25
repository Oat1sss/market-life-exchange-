"use client";

import { useActionState } from "react";
import { createCharacterAction, type ActionState } from "@/app/actions/game";

const BACKGROUNDS = [
  {
    key: "SCHOLAR",
    label: "Scholar",
    blurb: "Rajin belajar, sabar, pengetahuan tinggi.",
  },
  {
    key: "HUSTLER",
    label: "Hustler",
    blurb: "Jaringan luas, percaya diri, reputasi kuat.",
  },
  {
    key: "CREATIVE",
    label: "Creative",
    blurb: "Ide segar, mood dinamis, kebahagiaan tinggi.",
  },
] as const;

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-white outline-none transition placeholder:text-[#5e6673] focus:border-brand/60";

export function CreateCharacterForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCharacterAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Nama depan
          </span>
          <input
            name="firstName"
            required
            maxLength={50}
            autoComplete="given-name"
            className={inputClass}
            placeholder="Contoh: Raka"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Nama belakang
          </span>
          <input
            name="lastName"
            required
            maxLength={50}
            autoComplete="family-name"
            className={inputClass}
            placeholder="Contoh: Pratama"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Profil trader
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {BACKGROUNDS.map((option, index) => (
            <label
              key={option.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-elevated p-3 transition hover:border-brand/40 has-[:checked]:border-brand/60 has-[:checked]:bg-brand/[0.07]"
            >
              <input
                type="radio"
                name="background"
                value={option.key}
                defaultChecked={index === 0}
                className="mt-0.5 h-3.5 w-3.5 accent-[#00c087]"
              />
              <span>
                <span className="block text-xs font-bold text-white">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-muted">
                  {option.blurb}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.error ? (
        <p className="rounded-lg border border-down/30 bg-down/10 p-2 text-[11px] leading-5 text-down">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#04120e] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Membuka akun…" : "Buka akun demo"}
        </button>
        <p className="text-[10px] text-[#5e6673]">
          Saldo awal Rp 10.000.000.000,00 · tanpa uang sungguhan
        </p>
      </div>
    </form>
  );
}
