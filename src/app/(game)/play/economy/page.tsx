import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { prisma } from "@/server/db";
import { currency } from "@/domain/money";
import {
  CONTROL_TIERS,
  DIRECTIVES,
  DIRECTIVE_BY_KIND,
  DIRECTIVE_COOLDOWN_MONTHS,
  PACE_KEYS,
  PACES,
  SECTOR_BY_KEY,
  canIssue,
  dividendPayout,
  economySnapshot,
  isPaceKey,
  stakeViews,
  type CompanyState,
  type MacroPoint,
  type NewsStory,
} from "@/domain/economy";
import { BoardConsole } from "@/components/game/board-console";
import { loadDirectives } from "@/server/services/control-service";
import {
  EmptyState,
  KeyValue,
  PageHeader,
  Panel,
  PanelHeader,
  ProgressBar,
  StatCard,
  cx,
} from "@/components/game/ui";
import { IconChartUp, IconCoin, IconShield } from "@/components/icons";

export const instant = false;

const STATUS_STYLE: Record<CompanyState["status"], { label: string; className: string }> = {
  HEALTHY: { label: "Sehat", className: "bg-up/12 text-up ring-up/20" },
  STRESSED: { label: "Tertekan", className: "bg-gold/12 text-gold ring-gold/20" },
  DISTRESSED: { label: "Krisis", className: "bg-down/12 text-down ring-down/20" },
};

const TONE_CLASS: Record<NewsStory["tone"], string> = {
  POSITIVE: "text-up",
  NEGATIVE: "text-down",
  NEUTRAL: "text-[#c7ccd4]",
};

const pct = (bp: number) => `${(bp / 100).toFixed(2)}%`;
const signedPct = (bp: number) => `${bp > 0 ? "+" : ""}${(bp / 100).toFixed(2)}%`;

