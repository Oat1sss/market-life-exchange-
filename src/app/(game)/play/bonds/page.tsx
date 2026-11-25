import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { bondSnapshot } from "@/server/services/bond-service";
import { BondSellForm, BondTicket } from "@/components/game/bond-console";
import { currency } from "@/domain/money";
import { currentYieldBp } from "@/domain/bonds";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  SideBadge,
  StatCard,
} from "@/components/game/ui";
import { IconArrowRight, IconShield, IconWallet } from "@/components/icons";

export const instant = false;

function pct(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}

export default async function BondsPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const snapshot = await bondSnapshot(userId);
  if (!snapshot) redirect("/play/new");

  const { instruments, holdings, trades } = snapshot;
  const openLines = instruments.filter((line) => line.monthsLeft > 0);
  const ticketLines = (openLines.length > 0 ? openLines : instruments).map((line) => ({
    key: line.key,
    name: line.name,
    issuer: line.issuer,
    rating: line.rating,
    couponBp: line.couponBp,
    yieldBp: line.yieldBp,
    priceMinor: line.priceMinor,
    monthsLeft: line.monthsLeft,
    monthlyCouponMinor: line.monthlyCouponMinor,
  }));

  const nextMaturity = [...holdings].sort((a, b) => a.monthsLeft - b.monthsLeft)[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pendapatan tetap"
        title="Pasar obligasi"
        description="Beli surat utang negara dan korporasi dengan kupon bulanan. Harga bergerak berlawanan dengan yield makro dan kembali ke nilai nominal saat jatuh tempo."
        actions={
          <>
            <Link
              href="/play/economy"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-[#c7ccd4] transition hover:border-brand/40 hover:text-brand"
            >
              <IconArrowRight className="h-3.5 w-3.5 rotate-180" />
              Ekonomi
            </Link>
            <Link
              href="/play/wallet"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
            >
              <IconWallet className="h-3.5 w-3.5" />
              Tambah dana
            </Link>
          </>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kas tersedia"
          value={currency(snapshot.cashMinor)}
          hint={`Pasar ke-${snapshot.tick}`}
          icon={<IconWallet className="h-4 w-4" />}
        />
        <StatCard
          label="Nilai obligasi"
          value={currency(snapshot.bondValueMinor)}
          hint={`${holdings.length} lini dipegang`}
          icon={<IconShield className="h-4 w-4" />}
        />
        <StatCard
          label="Kupon bulanan"
          value={currency(snapshot.monthlyCouponMinor)}
          tone="brand"
          hint="Dibayar setiap tick pasar"
        />
        <StatCard
          label="Nilai jatuh tempo terdekat"
          value={nextMaturity ? `${nextMaturity.monthsLeft} bln` : "—"}
          tone="gold"
          hint={
            nextMaturity
              ? `${nextMaturity.name} · ${nextMaturity.quantity} unit`
              : "Belum ada obligasi"
          }
        />
      </dl>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader
            title="Kurva obligasi"
            subtitle="Yield dari model makro · harga per unit 100 nominal Rp"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-semibold">Obligasi</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Kupon</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Yield</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Current yield</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Harga</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Jatuh tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {instruments.map((line) => {
                  const yieldUp = line.yieldBp > line.prevYieldBp;
                  const yieldFlat = line.yieldBp === line.prevYieldBp;
                  return (
                    <tr key={line.key} className="transition hover:bg-surface-2/40">
                      <td className="px-4 py-3">
                        <span className="block font-bold text-white">{line.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#5e6673]">
                          <span
                            className={`rounded px-1 py-px font-bold ${
                              line.issuer === "GOVERNMENT"
                                ? "bg-brand/10 text-brand"
                                : "bg-gold/10 text-gold"
                            }`}
                          >
                            {line.issuer === "GOVERNMENT" ? "Negara" : "Korporasi"}
                          </span>
                          {line.rating} · {line.maturityYears} tahun
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                        {pct(line.couponBp)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-bold tabular-nums ${
                          yieldFlat ? "text-white" : yieldUp ? "text-down" : "text-up"
                        }`}
                      >
                        {pct(line.yieldBp)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted">
                        {pct(currentYieldBp(line))}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-white">
                        {currency(line.priceMinor)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#c7ccd4]">
                        {line.monthsLeft > 0 ? `${line.monthsLeft} bln` : "Selesai"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Tiket obligasi" subtitle="Kupon masuk otomatis tiap tick" />
          {ticketLines.length > 0 ? (
            <BondTicket lines={ticketLines} cashMinor={snapshot.cashMinor} />
          ) : (
            <div className="p-4">
              <EmptyState>Semua obligasi sudah jatuh tempo.</EmptyState>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Kepemilikan obligasi"
          subtitle="Ditandai pada harga makro terbaru"
          action={
            <span className="rounded border border-line bg-elevated px-2 py-1 text-[10px] font-bold text-muted">
              {currency(snapshot.bondValueMinor)}
            </span>
          }
        />
        {holdings.length === 0 ? (
          <div className="p-4">
            <EmptyState>
              Belum ada obligasi. Mulai dari tiket di atas — kupon dibayar setiap kali pasar maju satu tick.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-semibold">Obligasi</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Unit</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Harga rata-rata</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Harga kini</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Nilai</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Unrealized</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Kupon/bln</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {holdings.map((holding) => (
                  <tr key={holding.bondKey} className="transition hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <span className="block font-bold text-white">{holding.name}</span>
                      <span className="text-[10px] text-[#5e6673]">
                        {holding.rating} · yield {pct(holding.yieldBp)} ·{" "}
                        {holding.monthsLeft > 0 ? `${holding.monthsLeft} bln lagi` : "jatuh tempo"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-white">
                      {holding.quantity.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                      {currency(holding.avgCostMinor)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-white">
                      {currency(holding.priceMinor)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-white">
                      {currency(holding.valueMinor)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${
                        holding.unrealizedMinor >= 0n ? "text-up" : "text-down"
                      }`}
                    >
                      {holding.unrealizedMinor >= 0n ? "+" : ""}
                      {currency(holding.unrealizedMinor)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-brand">
                      {currency(holding.monthlyCouponMinor)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <BondSellForm
                          bondKey={holding.bondKey}
                          quantity={holding.quantity}
                          name={holding.name}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Riwayat transaksi obligasi" subtitle="12 transaksi terakhir" />
          {trades.length === 0 ? (
            <div className="p-4">
              <EmptyState>Belum ada transaksi obligasi.</EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5 font-semibold">Waktu</th>
                    <th className="px-3 py-2.5 font-semibold">Obligasi</th>
                    <th className="px-3 py-2.5 font-semibold">Aksi</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Unit</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Harga</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Nilai bersih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {trades.map((trade) => (
                    <tr key={trade.id} className="transition hover:bg-surface-2/40">
                      <td className="px-4 py-3 text-muted">
                        {new Date(trade.createdAt).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-3 py-3 font-semibold text-white">{trade.name}</td>
                      <td className="px-3 py-3">
                        <SideBadge side={trade.side} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                        {trade.quantity.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                        {currency(trade.priceMinor)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-white">
                        {currency(trade.netMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Cara kerja" subtitle="Obligasi di MarketLife" />
          <ul className="space-y-2.5 p-4 text-[11px] leading-relaxed text-muted">
            <li className="rounded-lg bg-elevated p-3">
              <span className="font-bold text-brand">Kupon bulanan.</span> Setiap tick,
              kupon tahunan dibagi 12 masuk ke kas untuk setiap unit yang dipegang.
            </li>
            <li className="rounded-lg bg-elevated p-3">
              <span className="font-bold text-gold">Harga vs yield.</span> Yield naik
              berarti harga turun. Harga adalah nilai sekarang dari sisa kupon plus
              pokok Rp 100.
            </li>
            <li className="rounded-lg bg-elevated p-3">
              <span className="font-bold text-white">Jatuh tempo.</span> Saat sisa
              tenor habis, pokok dikembalikan dan unit dilepas otomatis.
            </li>
            <li className="rounded-lg bg-elevated p-3">
              <span className="font-bold text-down">Risiko.</span> Menjual sebelum jatuh
              tempo berarti menerima harga pasar, yang bisa di bawah harga beli.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
