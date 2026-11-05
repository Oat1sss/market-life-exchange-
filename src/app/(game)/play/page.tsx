import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { gameSnapshot } from "@/server/services/game-service";

export const instant = false;
import { AdvanceButton } from "@/components/game/advance-button";
import { currency } from "@/domain/money";
import LifeEventCard from "@/components/game/life-event-card";



export default async function PlayDashboard() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const snapshot = await gameSnapshot(userId);
  if (!snapshot) redirect("/play/new");

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Month {snapshot.tick} — {snapshot.character.firstName} {snapshot.character.lastName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {snapshot.date} · Age {snapshot.character.age} · Background: {snapshot.character.background}
          </p>
        </div>
        <AdvanceButton isLarge />
      </header>

      {/* Character Stats */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBadge label="Health" value={snapshot.character.health} max={100} />
        <StatBadge label="Happiness" value={snapshot.character.happiness} max={100} />
        <StatBadge label="Knowledge" value={snapshot.character.knowledge} max={100} />
        <StatBadge label="Reputation" value={snapshot.character.reputation} max={100} />
      </section>

      {/* Financial Overview */}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FinancialStat label="Cash" value={snapshot.cash} />
        <FinancialStat label="Portfolio" value={snapshot.portfolioValue} />
        <FinancialStat label="Net worth" value={snapshot.netWorth} />
        <FinancialStat label="Monthly salary (net)" value={snapshot.salaryNet} />
      </dl>

      {/* Pending Life Event */}
      {snapshot.pendingLifeEvent ? (
        <div className="mt-8">
          <LifeEventCard
            templateKey={snapshot.pendingLifeEvent.templateKey}
            description={snapshot.pendingLifeEvent.description}
            choices={snapshot.pendingLifeEvent.choices}
          />
        </div>
      ) : null}

      {/* Recent Activity */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Recent activity
        </h2>
        <RecentEntries entries={snapshot.recentLedger} />
      </section>
    </>
  );
}

function StatBadge({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="rounded border border-border-subtle bg-background p-3">
      <div className="flex justify-between text-xs">
        <span className="uppercase tracking-wider text-muted">{label}</span>
        <span className="font-semibold tabular-nums">{value}/100</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-border-subtle">
        <div
          className={`h-full ${value < 25 ? "bg-red-500" : value < 50 ? "bg-amber-500" : "bg-emerald-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function FinancialStat({
  label,
  value,
}: {
  label: string;
  value: bigint;
}) {
  return (
    <div className="rounded border border-border-subtle bg-background px-4 py-3">
      <dt className="font-mono text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-medium tabular-nums">{currency(value)}</dd>
    </div>
  );
}

function RecentEntries({
  entries,
}: {
  entries: {
    readonly tick: number;
    readonly text: string;
    readonly amountMinor: bigint;
  }[];
}) {
  return (
    <ul className="space-y-1">
      {entries.map((entry, idx) => (
        <li
          key={`${entry.tick}-${entry.text}-${idx}`}
          className="flex justify-between rounded border border-border-subtle/50 bg-background px-3 py-2 text-sm"
        >
          <span className="text-muted">Month {entry.tick} · {entry.text}</span>
          <span
            className={`tabular-nums font-medium ${entry.amountMinor >= 0n ? "text-green-700" : "text-red-700"}`}
          >
            {entry.amountMinor >= 0n ? "+" : ""}
            {currency(entry.amountMinor)}
          </span>
        </li>
      ))}
      {entries.length === 0 && (
        <li className="text-sm text-muted">No activity yet — advance a month to begin.</li>
      )}
    </ul>
  );
}
