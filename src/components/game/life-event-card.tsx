"use client";

import { useActionState } from "react";
import { resolveLifeEventAction } from "@/app/actions/game";

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
    { ok: false }
  );

  return (
    <div className="rounded border border-amber-500 bg-amber-50 p-4">
      <h2 className="font-medium text-amber-900">Open event</h2>
      <p className="mt-1 text-sm text-amber-800">{description}</p>

      <form action={formAction} className="mt-4 space-y-2">
        <input type="hidden" name="templateKey" value={templateKey} />
        {choices.map((choice) => (
          <label
            key={choice.key}
            className="flex cursor-pointer items-start gap-3 rounded border border-amber-200 bg-white p-3 text-sm hover:border-amber-400"
          >
            <input
              type="radio"
              name="choiceKey"
              value={choice.key}
              className="mt-1"
            />
            <span className="text-amber-900">{choice.text}</span>
          </label>
        ))}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Resolving…" : "Resolve event"}
          </button>
          {state?.error ? (
            <p className="text-sm text-red-700">{state.error}</p>
          ) : null}
          {state?.ok ? (
            <p className="text-sm text-green-700">Event resolved.</p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
