import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { gameSnapshot } from "@/server/services/game-service";
import { portfolioSnapshot } from "@/server/services/trade-service";
import { prisma } from "@/server/db";
import { currency } from "@/domain/money";
import { BACKGROUNDS } from "@/domain/character";
import { AdvanceButton } from "@/components/game/advance-button";
import { MarketTable, type MarketRow } from "@/components/game/market-table";
import LifeEventCard from "@/components/game/life-event-card";
import {
  EmptyState,
  Panel,
  PanelHeader,
  ProgressBar,
  StatCard,
} from "@/components/game/ui";
import {
  IconArrowRight,
  IconBolt,
  IconCandles,
  IconChartUp,
  IconCoin,
  IconGraduation,
  IconPie,
  IconWallet,
} from "@/components/icons";

export const instant = false;

interface Mover extends MarketRow {
  changePct: number;
}

const STAT_ROWS = [
  { key: "health", label: "Kesehatan", tone: "up" as const },
  { key: "happiness", label: "Kebahagiaan", tone: "gold" as const },
  { key: "knowledge", label: "Pengetahuan", tone: "brand" as const },
  { key: "reputation", label: "Reputasi", tone: "down" as const },
] as const;

const QUICK_ACTIONS = [
  {
    href: "/play/market",
    label: "Order spot",
    hint: "Beli & jual aset",
    icon: IconCandles,
  },
  {
    href: "/play/crypto",
    label: "Futures",
    hint: "Leverage hingga 20x",
    icon: IconBolt,
    gold: true,
  },
  {
    href: "/play/portfolio",
    label: "Portofolio",
    hint: "Aset & riwayat",
    icon: IconPie,
  },
  {
    href: "/play/academy",
    label: "Akademi",
    hint: "Tingkatkan skill",
    icon: IconGraduation,
  },
] as const;

