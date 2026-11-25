import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { canCreateGame } from "@/server/services/game-service";
import { CreateCharacterForm } from "@/components/game/create-character-form";
import { BACKGROUNDS } from "@/domain/character";
import { PageHeader, Panel, PanelHeader, ProgressBar } from "@/components/game/ui";
import { IconShield, IconWallet } from "@/components/icons";

export const instant = false;

const PREVIEW_STATS = [
  { key: "health", label: "Kesehatan", tone: "up" as const },
  { key: "happiness", label: "Kebahagiaan", tone: "gold" as const },
  { key: "knowledge", label: "Pengetahuan", tone: "brand" as const },
  { key: "reputation", label: "Reputasi", tone: "down" as const },
];

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
    <div className="space-y-5">
      <PageHeader
        eyebrow="MarketLife Exchange"
        title="Buka akun demo"
        description="Buat akun trading simulasi dan mulai dengan saldo demo Rp 100.000,00. Tidak ada uang sungguhan yang digunakan — semua transaksi berjalan di pasar fiktif."
        actions={
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-[#c7ccd4] transition hover:border-brand/40 hover:text-brand"
          >
            Sudah punya akun? Masuk
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-brand">
            <IconWallet className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Saldo awal
            </span>
          </div>
          <p className="mt-1.5 text-xl font-black tabular-nums text-white">
            Rp 100.000,00
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Bisa ditambah kapan saja lewat dompet demo.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-gold">
            <IconShield className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Mode simulasi
            </span>
          </div>
          <p className="mt-1.5 text-xl font-black text-white">100% aman</p>
          <p className="mt-1 text-[10px] text-muted">
            Tanpa uang nyata, tanpa risiko finansial.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-up">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-up/15 text-[9px] font-black">
              5
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Metode deposit
            </span>
          </div>
          <p className="mt-1.5 text-xl font-black text-white">5 metode</p>
          <p className="mt-1 text-[10px] text-muted">
            Bank, virtual account, e-wallet, kartu, kripto.
          </p>
        </div>
      </div>

      <section>
        <div className="mb-2">
          <h2 className="text-sm font-bold text-white">Pilih profil trader</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Profil menentukan statistik awal karakter. Saldo demo tetap sama untuk
            semua pilihan.
          </p>
        </div>
        <dl className="grid gap-3 md:grid-cols-3">
          {backgroundEntries.map((background) => (
            <div
              key={background.key}
              className="rounded-xl border border-line bg-surface p-4 transition hover:border-brand/30"
            >
              <dt className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">
                  {background.label}
                </span>
                <span className="rounded bg-line-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
                  Profil
                </span>
              </dt>
              <dd className="mt-1 min-h-8 text-[11px] leading-5 text-muted">
                {background.blurb}
              </dd>
              <div className="mt-3 space-y-2">
                {PREVIEW_STATS.map((stat) => (
                  <div key={stat.key}>
                    <div className="mb-0.5 flex items-center justify-between text-[10px]">
                      <span className="text-muted">{stat.label}</span>
                      <span className="font-bold tabular-nums text-[#c7ccd4]">
                        {background.stats[stat.key as keyof typeof background.stats]}
                      </span>
                    </div>
                    <ProgressBar
                      value={background.stats[stat.key as keyof typeof background.stats]}
                      tone={stat.tone}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </dl>
      </section>

      <Panel>
        <PanelHeader
          title="Data diri"
          subtitle="Nama dan profil trader untuk akun demo baru"
        />
        <CreateCharacterForm />
      </Panel>

      <p className="text-center text-[10px] leading-5 text-[#5e6673]">
        Dengan membuka akun demo, Anda setuju bahwa seluruh data dan transaksi
        hanya digunakan untuk simulasi permainan.
      </p>
    </div>
  );
}
