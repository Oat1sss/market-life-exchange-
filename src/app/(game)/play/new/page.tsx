import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";

export const instant = false;
import { canCreateGame } from "@/server/services/game-service";
import { CreateCharacterForm } from "@/components/game/create-character-form";
import { BACKGROUNDS } from "@/domain/character";
import { formatMinor } from "@/domain/money";



export default async function NewCharacterPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const allowed = await canCreateGame(userId);
  if (!allowed) redirect("/play");

  const backgroundEntries = Object.entries(BACKGROUNDS).map(([key, bg]) => ({
    key,
    label: bg.label,
    blurb: bg.blurb,
    stats: bg.stats,
  }));

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Start a new life</h1>
        <p className="mt-1 text-sm text-muted">
          Choose a name and a background. Your starting cash, salary, and stats follow from
          that choice.
        </p>
      </header>

      <dl className="grid gap-4 sm:grid-cols-3">
        {backgroundEntries.map((bg) => (
          <BackgroundSummary key={bg.key} background={bg} />
        ))}
      </dl>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Your details
        </h2>
        <CreateCharacterForm />
      </div>
    </>
  );
}

function BackgroundSummary({
  background,
}: {
  background: {
    readonly key: string;
    readonly label: string;
    readonly blurb: string;
    readonly stats: {
      health: number;
      happiness: number;
      knowledge: number;
      reputation: number;
    };
  };
}) {
  return (
    <div className="rounded border border-border-subtle bg-background p-4">
      <dt className="font-semibold">{background.label}</dt>
      <dd className="mt-1 text-sm text-muted">{background.blurb}</dd>
      <ul className="mt-3 space-y-1 text-xs text-muted">
        <li className="tabular-nums">Health: {background.stats.health}</li>
        <li className="tabular-nums">Happiness: {background.stats.happiness}</li>
        <li className="tabular-nums">Knowledge: {background.stats.knowledge}</li>
        <li className="tabular-nums">Reputation: {background.stats.reputation}</li>
        <li>Starter cash: 2,400.00 CR</li>
        <li>Starting salary: ~3,600.00 CR/yr</li>
      </ul>
    </div>
  );
}