export default async function ExchangeHome() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const snapshot = await gameSnapshot(userId);
  if (!snapshot) redirect("/play/new");

  const portfolio = await portfolioSnapshot(userId);
  const holdings = portfolio?.holdings ?? [];

  const { rows, movers } = await loadMarket(snapshot.gameId, snapshot.tick);
  const gainers = movers.filter((row) => row.changePct > 0).slice(0, 4);
  const losers = [...movers].reverse().filter((row) => row.changePct < 0).slice(0, 4);

  const character = snapshot.character;
  const background =
    BACKGROUNDS[character.background as keyof typeof BACKGROUNDS]?.label ??
    character.background;
  const initials = `${character.firstName.slice(0, 1)}${character.lastName.slice(0, 1)}`;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface via-[#151b20] to-[#0d1b17] p-5 shadow-[0_30px_90px_-50px_rgba(0,0,0,1)] sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-lg font-black text-brand shadow-[0_0_30px_-10px_rgba(0,192,135,0.6)]">
              {initials}
            </span>
            <div>
              <p className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_10px_rgba(0,192,135,0.9)]" />
                MarketLife Exchange · Akun demo
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Selamat datang, {character.firstName}
              </h1>
              <p className="mt-1 text-xs text-muted">
                {snapshot.date} · pasar ke-{snapshot.tick} · {rows.length} instrumen
                diperdagangkan · profil {background}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/play/wallet"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#04120e] transition hover:bg-brand-strong"
            >
              <IconWallet className="h-4 w-4" />
              Tambah dana
            </Link>
            <AdvanceButton isLarge />
          </div>
        </div>

        <div className="relative mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-xl border border-line bg-elevated/80 px-3 py-2.5 transition hover:border-brand/40 hover:bg-surface-2"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    "gold" in action && action.gold
                      ? "bg-gold/12 text-gold"
                      : "bg-brand/12 text-brand"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white">
                    {action.label}
                  </span>
                  <span className="block truncate text-[10px] text-muted">
                    {action.hint}
                  </span>
                </span>
                <IconArrowRight className="h-3.5 w-3.5 text-[#5e6673] transition group-hover:text-brand" />
              </Link>
            );
          })}
        </div>
      </section>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo tersedia"
          value={currency(snapshot.cashMinor)}
          hint="Siap dipakai order spot"
          icon={<IconWallet className="h-4 w-4" />}
        />
        <StatCard
          label="Nilai portofolio"
          value={currency(snapshot.portfolioValue)}
          hint={`${holdings.length} aset diperdagangkan`}
          icon={<IconCandles className="h-4 w-4" />}
        />
        <StatCard
          label="Total ekuitas"
          value={currency(snapshot.netWorth)}
          tone="brand"
          hint="Kas + nilai pasar aset"
          icon={<IconPie className="h-4 w-4" />}
        />
        <StatCard
          label="Pendapatan bulanan"
          value={currency(snapshot.salaryNet)}
          tone="gold"
          hint="Gaji bersih dari karier aktif"
          icon={<IconChartUp className="h-4 w-4" />}
        />
      </dl>

      {snapshot.pendingLifeEvent ? (
        <LifeEventCard
          templateKey={snapshot.pendingLifeEvent.templateKey}
          description={snapshot.pendingLifeEvent.description}
          choices={snapshot.pendingLifeEvent.choices.map((choice) => ({
            key: choice.key,
            text: `${choice.text}${choice.hint ? ` — ${choice.hint}` : ""}`,
          }))}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <section>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-white">Watchlist pasar</h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  Pergerakan harga pada tick terakhir. Klik aset untuk membuka
                  grafik dan panel order.
                </p>
              </div>
              <Link
                href="/play/market"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-brand transition hover:text-brand-strong"
              >
                Katalog lengkap
                <IconArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <MarketTable rows={rows} compact />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <MoverPanel
              title="Top gainers"
              subtitle="Kenaikan tertinggi bulan ini"
              rows={gainers}
              tone="up"
            />
            <MoverPanel
              title="Top losers"
              subtitle="Penurunan terdalam bulan ini"
              rows={losers}
              tone="down"
            />
          </div>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              title="Kondisi karakter"
              subtitle={`${character.firstName} ${character.lastName} · usia ${snapshot.age}`}
              action={
                <Link
                  href="/play/academy"
                  className="text-[10px] font-bold text-brand transition hover:text-brand-strong"
                >
                  Latih →
                </Link>
              }
            />
            <div className="space-y-3 p-4">
              {STAT_ROWS.map((stat) => {
                const value = character[stat.key];
                return (
                  <div key={stat.key}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted">{stat.label}</span>
                      <span className="font-bold tabular-nums text-white">
                        {value}
                        <span className="text-[10px] font-normal text-[#5e6673]">
                          /100
                        </span>
                      </span>
                    </div>
                    <ProgressBar value={value} tone={stat.tone} />
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Kepemilikan"
              subtitle={`${holdings.length} aset di portofolio`}
              action={
                <Link
                  href="/play/portfolio"
                  className="text-[10px] font-bold text-brand transition hover:text-brand-strong"
                >
                  Semua →
                </Link>
              }
            />
            {holdings.length === 0 ? (
              <div className="p-4">
                <EmptyState>
                  Belum ada aset. Mulai dari katalog pasar atau panel order.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line/70">
                {holdings.slice(0, 6).map((holding) => {
                  const up = holding.unrealizedMinor >= 0n;
                  return (
                    <li
                      key={holding.symbol}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line-soft text-[9px] font-black text-[#c7ccd4]">
                          {holding.symbol.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white">
                            {holding.symbol}
                          </div>
                          <div className="truncate text-[10px] text-muted">
                            {holding.quantity.toLocaleString("en-US")} unit
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold tabular-nums text-white">
                          {currency(holding.marketValueMinor)}
                        </div>
                        <div
                          className={`text-[10px] font-bold tabular-nums ${
                            up ? "text-up" : "text-down"
                          }`}
                        >
                          {up ? "+" : ""}
                          {currency(holding.unrealizedMinor)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Aktivitas terakhir"
              subtitle="Mutasi ledger akun demo"
              action={<IconCoin className="h-4 w-4 text-muted" />}
            />
            {snapshot.recentLedger.length === 0 ? (
              <div className="p-4">
                <EmptyState>
                  Belum ada transaksi. Tambah dana lalu buat order pertama.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line/70">
                {snapshot.recentLedger.slice(0, 6).map((entry, index) => {
                  const positive = entry.amountMinor >= 0n;
                  return (
                    <li
                      key={`${entry.tick}-${index}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-[11px]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[#c7ccd4]">
                          {entry.text}
                        </span>
                        <span className="block text-[10px] text-[#5e6673]">
                          Tick #{entry.tick}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-bold tabular-nums ${
                          positive ? "text-up" : "text-down"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {currency(entry.amountMinor)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MoverPanel({
  title,
  subtitle,
  rows,
  tone,
}: {
  title: string;
  subtitle: string;
  rows: Mover[];
  tone: "up" | "down";
}) {
  return (
    <Panel>
      <PanelHeader title={title} subtitle={subtitle} />
      <ul className="divide-y divide-line/70">
        {rows.map((row) => (
          <li key={`${row.kind}-${row.symbol}`}>
            <Link
              href={
                row.kind === "CRYPTO"
                  ? `/play/crypto/${row.symbol}`
                  : `/play/market/${row.symbol}`
              }
              className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-surface-2/50"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                    row.kind === "CRYPTO"
                      ? "bg-gold/12 text-gold"
                      : "bg-[#6f8dff]/12 text-[#6f8dff]"
                  }`}
                >
                  {row.symbol.slice(0, 2)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-white">
                    {row.symbol}
                  </span>
                  <span className="block truncate text-[10px] text-muted">
                    {row.name}
                  </span>
                </span>
              </span>
              <span
                className={`shrink-0 text-xs font-bold tabular-nums ${
                  tone === "up" ? "text-up" : "text-down"
                }`}
              >
                {row.changePct > 0 ? "+" : ""}
                {row.changePct.toFixed(2)}%
              </span>
            </Link>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-4 py-4">
            <EmptyState>
              Belum ada pergerakan. Majukan pasar untuk melihat harga bergerak.
            </EmptyState>
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}

async function loadMarket(gameId: string, tick: number) {
  const assets = await prisma.asset.findMany({ orderBy: { symbol: "asc" } });
  const current = await prisma.pricePoint.findMany({ where: { gameId, tick } });
  const previous =
    tick > 0
      ? await prisma.pricePoint.findMany({ where: { gameId, tick: tick - 1 } })
      : [];

  const currentMap = new Map(current.map((point) => [point.assetId, point.priceMinor]));
  const previousMap = new Map(previous.map((point) => [point.assetId, point.priceMinor]));

  const rows: MarketRow[] = assets.map((asset) => {
    const priceMinor = currentMap.get(asset.id) ?? asset.fundamentalMinor;
    return {
      symbol: asset.symbol,
      name: asset.name,
      sector: asset.sector,
      kind: asset.kind,
      priceMinor,
      prevPriceMinor: previousMap.get(asset.id) ?? priceMinor,
    };
  });

  const movers: Mover[] = rows
    .filter((row) => row.prevPriceMinor > 0n)
    .map((row) => ({
      ...row,
      changePct: (Number(row.priceMinor - row.prevPriceMinor) / Number(row.prevPriceMinor)) * 100,
    }))
    .sort((a, b) => b.changePct - a.changePct);

  return { rows, movers };
}