export default async function EconomyPage({
  searchParams,
}: {
  searchParams: Promise<{ pace?: string }>;
}) {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      seed: true,
      tick: true,
      startDate: true,
      portfolio: {
        select: {
          holdings: { select: { quantity: true, asset: { select: { symbol: true } } } },
        },
      },
    },
  });
  if (!game) redirect("/play/new");

  const requested = (await searchParams).pace;
  const pace = isPaceKey(requested) ? requested : "MONTH";

  const assets = await prisma.asset.findMany({
    where: { kind: "STOCK" },
    orderBy: { symbol: "asc" },
  });

  const { inputs: directives, rows: directiveRows } = await loadDirectives(game.id);
  const world = economySnapshot({
    seed: game.seed,
    assets,
    pace,
    monthsElapsed: game.tick,
    startYear: game.startDate.getUTCFullYear(),
    startMonth: game.startDate.getUTCMonth() + 1,
    directives,
  });

  const holdings =
    game.portfolio?.holdings.map((holding) => ({
      symbol: holding.asset.symbol,
      quantity: holding.quantity,
    })) ?? [];
  const stakes = stakeViews(world.companies, holdings);
  const stakeBySymbol = new Map(stakes.map((stake) => [stake.symbol, stake]));

  const lastDirectiveBySymbol = new Map<string, (typeof directiveRows)[number]>();
  for (const row of directiveRows) {
    const previous = lastDirectiveBySymbol.get(row.companySymbol);
    if (!previous || row.atMonth > previous.atMonth) {
      lastDirectiveBySymbol.set(row.companySymbol, row);
    }
  }

  // A BLOCKING (10%) stake is a board seat: enough to force resolutions.
  const boardSeats = stakes
    .filter((stake) => canIssue("DIVIDEND", stake.stakePct))
    .slice(0, 4)
    .flatMap((stake) => {
      const company = world.companies.find((candidate) => candidate.symbol === stake.symbol);
      if (!company) return [];
      const last = lastDirectiveBySymbol.get(stake.symbol);
      const payout = dividendPayout(company);
      return [
        {
          symbol: stake.symbol,
          name: stake.name,
          stakePct: stake.stakePct,
          cooldownUntil: last ? last.atMonth + DIRECTIVE_COOLDOWN_MONTHS : null,
          dividendPreview:
            (payout * BigInt(stake.quantity)) /
            BigInt(Math.max(1, company.sharesOutstanding)),
          lastResolution: last
            ? `${DIRECTIVE_BY_KIND[last.kind].label} disahkan pada bulan ke-${last.atMonth}`
            : null,
          options: DIRECTIVES.map((definition) => ({
            kind: definition.kind,
            label: definition.label,
            hint: `${definition.hint} ${definition.effect}`,
            allowed: canIssue(definition.kind, stake.stakePct),
          })),
        },
      ];
    });
  const government = world.government;
  const index = world.indices[0];

  const ranked = [...world.companies]
    .sort(
      (a, b) =>
        Number(b.priceMinor) * b.sharesOutstanding -
        Number(a.priceMinor) * a.sharesOutstanding,
    )
    .slice(0, 14);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Simulasi makro · deterministik dari seed permainan"
        title="Ekonomi dunia"
        description={
          <>
            Harga saham sekarang bergerak dari laba perusahaan, biaya komoditas,
            kebijakan pemerintah, dan pemberitaan media — bukan cuma dari headline
            acak. Kalender berjalan sampai {world.monthLabel} pada resolusi{" "}
            {PACES[pace].label.toLowerCase()}.
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1">
            {PACE_KEYS.map((key) => (
              <Link
                key={key}
                href={`/play/economy?pace=${key}`}
                className={cx(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-bold transition",
                  key === pace
                    ? "bg-brand/15 text-brand ring-1 ring-inset ring-brand/25"
                    : "text-muted hover:bg-surface-2 hover:text-white",
                )}
              >
                {PACES[key].label.replace("Per ", "")}
              </Link>
            ))}
          </div>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pertumbuhan PDB"
          value={pct(government.gdpGrowthBp)}
          tone={government.gdpGrowthBp >= 240 ? "up" : "down"}
          hint="Tahunan, dipengaruhi stimulus & suku bunga"
          icon={<IconChartUp className="h-4 w-4" />}
        />
        <StatCard
          label="Inflasi"
          value={pct(government.inflationBp)}
          tone={government.inflationBp > 400 ? "down" : "gold"}
          hint="Biaya energi & upah menekan margin"
          icon={<IconCoin className="h-4 w-4" />}
        />
        <StatCard
          label="Suku bunga acuan"
          value={pct(government.policyRateBp)}
          hint="Bank sentral bereaksi tiap kuartal"
          icon={<IconShield className="h-4 w-4" />}
        />
        <StatCard
          label="Persetujuan pemerintah"
          value={`${government.approvalPct}%`}
          tone={government.approvalPct >= 50 ? "brand" : "down"}
          hint={`${government.partyLabel} · pemilu ${Math.max(
            0,
            Math.round(government.electionInMonths),
          )} bulan lagi`}
        />
      </dl>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Pemerintah & kebijakan"
              subtitle={`${government.leader} · ${government.partyLabel}`}
              action={
                <span className="rounded bg-elevated px-2 py-1 text-[10px] font-bold text-muted">
                  {pct(government.taxRateBp)} pajak korporasi
                </span>
              }
            />
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted">Dukungan publik</span>
                  <span className="font-bold tabular-nums text-white">
                    {government.approvalPct}%
                  </span>
                </div>
                <ProgressBar
                  value={government.approvalPct}
                  tone={government.approvalPct >= 50 ? "brand" : "down"}
                />
              </div>
              <p className="rounded-lg border border-line bg-elevated px-3 py-2 text-[11px] leading-5 text-[#c7ccd4]">
                {government.lastAction}
              </p>
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <KeyValue label="Pengangguran" value={pct(government.unemploymentBp)} />
                <KeyValue label="Tarif impor" value={pct(government.tariffBp)} />
                <KeyValue label="Stimulus fiskal" value={`${government.stimulusBp} bp`} />
                <KeyValue label="Utang negara" value={currency(government.debtMinor)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {world.sectors.map((sector) => (
                  <div key={sector.key} className="rounded-lg border border-line bg-elevated p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {sector.name}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between text-[11px]">
                      <span className="text-down">Regulasi</span>
                      <span className="font-bold tabular-nums text-white">
                        {government.regulationBp[sector.key]} bp
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between text-[11px]">
                      <span className="text-up">Subsidi</span>
                      <span className="font-bold tabular-nums text-white">
                        {government.subsidyBp[sector.key]} bp
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Perusahaan terbesar"
              subtitle={`${world.companies.length} emiten tersimulasi · ${world.monthLabel}`}
              action={
                <span
                  className={cx(
                    "text-[11px] font-bold tabular-nums",
                    (index?.changePct ?? 0) >= 0 ? "text-up" : "text-down",
                  )}
                >
                  MLX {index?.level.toLocaleString("en-US")} ·{" "}
                  {(index?.changePct ?? 0) >= 0 ? "+" : ""}
                  {(index?.changePct ?? 0).toFixed(2)}%
                </span>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[11px]">
                <thead className="text-[9px] font-bold uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2">Emiten</th>
                    <th className="px-2 py-2 text-right">Harga</th>
                    <th className="px-2 py-2 text-right">Perubahan</th>
                    <th className="px-2 py-2 text-right">Margin</th>
                    <th className="px-2 py-2 text-right">Laba/bln</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Saham Anda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {ranked.map((company) => {
                    const status = STATUS_STYLE[company.status];
                    const stake = stakeBySymbol.get(company.symbol);
                    return (
                      <tr key={company.symbol} className="hover:bg-surface-2/40">
                        <td className="px-4 py-2">
                          <div className="font-bold text-white">{company.symbol}</div>
                          <div className="truncate text-[10px] text-muted">
                            {company.name} · {SECTOR_BY_KEY[company.sector].name}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-white">
                          {currency(company.priceMinor)}
                        </td>
                        <td
                          className={cx(
                            "px-2 py-2 text-right font-bold tabular-nums",
                            company.changeBp >= 0 ? "text-up" : "text-down",
                          )}
                        >
                          {signedPct(company.changeBp)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-[#c7ccd4]">
                          {pct(company.marginBp)}
                        </td>
                        <td
                          className={cx(
                            "px-2 py-2 text-right tabular-nums",
                            company.earningsMinor >= 0n ? "text-up" : "text-down",
                          )}
                        >
                          {currency(company.earningsMinor)}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={cx(
                              "inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                              status.className,
                            )}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {stake ? (
                            <span className="font-bold text-white">
                              {stake.stakePct.toFixed(2)}%
                              <span className="ml-1 text-[10px] font-medium text-muted">
                                {stake.tier.label}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[#5e6673]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Komoditas"
              subtitle="Harga spot yang menjadi biaya input perusahaan"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead className="text-[9px] font-bold uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2">Komoditas</th>
                    <th className="px-2 py-2 text-right">Harga</th>
                    <th className="px-2 py-2 text-right">Perubahan</th>
                    <th className="px-2 py-2 text-right">Pasokan</th>
                    <th className="px-2 py-2 text-right">Permintaan</th>
                    <th className="px-4 py-2 text-right">Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {world.resources.map((resource) => (
                    <tr key={resource.key} className="hover:bg-surface-2/40">
                      <td className="px-4 py-2">
                        <span className="font-bold text-white">{resource.name}</span>
                        <span className="ml-1 text-[10px] text-muted">/{resource.unit}</span>
                        {resource.strategic ? (
                          <span className="ml-1.5 rounded bg-gold/12 px-1 py-px text-[9px] font-bold text-gold">
                            strategis
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-white">
                        {currency(resource.priceMinor)}
                      </td>
                      <td
                        className={cx(
                          "px-2 py-2 text-right font-bold tabular-nums",
                          resource.changeBp >= 0 ? "text-up" : "text-down",
                        )}
                      >
                        {signedPct(resource.changeBp)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#c7ccd4]">
                        {resource.supplyIndex.toFixed(0)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#c7ccd4]">
                        {resource.demandIndex.toFixed(0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#c7ccd4]">
                        {resource.stockpileIndex.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              title="Berita pasar"
              subtitle="Media memindahkan sentimen dan kebijakan"
              action={<IconCoin className="h-4 w-4 text-muted" />}
            />
            <MacroSpark points={world.macro} />
            {world.news.length === 0 ? (
              <div className="p-4">
                <EmptyState>Belum ada pemberitaan pada resolusi ini.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line/70">
                {world.news.slice(0, 6).map((story) => (
                  <li key={story.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#5e6673]">
                      <span className={TONE_CLASS[story.tone]}>{story.outlet}</span>
                      <span>·</span>
                      <span>{story.kind}</span>
                      <span>·</span>
                      <span>kredibilitas {story.credibilityPct}%</span>
                    </div>
                    <p className="mt-1 text-[11px] font-bold leading-4 text-white">
                      {story.headline}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted">{story.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Pasar valuta & obligasi" subtitle="Reaksi terhadap suku bunga" />
            <ul className="divide-y divide-line/70">
              {world.fx.map((quote) => (
                <li
                  key={quote.pair}
                  className="flex items-center justify-between gap-3 px-4 py-2"
                >
                  <span>
                    <span className="block text-[11px] font-bold text-white">{quote.pair}</span>
                    <span className="block text-[10px] text-muted">{quote.label}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[11px] font-semibold tabular-nums text-white">
                      {quote.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                    </span>
                    <span
                      className={cx(
                        "block text-[10px] font-bold tabular-nums",
                        quote.changePct >= 0 ? "text-up" : "text-down",
                      )}
                    >
                      {quote.changePct >= 0 ? "+" : ""}
                      {quote.changePct.toFixed(2)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <ul className="divide-y divide-line/70 border-t border-line">
              {world.bonds.map((bond) => (
                <li key={bond.key} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold text-white">
                      {bond.name}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {bond.rating} · {bond.maturityYears} tahun · kupon {pct(bond.couponBp)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] font-semibold tabular-nums text-white">
                      {pct(bond.yieldBp)}
                    </span>
                    <span
                      className={cx(
                        "block text-[10px] font-bold tabular-nums",
                        bond.yieldBp > bond.prevYieldBp ? "text-down" : "text-up",
                      )}
                    >
                      harga {bond.price.toFixed(2)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-4 py-2.5">
              <Link
                href="/play/bonds"
                className="text-[10px] font-bold text-brand transition hover:text-brand-strong"
              >
                Trading obligasi dengan kupon bulanan →
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Kepemilikan & kendali"
              subtitle="Ambang kendali dihitung dari saham beredar"
            />
            {stakes.length === 0 ? (
              <div className="p-4">
                <EmptyState>
                  Belum ada saham emiten tersimulasi. Beli di pasar untuk mulai
                  mengumpulkan porsi kendali.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line/70">
                {stakes.slice(0, 5).map((stake) => (
                  <li key={stake.symbol} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-white">
                        {stake.symbol}
                        <span className="ml-1 text-[10px] font-medium text-muted">
                          {stake.tier.label}
                        </span>
                      </span>
                      <span className="font-bold tabular-nums text-brand">
                        {stake.stakePct.toFixed(2)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={
                        stake.next
                          ? (stake.stakePct / stake.next.thresholdPct) * 100
                          : 100
                      }
                      tone="gold"
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-[10px] text-muted">
                      {stake.quantity.toLocaleString("en-US")} /{" "}
                      {stake.sharesOutstanding.toLocaleString("en-US")} saham
                      {stake.next
                        ? ` · ${stake.sharesToNext.toLocaleString("en-US")} saham lagi untuk ${stake.next.label}`
                        : " · kendali penuh"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line px-4 py-2.5">
              <div className="flex flex-wrap gap-1.5">
                {CONTROL_TIERS.map((tier) => (
                  <span
                    key={tier.key}
                    title={tier.note}
                    className="rounded bg-elevated px-1.5 py-0.5 text-[9px] font-bold text-muted ring-1 ring-inset ring-line"
                  >
                    {tier.label} ≥ {tier.thresholdPct}%
                  </span>
                ))}
              </div>
              {boardSeats.length > 0 ? (
                <a
                  href="#dewan"
                  className="mt-2 inline-block text-[10px] font-bold text-brand transition hover:text-brand-strong"
                >
                  Buka ruang rapat dewan →
                </a>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      <div id="dewan">
      <Panel>
        <PanelHeader
          title="Ruang rapat dewan"
          subtitle="Keputusan mengikat perusahaan dan berlaku mulai tick berikutnya"
          action={
            <span className="rounded bg-elevated px-2 py-1 text-[10px] font-bold text-muted">
              {boardSeats.length} kursi dewan
            </span>
          }
        />
        {boardSeats.length === 0 ? (
          <div className="p-4">
            <EmptyState>
              Pegang minimal 10% saham satu emiten untuk mendapat kursi dewan dan
              memaksa resolusi. Ambang lain: 25% menentukan strategi, 51% kendali penuh.
            </EmptyState>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {boardSeats.map((seat) => (
              <div key={seat.symbol} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-[#c7ccd4]">
                    <span className="font-black text-white">{seat.symbol}</span>{" "}
                    {seat.name}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-gold">
                    {seat.stakePct.toFixed(2)}%
                  </span>
                </div>
                <BoardConsole
                  symbol={seat.symbol}
                  name={seat.name}
                  stakePct={seat.stakePct}
                  tick={game.tick}
                  cooldownUntil={seat.cooldownUntil}
                  options={seat.options}
                  dividendPreview={seat.dividendPreview}
                  lastResolution={seat.lastResolution}
                />
              </div>
            ))}
          </div>
        )}
        {directiveRows.length > 0 ? (
          <div className="border-t border-line">
            <div className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-wider text-[#5e6673]">
              Risalah dewan
            </div>
            <ul className="divide-y divide-line/70">
              {directiveRows
                .slice(-6)
                .reverse()
                .map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-[10.5px]"
                  >
                    <span className="text-[#c7ccd4]">
                      <span className="font-bold text-white">{row.companySymbol}</span>{" "}
                      · {DIRECTIVE_BY_KIND[row.kind].label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      bulan {row.atMonth}
                      {row.playerPayoutMinor > 0n
                        ? ` · ${currency(row.playerPayoutMinor)}`
                        : ""}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </Panel>
      </div>
    </div>
  );
}

function MacroSpark({ points }: { points: MacroPoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.indexLevel);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const polyline = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 26 - ((value - min) / span) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="border-b border-line px-4 py-2">
      <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#5e6673]">
        <span>Indeks MLX</span>
        <span>{points[points.length - 1].label}</span>
      </div>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-14 w-full">
        <polyline
          points={polyline}
          fill="none"
          stroke="#0ecb81"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
