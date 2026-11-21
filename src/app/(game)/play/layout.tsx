import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { prisma } from "@/server/db";
import { currency } from "@/domain/money";
import { Brand, BrandMark } from "@/components/brand";
import { IconPlus, IconUser } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { AdvanceButton } from "@/components/game/advance-button";
import { GameNav } from "@/components/game/game-nav";
import { MarketTicker } from "@/components/game/market-ticker";

export default async function GameLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const userId = await maybeUserId();
  if (!userId) {
    redirect("/login");
  }

  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      tick: true,
      character: { select: { firstName: true } },
      portfolio: { select: { cashMinor: true } },
    },
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b border-line bg-[#0b0e11]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0b0e11]/85">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2.5 sm:gap-x-3">
          <Link href="/play" className="sm:hidden" aria-label="MarketLife Exchange">
            <BrandMark className="h-8 w-8" />
          </Link>
          <div className="hidden sm:block">
            <Brand href="/play" compact />
          </div>
          <span className="hidden h-5 w-px bg-line lg:block" />
          <GameNav />

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {game?.portfolio ? (
              <div className="hidden rounded-lg border border-line bg-surface px-3 py-1.5 text-right md:block">
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted">
                  Saldo
                </div>
                <div className="text-xs font-black tabular-nums text-white">
                  {currency(game.portfolio.cashMinor)}
                </div>
              </div>
            ) : null}

            <Link
              href="/play/wallet"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-2.5 text-[11px] font-black text-[#04120e] transition hover:bg-brand-strong"
            >
              <IconPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Deposit</span>
            </Link>

            {game ? <AdvanceButton /> : null}

            <Link
              href="/play/portfolio"
              aria-label="Buka portofolio"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-brand/40 hover:text-brand"
            >
              <IconUser className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {game ? <MarketTicker gameId={game.id} tick={game.tick} /> : null}
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:py-6">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
