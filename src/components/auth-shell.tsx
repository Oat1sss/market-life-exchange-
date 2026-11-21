import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-[#0b0e11]/80">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-3">
          <Brand />
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-muted sm:block">
            Bursa simulasi · tanpa uang sungguhan
          </span>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,1)] sm:p-7">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(0,192,135,0.9)]" />
              {eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-1.5 text-xs leading-5 text-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>

          <div className="mt-4 text-center text-xs text-muted">{footer}</div>

          <p className="mt-6 text-center text-[10px] leading-5 text-[#5e6673]">
            MarketLife adalah simulasi. Tidak ada uang, aset, atau transaksi
            sungguhan yang terlibat.
          </p>
        </div>
      </main>
    </div>
  );
}
