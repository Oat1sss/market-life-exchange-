import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { gameSnapshot } from "@/server/services/game-service";
import { depositHistory } from "@/server/services/funding-service";
import { DepositForm } from "@/components/game/deposit-form";
import { currency } from "@/domain/money";
import { depositMethod } from "@/domain/funding";
import { EmptyState, PageHeader, Panel, PanelHeader, StatCard } from "@/components/game/ui";
import { IconArrowRight, IconCandles, IconPie, IconWallet } from "@/components/icons";

export const instant = false;

export default async function WalletPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const snapshot = await gameSnapshot(userId);
  if (!snapshot) redirect("/play/new");

  const history = await depositHistory(userId, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Dompet demo"
        title="Tambah dana"
        description="Isi saldo simulasi lewat transfer bank, virtual account, e-wallet, kartu, atau setoran kripto. Dana langsung tersedia untuk trading di pasar spot dan futures."
        actions={
          <>
            <Link
              href="/play"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-[#c7ccd4] transition hover:border-brand/40 hover:text-brand"
            >
              <IconArrowRight className="h-3.5 w-3.5 rotate-180" />
              Beranda
            </Link>
            <Link
              href="/play/market"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
            >
              <IconCandles className="h-3.5 w-3.5" />
              Mulai trading
            </Link>
          </>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Saldo tersedia"
          value={currency(snapshot.cashMinor)}
          hint="Langsung bisa dipakai order pasar"
          icon={<IconWallet className="h-4 w-4" />}
        />
        <StatCard
          label="Nilai portofolio"
          value={currency(snapshot.portfolioValue)}
          hint="Spot + margin futures"
          icon={<IconPie className="h-4 w-4" />}
        />
        <StatCard
          label="Total ekuitas"
          value={currency(snapshot.netWorth)}
          tone="brand"
          hint={`${snapshot.date} · pasar ke-${snapshot.tick}`}
        />
      </dl>

      <DepositForm />

      <Panel>
        <PanelHeader
          title="Riwayat deposit"
          subtitle="Transaksi terbaru lebih dulu"
          action={
            <span className="rounded border border-line bg-elevated px-2 py-1 text-[10px] font-bold text-muted">
              {history.length} transaksi
            </span>
          }
        />
        {history.length === 0 ? (
          <div className="p-4">
            <EmptyState>
              Belum ada deposit. Pilih metode di atas untuk mengisi saldo demo.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-semibold">Metode</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Diterima</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Saldo setelah</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {history.map((row) => (
                  <tr key={row.id} className="transition hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <span className="block font-bold text-white">
                        {depositMethod(row.method)?.label ?? row.method}
                      </span>
                      <span className="block text-[10px] text-[#5e6673]">
                        Deposit demo
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-up">
                      +{currency(row.amountMinor)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                      {currency(row.balanceAfterMinor)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {row.createdAt.toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
