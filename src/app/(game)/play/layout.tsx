import Link from "next/link";
import { maybeUserId } from "@/server/session";
import { redirect } from "next/navigation";

export default async function GameLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const userId = await maybeUserId();
  if (!userId) {
    redirect("/login");
  }

  const session = userId as { gameId?: unknown };
  if (!session.gameId) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="flex gap-4 border-b border-border-subtle pb-3 text-sm">
        <Link
          href="/play"
          className="rounded border border-transparent px-3 py-1 font-medium hover:border-border-subtle hover:bg-background"
        >
          Dashboard
        </Link>
        <Link
          href="/play/market"
          className="rounded border border-transparent px-3 py-1 font-medium hover:border-border-subtle hover:bg-background"
        >
          Market
        </Link>
        <Link
          href="/play/portfolio"
          className="rounded border border-transparent px-3 py-1 font-medium hover:border-border-subtle hover:bg-background"
        >
          Portfolio
        </Link>
        <Link
          href="/play/academy"
          className="rounded border border-transparent px-3 py-1 font-medium hover:border-border-subtle hover:bg-background"
        >
          Academy
        </Link>
      </nav>
      <main className="mt-6 space-y-10">{children}</main>
    </div>
  );
}
