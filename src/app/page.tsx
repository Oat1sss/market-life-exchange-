import Link from "next/link";
import { maybeUserId } from "@/server/session";
import { Brand, BrandMark } from "@/components/brand";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconBolt,
  IconCandles,
  IconChartUp,
  IconShield,
} from "@/components/icons";
import { Sparkline, type ChartPoint } from "@/components/game/price-chart";
import { SiteFooter } from "@/components/site-footer";
import { currency } from "@/domain/money";

export const instant = false;

const BTC_POINTS: ChartPoint[] = [
  { tick: 0, priceMinor: 4_050_000n },
  { tick: 1, priceMinor: 4_180_000n },
  { tick: 2, priceMinor: 4_120_000n },
  { tick: 3, priceMinor: 4_260_000n },
  { tick: 4, priceMinor: 4_220_000n },
  { tick: 5, priceMinor: 4_360_000n },
  { tick: 6, priceMinor: 4_310_000n },
  { tick: 7, priceMinor: 4_420_000n },
  { tick: 8, priceMinor: 4_500_000n },
];

const MARKETS = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    priceMinor: 4_500_000n,
    change: 2.34,
    points: BTC_POINTS,
    accent: "text-gold bg-gold/10 ring-gold/20",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    priceMinor: 250_000n,
    change: -1.12,
    points: [
      { tick: 0, priceMinor: 262_000n },
      { tick: 1, priceMinor: 258_000n },
      { tick: 2, priceMinor: 265_000n },
      { tick: 3, priceMinor: 255_000n },
      { tick: 4, priceMinor: 250_000n },
    ],
    accent: "text-[#8b9dff] bg-[#8b9dff]/10 ring-[#8b9dff]/20",
  },
  {
    symbol: "SOL",
    name: "Solana",
    priceMinor: 12_000n,
    change: 5.67,
    points: [
      { tick: 0, priceMinor: 10_400n },
      { tick: 1, priceMinor: 10_800n },
      { tick: 2, priceMinor: 11_300n },
      { tick: 3, priceMinor: 11_100n },
      { tick: 4, priceMinor: 12_000n },
    ],
    accent: "text-brand bg-brand/10 ring-brand/20",
  },
  {
    symbol: "NOVA",
    name: "Nova Dynamics",
    priceMinor: 120_000n,
    change: 0.84,
    points: [
      { tick: 0, priceMinor: 116_000n },
      { tick: 1, priceMinor: 118_000n },
      { tick: 2, priceMinor: 117_500n },
      { tick: 3, priceMinor: 119_200n },
      { tick: 4, priceMinor: 120_000n },
    ],
    accent: "text-[#6f8dff] bg-[#6f8dff]/10 ring-[#6f8dff]/20",
  },
] as const;

const FEATURES = [
  {
    icon: IconCandles,
    title: "Spot & limit order",
    body: "Beli dan jual kripto maupun saham fiksi dengan order market instan atau limit yang menunggu harga target.",
    tone: "text-brand bg-brand/10 ring-brand/20",
  },
  {
    icon: IconBolt,
    title: "Futures hingga 20x",
    body: "Buka posisi long atau short dengan margin, leverage, harga likuidasi, dan P&L yang dihitung di server.",
    tone: "text-gold bg-gold/10 ring-gold/20",
  },
  {
    icon: IconShield,
    title: "Nol risiko finansial",
    body: "Semua saldo dan transaksi adalah simulasi. Latih ukuran posisi tanpa takut kehilangan uang sungguhan.",
    tone: "text-up bg-up/10 ring-up/20",
  },
  {
    icon: IconChartUp,
    title: "Forex & valas",
    body: "Pantau kurs rupiah terhadap mata uang utama, hitung konversi, dan pahami spread sebelum menukar valas.",
    tone: "text-[#8b9dff] bg-[#8b9dff]/10 ring-[#8b9dff]/20",
  },
] as const;

const STEPS = [
  {
    number: "01",
    title: "Buka akun demo",
    body: "Pilih profil trader dan mulai dengan saldo virtual Rp 10.000.000.000,00. Tanpa KTP, tanpa deposit.",
  },
  {
    number: "02",
    title: "Pilih pasar",
    body: "Jelajahi puluhan kripto dan saham fiksi. Pasang order spot, limit, atau buka posisi futures.",
  },
  {
    number: "03",
    title: "Majukan bulan",
    body: "Harga bergerak setiap tick. Lihat laporan, bayar biaya hidup, dan ambil keputusan berikutnya.",
  },
] as const;

