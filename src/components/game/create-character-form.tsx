"use client";

import { useActionState } from "react";
import { createCharacterAction, type ActionState } from "@/app/actions/game";

const BACKGROUNDS = [
  { key: "SCHOLAR", label: "Scholar", blurb: "Booked solid. Grades, patience, low charm." },
  { key: "HUSTLER", label: "Hustler", blurb: "Everyone knows your name. So do creditors." },
  { key: "CREATIVE", label: "Creative", blurb: "Moods move markets. You move moods." },
] as const;

export function CreateCharacterForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCharacterAction,
    {},
  );

  return (
    <form action={formAction} className="mt-10 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">First name</span>
          <input
            name="firstName"
            required
            maxLength={50}
            autoComplete="given-name"
            className="mt-1 w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/40"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">Last name</span>
          <input
            name="lastName"
            required
            maxLength={50}
            autoComplete="family-name"
            className="mt-1 w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/40"
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-mono text-xs uppercase tracking-widest text-muted">Background</legend>
        {BACKGROUNDS.map((option, index) => (
          <label
            key={option.key}
            className="flex cursor-pointer items-start gap-3 rounded border border-border-subtle bg-background p-3 text-sm hover:border-foreground/30"
          >
            <input
              type="radio"
              name="background"
              value={option.key}
              defaultChecked={index === 0}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">{option.label}</span>
              <span className="block text-muted">{option.blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-5 py-2.5 font-medium text-background disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start this life"}
      </button>
    </form>
  );
}
