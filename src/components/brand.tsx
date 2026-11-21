import Link from "next/link";

export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand text-[#04120e] shadow-[0_0_26px_-4px_rgba(0,192,135,0.55)] ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[62%] w-[62%]">
        <path
          d="M5 17.5v-4M5 11.5V8M12 18V9M12 7V4.5M19 15v-3M19 10V7"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <rect x="3.3" y="12.2" width="3.4" height="3.4" rx="1" fill="currentColor" />
        <rect x="10.3" y="8.4" width="3.4" height="5.1" rx="1" fill="currentColor" />
        <rect x="17.3" y="10.2" width="3.4" height="2.8" rx="1" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Brand({
  href = "/",
  compact = false,
}: {
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <BrandMark className={compact ? "h-8 w-8" : "h-9 w-9"} />
      <span className="flex items-baseline gap-1.5">
        <span
          className={`font-black tracking-tight text-white transition group-hover:text-brand ${
            compact ? "text-[15px]" : "text-lg"
          }`}
        >
          MarketLife
        </span>
        {!compact && (
          <span className="rounded border border-brand/25 bg-brand/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-brand">
            Exchange
          </span>
        )}
      </span>
    </Link>
  );
}
