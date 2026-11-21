import type { ReactNode } from "react";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-line bg-surface shadow-[0_24px_70px_-40px_rgba(0,0,0,0.95)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3",
        className,
      )}
    >
      <div>
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#c7ccd4]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {back ? <div className="mb-2">{back}</div> : null}
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_10px_rgba(0,192,135,0.9)]" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

const STAT_TONES = {
  default: "text-white",
  up: "text-up",
  down: "text-down",
  brand: "text-brand",
  gold: "text-gold",
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof STAT_TONES;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-elevated p-3.5">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          {label}
        </dt>
        {icon ? <span className="text-muted">{icon}</span> : null}
      </div>
      <dd className={cx("mt-1.5 text-xl font-black tabular-nums", STAT_TONES[tone])}>
        {value}
      </dd>
      {hint ? <p className="mt-1 text-[10px] text-[#5e6673]">{hint}</p> : null}
    </div>
  );
}

export function SideBadge({
  side,
  leverage,
  className = "",
}: {
  side: string;
  leverage?: number;
  className?: string;
}) {
  const positive = side === "BUY" || side === "LONG";
  const label =
    side === "BUY" ? "BELI" : side === "SELL" ? "JUAL" : side === "LONG" ? "LONG" : "SHORT";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-black tracking-wide",
        positive
          ? "bg-up/12 text-up ring-1 ring-inset ring-up/20"
          : "bg-down/12 text-down ring-1 ring-inset ring-down/20",
        className,
      )}
    >
      {label}
      {leverage ? <span className="ml-1 opacity-80">{leverage}x</span> : null}
    </span>
  );
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  FILLED: { label: "Selesai", className: "bg-up/12 text-up ring-up/20" },
  CANCELLED: { label: "Dibatalkan", className: "bg-line-soft text-muted ring-line" },
  PENDING: { label: "Menunggu", className: "bg-gold/12 text-gold ring-gold/20" },
  OPEN: { label: "Terbuka", className: "bg-up/12 text-up ring-up/20" },
  CLOSED: { label: "Tertutup", className: "bg-line-soft text-muted ring-line" },
};

export function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? {
      label: status,
      className: "bg-line-soft text-muted ring-line",
    };

  return (
    <span
      className={cx(
        "inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

export function EmptyState({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border border-dashed border-line bg-elevated/50 px-4 py-6 text-center text-xs text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "brand",
  className = "",
}: {
  value: number;
  tone?: "brand" | "gold" | "up" | "down";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    tone === "gold"
      ? "bg-gold"
      : tone === "up"
        ? "bg-up"
        : tone === "down"
          ? "bg-down"
          : "bg-brand";

  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <div
        className={cx("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function KeyValue({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <span className={cx("font-semibold tabular-nums", STAT_TONES[tone])}>{value}</span>
    </div>
  );
}