export default async function Home() {
  const loggedIn = Boolean(await maybeUserId());
  const terminalHref = loggedIn ? "/play" : "/register";

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="border-b border-line bg-[#0a0d10]">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-2 text-[10px] font-semibold text-muted">
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(0,192,135,0.9)]" />
            Bursa simulasi · 100% dana virtual · tanpa risiko
          </p>
          <Link
            href="#cara-kerja"
            className="hidden items-center gap-1 text-brand transition hover:text-brand-strong sm:flex"
          >
            Cara kerja <IconArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-[#0b0e11]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-4 py-3">
          <Brand />
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {[
              { href: loggedIn ? "/play/market" : "/register", label: "Pasar" },
              { href: loggedIn ? "/play/crypto" : "/register", label: "Kripto" },
              { href: loggedIn ? "/play/forex" : "/register", label: "Forex" },
              { href: "#cara-kerja", label: "Cara kerja" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-xs font-bold text-muted transition hover:bg-surface-2 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {loggedIn ? (
              <Link
                href="/play"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
              >
                Buka Terminal <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-xs font-bold text-[#c7ccd4] transition hover:bg-surface-2 hover:text-white"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-brand px-3.5 py-2 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-line">
          <div className="bg-grid absolute inset-0 opacity-60" />
          <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-[#007ea4]/10 blur-3xl" />

          <div className="relative mx-auto grid w-full max-w-[1440px] gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                <IconChartUp className="h-3.5 w-3.5" />
                Exchange simulasi untuk belajar pasar
              </span>
              <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Trading kripto &amp; saham.{" "}
                <span className="bg-gradient-to-r from-brand via-brand-strong to-[#7ef0c9] bg-clip-text text-transparent">
                  Tanpa uang sungguhan.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted sm:text-base">
                Rasakan pengalaman bursa kripto lengkap: order spot, limit,
                futures leverage, portofolio, dan laporan bulanan. Semua harga
                bergerak dari simulasi pasar—bukan uang asli.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href={terminalHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-[#04120e] shadow-[0_16px_40px_-16px_rgba(0,192,135,0.7)] transition hover:bg-brand-strong"
                >
                  {loggedIn ? "Buka terminal trading" : "Mulai gratis"}
                  <IconArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#pasar"
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-5 py-3 text-sm font-bold text-white transition hover:border-brand/40 hover:text-brand"
                >
                  Lihat pasar
                  <IconArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              <dl className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["50+", "Pasar kripto"],
                  ["50+", "Saham fiksi"],
                  ["20x", "Leverage"],
                  ["Rp 100rb", "Saldo awal"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-line bg-surface/70 px-3 py-2.5 backdrop-blur"
                  >
                    <dt className="text-base font-black text-white">{value}</dt>
                    <dd className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-brand/15 via-transparent to-[#007ea4]/15 blur-2xl" />
              <div className="relative rounded-2xl border border-line bg-surface p-4 shadow-[0_40px_120px_-40px_rgba(0,0,0,1)] sm:p-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2.5">
                    <BrandMark className="h-9 w-9" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white">BTC/IDR</span>
                        <span className="rounded bg-line-soft px-1 py-px text-[9px] font-bold text-muted">
                          Spot
                        </span>
                      </div>
                      <p className="text-[10px] text-muted">Bitcoin · pasar demo</p>
                    </div>
                  </div>
                  <span className="rounded bg-up/12 px-2 py-1 text-[10px] font-black text-up ring-1 ring-inset ring-up/20">
                    +2.34%
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Harga terakhir
                    </p>
                    <p className="mt-1 text-3xl font-black tabular-nums text-white">
                      {currency(4_500_000n)}
                    </p>
                  </div>
                  <div className="text-right text-[10px] text-muted">
                    <p>Tertinggi</p>
                    <p className="font-bold tabular-nums text-up">{currency(4_620_000n)}</p>
                    <p className="mt-1">Terendah</p>
                    <p className="font-bold tabular-nums text-down">{currency(4_050_000n)}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-line bg-elevated p-2">
                  <Sparkline points={BTC_POINTS} id="landing-btc" positive />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href={loggedIn ? "/play/crypto/BTC" : "/register"}
                    className="rounded-lg bg-up py-2.5 text-center text-xs font-black uppercase tracking-wider text-[#04120e] transition hover:bg-brand-strong"
                  >
                    Beli BTC
                  </Link>
                  <Link
                    href={loggedIn ? "/play/crypto/BTC" : "/register"}
                    className="rounded-lg bg-down py-2.5 text-center text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#ff5c70]"
                  >
                    Jual BTC
                  </Link>
                </div>

                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-muted">
                    <span>Buku pesanan</span>
                    <span>Jumlah</span>
                  </div>
                  {[
                    ["45,120.00", "0.84", "text-down", "bg-down/10", "w-[72%]"],
                    ["45,080.00", "1.26", "text-down", "bg-down/10", "w-[52%]"],
                    ["45,040.00", "0.42", "text-down", "bg-down/10", "w-[34%]"],
                    ["44,960.00", "1.08", "text-up", "bg-up/10", "w-[48%]"],
                    ["44,920.00", "2.14", "text-up", "bg-up/10", "w-[78%]"],
                  ].map(([price, size, tone, bar, width]) => (
                    <div
                      key={price}
                      className="relative flex items-center justify-between py-0.5 text-[10px] tabular-nums"
                    >
                      <span
                        className={`absolute right-0 top-0 h-full ${bar} ${width}`}
                      />
                      <span className={`relative z-10 font-bold ${tone}`}>{price}</span>
                      <span className="relative z-10 text-[#c7ccd4]">{size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pasar" className="border-b border-line bg-[#0a0d10]">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Pasar populer
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
                  Mulai dari aset yang kamu kenal
                </h2>
              </div>
              <Link
                href={loggedIn ? "/play/market" : "/register"}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand transition hover:text-brand-strong"
              >
                Lihat semua pasar <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {MARKETS.map((market) => {
                const up = market.change >= 0;
                return (
                  <Link
                    key={market.symbol}
                    href={
                      loggedIn
                        ? market.symbol === "NOVA"
                          ? `/play/market/${market.symbol}`
                          : `/play/crypto/${market.symbol}`
                        : "/register"
                    }
                    className="group rounded-xl border border-line bg-surface p-4 transition hover:border-brand/40 hover:bg-surface-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ring-1 ring-inset ${market.accent}`}
                        >
                          {market.symbol.slice(0, 1)}
                        </span>
                        <div>
                          <p className="text-sm font-black text-white group-hover:text-brand">
                            {market.symbol}/IDR
                          </p>
                          <p className="text-[10px] text-muted">{market.name}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                          up ? "bg-up/10 text-up" : "bg-down/10 text-down"
                        }`}
                      >
                        {up ? "+" : ""}
                        {market.change.toFixed(2)}%
                      </span>
                    </div>
                    <p className="mt-4 text-lg font-black tabular-nums text-white">
                      {currency(market.priceMinor)}
                    </p>
                    <div className="mt-2">
                      <Sparkline
                        points={market.points}
                        id={`landing-${market.symbol}`}
                        positive={up}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-4 py-14">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
              Fitur terminal
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Semua yang ada di bursa nyata, tanpa risikonya
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Antarmuka dibuat seperti exchange profesional: order book, grafik
              candlestick, indikator, dan konsol posisi.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-xl border border-line bg-surface p-4 transition hover:border-brand/30"
                >
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ${feature.tone}`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-3 text-sm font-black text-white">{feature.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section
          id="cara-kerja"
          className="border-y border-line bg-[#0a0d10]"
        >
          <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                Cara kerja
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Satu bulan, satu keputusan
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                MarketLife menggabungkan simulasi kehidupan dengan pasar
                finansial. Setiap kali kamu majukan bulan, harga bergerak,
                gaji masuk, dan biaya hidup menagih.
              </p>
              <Link
                href={terminalHref}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-4 py-2.5 text-xs font-black text-brand transition hover:bg-brand/20"
              >
                Coba sekarang <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <span className="font-mono text-2xl font-black text-brand/40">
                    {step.number}
                  </span>
                  <h3 className="mt-2 text-sm font-black text-white">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-4 py-14">
          <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-[#0e2b24] via-surface to-[#0c1d2b] p-8 sm:p-10">
            <div className="bg-grid absolute inset-0 opacity-40" />
            <div className="relative flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Siap mulai?
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Buka akun demo dalam 30 detik
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  Tidak perlu email verifikasi, tidak perlu deposit. Pilih nama
                  trader, dapatkan saldo virtual, dan langsung masuk ke terminal.
                </p>
              </div>
              <Link
                href={terminalHref}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-[#04120e] shadow-[0_16px_40px_-16px_rgba(0,192,135,0.8)] transition hover:bg-brand-strong"
              >
                {loggedIn ? "Buka terminal" : "Daftar sekarang"}
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
