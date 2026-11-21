"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBolt,
  IconCandles,
  IconCoin,
  IconGraduation,
  IconHome,
  IconPie,
  IconWallet,
} from "@/components/icons";
import { cx } from "./ui";

const NAV_ITEMS = [
  { href: "/play", label: "Beranda", icon: IconHome, exact: true },
  { href: "/play/market", label: "Pasar", icon: IconCandles },
  { href: "/play/crypto", label: "Kripto", icon: IconCoin },
  { href: "/play/wallet", label: "Dompet", icon: IconWallet },
  { href: "/play/portfolio", label: "Portofolio", icon: IconPie },
  { href: "/play/academy", label: "Akademi", icon: IconGraduation },
  { href: "/play/arcade", label: "Arcade", icon: IconBolt },
] as const;

export function GameNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="-mx-1 order-last flex w-full min-w-0 items-center gap-0.5 overflow-x-auto px-1 py-0.5 lg:order-none lg:w-auto lg:flex-1"
    >
      {NAV_ITEMS.map((item) => {
        const exact = "exact" in item && item.exact;
        const active = exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
              active
                ? "bg-brand/10 text-brand ring-1 ring-inset ring-brand/20"
                : "text-muted hover:bg-surface-2 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
            {item.href === "/play/crypto" ? (
              <span className="rounded bg-gold/15 px-1 py-px text-[9px] font-black text-gold">
                20x
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
