import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { listSaveSlots } from "@/server/services/save-service";
import { MAX_SAVE_SLOTS } from "@/domain/saves";
import { currency } from "@/domain/money";
import { PageHeader, Panel, PanelHeader } from "@/components/game/ui";
import { SlotActions } from "@/components/game/slot-actions";
import {
  IconArrowRight,
  IconBolt,
  IconCandles,
  IconCoin,
  IconPlus,
  IconShield,
  IconWallet,
} from "@/components/icons";

export const instant = false;

export default async function StartPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const slots = await listSaveSlots(userId);
  const activeSlot = slots.find((slot) => slot.status === "ACTIVE");
  const filled = slots.length;
  const empty = Math.max(0, MAX_SAVE_SLOTS - filled);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="MarketLife Exchange · Pusat simpanan"
        title="Pilih takdir tradingmu"
        description={`Setiap akun punya ${MAX_SAVE_SLOTS} slot kehidupan. Satu slot dimainkan sekaligus; sisanya tersimpan rapi dan bisa dilanjutkan kapan saja.`}
        actions={
          <>
            {activeSlot ? (
              <Link
                href="/play"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
              >
                Lanjutkan permainan
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            <Link
              href={empty > 0 ? "/play/new" : "/play/start"}
              aria-disabled={empty === 0}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-black transition ${
                empty > 0
                  ? "border border-line bg-surface text-white hover:border-brand/40 hover:text-brand"
                  : "cursor-not-allowed border border-line/60 bg-surface/40 text-muted"
              }`}
            >
              <IconPlus className="h-3.5 w-3.5" />
              {empty > 0 ? "Karakter baru" : "Slot penuh"}
            </Link>
          </>
        }
      />

      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#101a16] via-[#0d1214] to-[#0b0e11] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand">
              Selamat datang kembali
            </p>
            <h2 className="mt-2 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl">
              Mulai dari Rp 10 miliar. Bangun portofolio, kalahkan pasar, dan
              jalani hidup yang kamu pilih.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Harga kripto dan saham bergerak tiap bulan. Spot, futures hingga
              20x, forex, obligasi, ekonomi perusahaan, dan mini-game trading
              semuanya tersedia dalam satu akun demo.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { icon: IconCandles, label: "Spot saham & kripto" },
                { icon: IconBolt, label: "Futures 20x" },
                { icon: IconCoin, label: "Forex & konversi" },
                { icon: IconShield, label: "Nol risiko" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/70 px-2.5 py-1.5 text-[10px] font-bold text-[#c7ccd4]"
                >
                  <item.icon className="h-3.5 w-3.5 text-brand" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface/80 p-3">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">
                Slot terpakai
              </dt>
              <dd className="mt-1 text-xl font-black tabular-nums text-white">
                {filled}
                <span className="text-sm font-bold text-muted">/{MAX_SAVE_SLOTS}</span>
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface/80 p-3">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">
                Modal awal
              </dt>
              <dd className="mt-1 text-xl font-black text-white">Rp 10 M</dd>
            </div>
            <div className="rounded-xl border border-line bg-surface/80 p-3">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">
                Slot kosong
              </dt>
              <dd className="mt-1 text-xl font-black tabular-nums text-brand">
                {empty}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface/80 p-3">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">
                Status
              </dt>
              <dd className="mt-1 text-xs font-black text-white">
                {activeSlot ? "Siap dimainkan" : "Belum ada karakter"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Slot simpanan"
          subtitle="Pilih slot untuk dilanjutkan atau mulai kehidupan baru"
          action={
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted">
              <IconWallet className="h-3.5 w-3.5" />
              {filled} terisi · {empty} kosong
            </span>
          }
        />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: MAX_SAVE_SLOTS }, (_, index) => {
            const slot = slots[index];
            if (!slot) {
              return (
                <Link
                  key={`empty-${index}`}
                  href="/play/new"
                  className="group flex min-h-[188px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-elevated/40 p-4 text-center transition hover:border-brand/40 hover:bg-brand/[0.04]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-muted transition group-hover:border-brand/40 group-hover:text-brand">
                    <IconPlus className="h-5 w-5" />
                  </span>
                  <span className="mt-2 text-xs font-black text-white">
                    Slot {index + 1} kosong
                  </span>
                  <span className="mt-1 text-[10px] leading-5 text-muted">
                    Buat karakter dan mulai dengan Rp 10.000.000.000,00
                  </span>
                </Link>
              );
            }

            const isActive = slot.status === "ACTIVE";
            return (
              <div
                key={slot.id}
                className={`flex min-h-[188px] flex-col rounded-xl border p-4 ${
                  isActive
                    ? "border-brand/40 bg-brand/[0.05]"
                    : "border-line bg-elevated"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted">
                      Slot {index + 1} · {slot.backgroundLabel}
                    </p>
                    <h3 className="mt-0.5 truncate text-sm font-black text-white">
                      {slot.firstName} {slot.lastName}
                    </h3>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black ${
                      isActive
                        ? "bg-brand/15 text-brand"
                        : "bg-surface-2 text-muted"
                    }`}
                  >
                    {isActive ? "AKTIF" : "PAUSED"}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <dt className="text-muted">Net worth</dt>
                    <dd className="mt-0.5 truncate text-xs font-black tabular-nums text-white">
                      {currency(slot.netWorthMinor)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Kas</dt>
                    <dd className="mt-0.5 truncate text-xs font-bold tabular-nums text-[#c7ccd4]">
                      {currency(slot.cashMinor)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Pasar</dt>
                    <dd className="mt-0.5 text-xs font-bold text-white">
                      Bulan {slot.tick + 1}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Aset</dt>
                    <dd className="mt-0.5 text-xs font-bold text-white">
                      {slot.holdingsCount} kepemilikan
                    </dd>
                  </div>
                </dl>

                <p className="mt-2 text-[9px] text-[#5e6673]">
                  Terakhir disimpan{" "}
                  {slot.updatedAt.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>

                <div className="mt-auto pt-3">
                  <SlotActions gameId={slot.id} isActive={isActive} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Satu aktif, sisanya aman",
            body: "Melanjutkan slot lain otomatis mem-pause slot yang sedang aktif. Tidak ada progres yang hilang.",
          },
          {
            title: "5 kehidupan, 5 strategi",
            body: "Coba profil konservatif di satu slot dan agresif di slot lain untuk membandingkan hasil.",
          },
          {
            title: "Hapus untuk membuka slot",
            body: "Slot dihapus permanen beserta seluruh riwayatnya. Pastikan sudah selesai sebelum menghapus.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <h3 className="text-xs font-black text-white">{item.title}</h3>
            <p className="mt-1 text-[11px] leading-5 text-muted">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
