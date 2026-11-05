import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";

export const instant = false;
import { gameSnapshot, educationState } from "@/server/services/game-service";
import { EDUCATION_PROGRAMS } from "@/domain/education";
import { currency } from "@/domain/money";
import { EnrollForm } from "@/components/game/enroll-form";



export default async function AcademyPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await gameSnapshot(userId);
  if (!game) redirect("/play/new");

  const edu = await educationState(userId);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Academy &amp; Education</h1>
        <p className="mt-1 text-sm text-muted">
          Current Knowledge: <span className="font-semibold text-foreground">{game.character.knowledge}/100</span> · Invest in courses to unlock higher paying career promotions.
        </p>
      </header>

      {/* Currently Enrolled Program */}
      {edu.currentProgram ? (
        <section className="mb-8 rounded border border-border-subtle bg-foreground/[0.02] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Active Enrollment</h2>
            <span className="text-xs uppercase tracking-wider text-muted font-mono">
              Month {edu.currentProgram.startTick} – Month {edu.currentProgram.completesTick}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-border-subtle bg-background p-3">
              <dt className="text-xs uppercase tracking-widest text-muted">Program</dt>
              <dd className="mt-1 font-medium">{edu.currentProgram.name}</dd>
            </div>
            <div className="rounded border border-border-subtle bg-background p-3">
              <dt className="text-xs uppercase tracking-widest text-muted">Tuition Paid</dt>
              <dd className="mt-1 font-medium">{currency(edu.currentProgram.tuitionMinor)}</dd>
            </div>
            <div className="rounded border border-border-subtle bg-background p-3">
              <dt className="text-xs uppercase tracking-widest text-muted">Knowledge Reward</dt>
              <dd className="mt-1 font-medium tabular-nums text-emerald-700">+{edu.currentProgram.knowledgeGain}</dd>
            </div>
            <div className="rounded border border-border-subtle bg-background p-3">
              <dt className="text-xs uppercase tracking-widest text-muted">Time Remaining</dt>
              <dd className="mt-1 font-medium tabular-nums">{edu.currentProgram.monthsLeft} month(s)</dd>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Progress</span>
              <span>{edu.currentProgram.progress}%</span>
            </div>
            <div className="h-2 w-full rounded bg-border-subtle overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-300"
                style={{ width: `${edu.currentProgram.progress}%` }}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* Available Programs */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Available Programs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {EDUCATION_PROGRAMS.map((program) => {
            const isEnrolled = edu.currentProgram?.key === program.key;
            return (
              <div
                key={program.key}
                className={`rounded border p-5 ${
                  isEnrolled
                    ? "border-emerald-600/40 bg-emerald-500/5"
                    : "border-border-subtle bg-background"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{program.name}</h3>
                  <span className="text-xs text-muted font-mono">{program.durationTicks} months</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>
                    <span className="block uppercase tracking-wider text-[10px]">Tuition</span>
                    <span className="text-sm font-medium text-foreground">{currency(program.tuitionMinor)}</span>
                  </div>
                  <div>
                    <span className="block uppercase tracking-wider text-[10px]">Knowledge Gain</span>
                    <span className="text-sm font-medium text-emerald-700">+{program.knowledgeGain}</span>
                  </div>
                </div>

                {isEnrolled ? (
                  <div className="mt-4 text-xs font-medium text-emerald-700">
                    Currently enrolled in this course.
                  </div>
                ) : edu.currentProgram ? (
                  <div className="mt-4 text-xs text-muted">
                    Complete your current course before enrolling in another.
                  </div>
                ) : (
                  <EnrollForm programKey={program.key} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Earned Degrees / Certifications */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Earned Certificates &amp; Degrees
        </h2>
        {edu.fullDegrees.length > 0 ? (
          <ul className="space-y-2">
            {edu.fullDegrees.map((degree) => (
              <li
                key={degree.id}
                className="flex items-center justify-between rounded border border-border-subtle bg-background p-3 text-sm"
              >
                <div>
                  <span className="font-semibold">{degree.label}</span>
                  <span className="ml-2 text-xs text-muted font-mono">({degree.key})</span>
                </div>
                <span className="text-xs text-muted">Completed month {degree.completedTick}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No certificates earned yet.</p>
        )}
      </section>
    </>
  );
}
