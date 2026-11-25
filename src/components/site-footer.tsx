import Link from "next/link";
import { Brand } from "@/components/brand";

const GROUPS = [
  {
    title: "Pasar",
    links: [
      { href: "/play/market", label: "Spot saham & kripto" },
      { href: "/play/crypto", label: "Terminal kripto" },
      { href: "/play/portfolio", label: "Portofolio" },
    ],
  },
  {
    title: "Akun",
    links: [
      { href: "/play/wallet", label: "Dompet demo" },
      { href: "/play/forex", label: "Forex" },
      { href: "/play/new", label: "Buka akun" },
    ],
  },
  {
    title: "Simulasi",
    links: [
      { href: "/", label: "Tentang MarketLife" },
      { href: "/login", label: "Masuk" },
      { href: "/register", label: "Daftar" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-[#0a0d10]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Brand />
            <p className="mt-3 max-w-sm text-xs leading-6 text-muted">
              Bursa simulasi untuk belajar trading kripto dan saham. Harga,
              saldo, dan seluruh transaksi adalah fiksi. Tidak ada uang
              sungguhan yang terlibat.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-[#5e6673]">
              <span className="rounded border border-line px-2 py-1">Spot</span>
              <span className="rounded border border-line px-2 py-1">Futures 20x</span>
              <span className="rounded border border-line px-2 py-1">Saldo demo</span>
            </div>
          </div>

          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c7ccd4]">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-muted transition hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-5 text-[10px] leading-5 text-[#5e6673] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 MarketLife Exchange. Seluruh data adalah simulasi.</p>
          <p>
            Terinspirasi pengalaman bursa kripto modern. Bukan produk Tokocrypto
            dan tidak berafiliasi dengannya.
          </p>
        </div>
      </div>
    </footer>
  );
}
