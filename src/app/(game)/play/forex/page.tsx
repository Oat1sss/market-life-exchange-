import Link from "next/link";
import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { prisma } from "@/server/db";
import {
  FOREX_PAIRS,
  forexCrossRates,
  forexQuotes,
  formatForexRate,
  type ForexQuote,
} from "@/domain/forex";
import { forexSnapshot } from "@/server/services/forex-service";
import { currency } from "@/domain/money";
import { ForexConverter } from "@/components/game/forex-converter";
import { ForexTradeForm } from "@/components/game/forex-trade-form";
import { Sparkline } from "@/components/game/price-chart";
import {
  PageHeader,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/game/ui";

export const instant = false;

function quoteValue(quote: ForexQuote, value: number): string {
  const text = formatForexRate(value, quote.decimals);
  return quote.quote === "IDR" ? `Rp ${text}` : `${text} ${quote.quote}`;
}

export default async function ForexPage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { seed: true, tick: true },
  });
  if (!game) redirect("/play/new");

  const [quotes, forex] = await Promise.all([
    Promise.resolve(forexQuotes(game.seed, game.tick)),
    forexSnapshot(userId),
  ]);
  const rates = forexCrossRates(quotes);
  const tradeMarkets = quotes.map((quote) => ({
    symbol: quote.symbol,
    base: quote.base,
    note: quote.note,
    baseRateIdr: rates[quote.base as keyof typeof rates] ?? quote.rate,
    spreadBp:
      FOREX_PAIRS.find((candidate) => candidate.symbol === quote.symbol)?.spreadBp ?? 8,
  }));
  const heldByCurrency = Object.fromEntries(
    (forex?.holdings ?? []).map((holding) => [
      holding.currency,
      { units: holding.units, averageRateMinor: holding.averageRateMinor },
    ]),
  );
  const cashMinor = forex?.cashMinor ?? 0n;
  const bySymbol = (symbol: string) =>
    quotes.find((quote) => quote.symbol === symbol) ?? quotes[0]!;

  const usdIdr = bySymbol("USD/IDR");
  const eurUsd = bySymbol("EUR/USD");
  const usdJpy = bySymbol("USD/JPY");
  const averageSpreadBp =
    quotes.reduce((total, quote) => total + (quote.spread / quote.rate) * 10_000, 0) /
    quotes.length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Valuta asing · kurs referensi"
        title="Pasar forex"
        description="Pantau nilai tukar rupiah, beli atau jual valas dengan kas yang sama seperti saham dan kripto, lalu hitung konversi. Kuotasi bergerak setiap kali pasar dimajukan."
        actions={
          <Link
            href="/play/arcade"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-white transition hover:border-brand/40 hover:text-brand"
          >
            Latihan kuis forex
            <span aria-hidden>→</span>
          </Link>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="USD / IDR"
          value={`Rp ${formatForexRate(usdIdr.rate, 0)}`}
          hint={`Bid ${formatForexRate(usdIdr.bid, 0)} · Ask ${formatForexRate(usdIdr.ask, 0)}`}
        />
        <StatCard
          label="EUR / USD"
          value={formatForexRate(eurUsd.rate, 4)}
          hint={`${eurUsd.changePct >= 0 ? "+" : ""}${eurUsd.changePct.toFixed(2)}% dalam 7 sesi`}
          tone={eurUsd.changePct >= 0 ? "up" : "down"}
        />
        <StatCard
          label="USD / JPY"
          value={formatForexRate(usdJpy.rate, 2)}
          hint={`${usdJpy.changePct >= 0 ? "+" : ""}${usdJpy.changePct.toFixed(2)}% dalam 7 sesi`}
          tone={usdJpy.changePct >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Spread rata-rata"
          value={`${averageSpreadBp.toFixed(1)} bp`}
          hint="Biaya transaksi antar bank"
          tone="gold"
        />
      </dl>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Kuotasi valas"
              subtitle={`${quotes.length} pasangan · pasar ke-${game.tick}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5">Pasangan</th>
                    <th className="px-3 py-2.5 text-right">Bid</th>
                    <th className="px-3 py-2.5 text-right">Ask</th>
                    <th className="px-3 py-2.5 text-right">Spread</th>
                    <th className="px-3 py-2.5 text-right">Perubahan</th>
                    <th className="px-3 py-2.5 text-right">30 sesi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {quotes.map((quote) => {
                    const up = quote.changePct >= 0;
                    return (
                      <tr key={quote.symbol} className="hover:bg-surface-2/40">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{quote.symbol}</div>
                          <div className="text-[10px] text-muted">{quote.note}</div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                          {quoteValue(quote, quote.bid)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-white">
                          {quoteValue(quote, quote.ask)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted">
                          {((quote.spread / quote.rate) * 10_000).toFixed(1)} bp
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-bold tabular-nums ${
                            up ? "text-up" : "text-down"
                          }`}
                        >
                          {up ? "+" : ""}
                          {quote.changePct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-3">
                          <div className="ml-auto w-24">
                            <Sparkline
                              points={quote.history}
                              id={`forex-${quote.base}-${quote.quote}`}
                              positive={up}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="mt-4">
            <PanelHeader
              title="Posisi valas"
              subtitle={
                forex && forex.holdings.length > 0
                  ? `${forex.holdings.length} mata uang · nilai ${currency(forex.holdingsValueMinor)}`
                  : "Belum ada saldo valas"
              }
            />
            {forex && forex.holdings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                      <th className="px-4 py-2.5">Mata uang</th>
                      <th className="px-3 py-2.5 text-right">Unit</th>
                      <th className="px-3 py-2.5 text-right">Kurs rata-rata</th>
                      <th className="px-3 py-2.5 text-right">Kurs kini</th>
                      <th className="px-3 py-2.5 text-right">Nilai</th>
                      <th className="px-3 py-2.5 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {forex.holdings.map((holding) => (
                      <tr key={holding.currency}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{holding.currency}</div>
                          <div className="text-[10px] text-muted">{holding.pair}</div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                          {holding.units.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[#c7ccd4]">
                          Rp {formatForexRate(Number(holding.averageRateMinor) / 100, 2)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-white">
                          Rp {formatForexRate(Number(holding.currentRateMinor) / 100, 2)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-white">
                          {currency(holding.valueMinor)}
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-bold tabular-nums ${
                            holding.unrealizedMinor >= 0n ? "text-up" : "text-down"
                          }`}
                        >
                          {holding.unrealizedMinor >= 0n ? "+" : ""}
                          {currency(holding.unrealizedMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-4 text-[11px] text-muted">
                Beli valas lewat panel di samping; saldo akan muncul di sini dan
                di portofolio.
              </p>
            )}
          </Panel>

          <Panel className="mt-4">
            <PanelHeader
              title="Cara membaca kuotasi"
              subtitle="Dasar sebelum menukar valas"
            />
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {[
                {
                  title: "Base dan quote",
                  body: "Pada USD/IDR, USD adalah base dan IDR adalah quote. Angka 16.250 berarti 1 dolar bernilai 16.250 rupiah.",
                },
                {
                  title: "Bid dan ask",
                  body: "Bid adalah harga saat bank membeli base darimu; ask adalah harga saat kamu membelinya. Selisihnya disebut spread.",
                },
                {
                  title: "Basis poin",
                  body: "1 bp = 0,01%. Spread 16 bp pada kurs 16.250 setara Rp 26 per dolar — biaya yang harus ditutup sebelum untung.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-line bg-elevated p-3"
                >
                  <h3 className="text-xs font-bold text-white">{item.title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              title="Beli / jual valas"
              subtitle="Eksekusi kurs algoritmik"
            />
            <ForexTradeForm
              markets={tradeMarkets}
              cashMinor={cashMinor}
              holdings={heldByCurrency}
            />
          </Panel>

          <Panel>
            <PanelHeader
              title="Konversi mata uang"
              subtitle="Memakai kurs tengah terbaru"
            />
            <ForexConverter rates={rates} />
          </Panel>

          <Panel>
            <PanelHeader title="Ringkasan pasar" subtitle="Level kunci bulan ini" />
            <ul className="divide-y divide-line/70 text-[11px]">
              {quotes.slice(0, 5).map((quote) => (
                <li
                  key={quote.symbol}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="font-bold text-white">{quote.symbol}</span>
                  <span className="tabular-nums text-muted">
                    Low {quoteValue(quote, quote.low)} · High{" "}
                    {quoteValue(quote, quote.high)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <p className="px-1 text-[10px] leading-5 text-muted">
            Kurs adalah simulasi deterministik dari seed permainan. Pembelian
            valas memotong kas demo dan menambah saldo mata uang di portofolio;
            spread serta dampak ukuran order mengikuti market maker algoritmik.
          </p>
        </div>
      </div>
    </div>
  );
}
