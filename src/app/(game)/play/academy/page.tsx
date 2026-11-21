import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { gameSnapshot, educationState } from "@/server/services/game-service";
import { EDUCATION_PROGRAMS } from "@/domain/education";
import { currency } from "@/domain/money";
import { EnrollForm } from "@/components/game/enroll-form";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  ProgressBar,
  StatCard,
} from "@/components/game/ui";
import {
  IconArrowRight,
  IconCandles,
  IconCheck,
  IconGraduation,
} from "@/components/icons";

export const instant = false;

export default async function AcademyPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await gameSnapshot(userId);
  if (!game) redirect("/play/new");

  const edu = await educationState(userId);
  const knowledge = game.character.knowledge;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Akademi MarketLife"
        title="Akademi & pendidikan"
        description="Investasikan saldo demo untuk meningkatkan pengetahuan dan membuka peluang karier dengan gaji lebih tinggi."
        actions={
          <Link
            href="/play/market"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
          >
            <IconCandles className="h-3.5 w-3.5" />
            Kembali ke pasar
          </Link>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pengetahuan"
          value={`${knowledge}/100`}
          tone="brand"
          hint="Naik lewat program akademi"
          icon={<IconGraduation className="h-4 w-4" />}
        />
        <StatCard
          label="Program aktif"
          value={edu.currentProgram ? edu.currentProgram.name : "—"}
          hint={
            edu.currentProgram
              ? `${edu.currentProgram.monthsLeft} bulan tersisa`
              : "Belum ada pendaftaran"
          }
        />
        <StatCard
          label="Sertifikat"
          value={edu.fullDegrees.length}
          tone="gold"
          hint="Gelar yang sudah diselesaikan"
          icon={<IconCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Biaya program"
          value={currency(EDUCATION_PROGRAMS[0]?.tuitionMinor ?? 0n)}
          hint={`${EDUCATION_PROGRAMS.length} program tersedia`}
        />
      </dl>

      {edu.currentProgram ? (
        <Panel className="overflow-hidden">
          <div className="border-b border-line bg-gradient-to-r from-brand/10 via-transparent to-gold/5 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
                  Pendaftaran aktif
                </p>
                <h2 className="mt-0.5 text-sm font-bold text-white">
                  {edu.currentProgram.name}
                </h2>
              </div>
              <span className="rounded border border-line bg-elevated px-2 py-1 text-[10px] font-bold tabular-nums text-muted">
                Bulan {edu.currentProgram.startTick} – {edu.currentProgram.completesTick}
              </span>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Uang kuliah" value={currency(edu.currentProgram.tuitionMinor)} />
            <MiniStat
              label="Bonus pengetahuan"
              value={`+${edu.currentProgram.knowledgeGain}`}
              tone="up"
            />
            <MiniStat
              label="Sisa waktu"
              value={`${edu.currentProgram.monthsLeft} bulan`}
              tone="gold"
            />
            <MiniStat
              label="Progres"
              value={`${edu.currentProgram.progress}%`}
              tone="brand"
            />
          </div>
          <div className="px-4 pb-4">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
              <span>Progres program</span>
              <span className="tabular-nums text-white">
                {edu.currentProgram.progress}%
              </span>
            </div>
            <ProgressBar value={edu.currentProgram.progress} tone="brand" />
          </div>
        </Panel>
      ) : null}

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white">Program tersedia</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Selesaikan satu program sebelum mendaftar program berikutnya.
            </p>
          </div>
          <span className="rounded border border-line bg-surface px-2 py-1 text-[10px] font-bold text-muted">
            Pengetahuan saat ini {knowledge}/100
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {EDUCATION_PROGRAMS.map((program) => {
            const isEnrolled = edu.currentProgram?.key === program.key;
            const locked = Boolean(edu.currentProgram) && !isEnrolled;
            return (
              <Panel
                key={program.key}
                className={
                  isEnrolled
                    ? "border-brand/40 bg-gradient-to-br from-brand/10 via-surface to-surface"
                    : ""
                }
              >
                <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">{program.name}</h3>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
                      {program.durationTicks} bulan · {program.knowledgeGain} poin pengetahuan
                    </p>
                  </div>
                  {isEnrolled ? (
                    <span className="rounded bg-brand/12 px-2 py-1 text-[10px] font-bold text-brand ring-1 ring-inset ring-brand/20">
                      Aktif
                    </span>
                  ) : (
                    <span className="rounded bg-line-soft px-2 py-1 text-[10px] font-bold text-muted">
                      {currency(program.tuitionMinor)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Uang kuliah
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-white">
                      {currency(program.tuitionMinor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Bonus pengetahuan
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-up">
                      +{program.knowledgeGain}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4">
                  {isEnrolled ? (
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
                      <IconCheck className="h-3.5 w-3.5" />
                      Anda sedang mengikuti program ini.
                    </p>
                  ) : locked ? (
                    <p className="text-[11px] leading-5 text-muted">
                      Selesaikan program yang sedang berjalan sebelum mendaftar
                      program baru.
                    </p>
                  ) : (
                    <EnrollForm programKey={program.key} />
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      <Panel>
        <PanelHeader
          title="Sertifikat & gelar"
          subtitle="Program yang telah diselesaikan"
          action={
            <span className="text-[10px] font-bold text-muted">
              {edu.fullDegrees.length} gelar
            </span>
          }
        />
        {edu.fullDegrees.length > 0 ? (
          <ul className="divide-y divide-line/70">
            {edu.fullDegrees.map((degree) => (
              <li
                key={degree.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/12 text-gold">
                    <IconGraduation className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">{degree.label}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted">
                      {degree.key}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-muted">
                  Selesai bulan {degree.completedTick}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4">
            <EmptyState>
              Belum ada sertifikat. Daftar program di atas dan majukan pasar
              hingga program selesai.
            </EmptyState>
          </div>
        )}
      </Panel>

      <div className="flex justify-end">
        <Link
          href="/play"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand transition hover:text-brand-strong"
        >
          Kembali ke beranda
          <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "up" | "gold" | "brand";
}) {
  const color =
    tone === "up"
      ? "text-up"
      : tone === "gold"
        ? "text-gold"
        : tone === "brand"
          ? "text-brand"
          : "text-white";

  return (
    <div className="rounded-lg border border-line bg-elevated p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className={`mt-1 text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
