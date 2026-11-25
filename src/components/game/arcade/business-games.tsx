"use client";

import { useMemo, useState } from "react";
import { cx } from "../ui";
import {
  ResultBanner,
  StatBox,
  cr,
  rng,
  type ArcadeResult,
  type QuizQuestion,
} from "./shared";

/* ------------------------------------------------------------------ */
/* Warung Kopi — pricing & inventory under uncertain demand            */
/* ------------------------------------------------------------------ */

const SHOP_DAYS = 8;
const SHOP_MODAL = 200;
const CUP_COST = 4;
const CUP_OPTIONS = [10, 20, 30] as const;
const PRICE_OPTIONS = [8, 12, 16] as const;

interface Weather {
  label: string;
  emoji: string;
  bonus: number;
}

function weatherFor(day: number): Weather {
  const roll = rng(7000 + day * 97)();
  if (roll < 0.25) return { label: "Hujan deras", emoji: "🌧️", bonus: -4 };
  if (roll < 0.55) return { label: "Pasar ramai", emoji: "🎪", bonus: 5 };
  if (roll < 0.75) return { label: "Cuaca cerah", emoji: "☀️", bonus: 2 };
  return { label: "Hari biasa", emoji: "☕", bonus: 0 };
}

interface ShopResult {
  demand: number;
  sold: number;
  revenue: number;
  cost: number;
  profit: number;
}

export function WarungKopiGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [day, setDay] = useState(0);
  const [cash, setCash] = useState(SHOP_MODAL);
  const [cups, setCups] = useState(20);
  const [price, setPrice] = useState(12);
  const [result, setResult] = useState<ShopResult | null>(null);
  const [finished, setFinished] = useState(false);

  const weather = useMemo(() => weatherFor(day), [day]);

  const reset = () => {
    setDay(0);
    setCash(SHOP_MODAL);
    setCups(20);
    setPrice(12);
    setResult(null);
    setFinished(false);
  };

  if (finished) {
    const profit = cash - SHOP_MODAL;
    return (
      <ResultBanner
        score={Math.max(0, profit)}
        total={300}
        onRetry={reset}
        label="Laba"
        note={
          profit > 0
            ? `Kas akhir ${cr(cash)} dari modal ${cr(SHOP_MODAL)}. Stok dan harga yang tepat adalah inti bisnis.`
            : "Kali ini warung merugi. Coba pantau cuaca dan sesuaikan stok dengan permintaan."
        }
      />
    );
  }

  const serve = () => {
    const cost = cups * CUP_COST;
    if (cost > cash) return;
    const noise = (rng(day * 911 + price * 13)() - 0.5) * 8;
    const demand = Math.max(
      0,
      Math.min(36, Math.round(14 + (12 - price) * 1.6 + weather.bonus + noise)),
    );
    const sold = Math.min(cups, demand);
    const revenue = sold * price;
    setCash((value) => value + revenue - cost);
    setResult({ demand, sold, revenue, cost, profit: revenue - cost });
  };

  const next = () => {
    if (day + 1 >= SHOP_DAYS) {
      setFinished(true);
      onFinish({ score: Math.max(0, cash - SHOP_MODAL), total: 300 });
      return;
    }
    setDay((value) => value + 1);
    setResult(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Hari <strong className="text-white">{day + 1}</strong>/{SHOP_DAYS}
        </span>
        <span>
          Kas <strong className="text-white tabular-nums">{cr(cash)}</strong>
        </span>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-line bg-elevated px-3 py-2">
        <span className="text-xs font-bold text-white">
          {weather.emoji} {weather.label}
        </span>
        <span
          className={cx(
            "rounded-full px-2 py-0.5 text-[10px] font-bold",
            weather.bonus > 0
              ? "bg-up/12 text-up"
              : weather.bonus < 0
                ? "bg-down/12 text-down"
                : "bg-elevated text-muted",
          )}
        >
          {weather.bonus > 0
            ? `+${weather.bonus} pembeli`
            : weather.bonus < 0
              ? `${weather.bonus} pembeli`
              : "permintaan normal"}
        </span>
      </div>

      {result ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatBox label="Permintaan" value={`${result.demand} gelas`} />
            <StatBox label="Terjual" value={`${result.sold} gelas`} tone="brand" />
            <StatBox label="Pendapatan" value={cr(result.revenue)} />
            <StatBox
              label="Laba hari ini"
              value={`${result.profit >= 0 ? "+" : ""}${result.profit}`}
              tone={result.profit >= 0 ? "up" : "down"}
            />
          </div>
          <p className="rounded-lg border border-line bg-elevated px-3 py-2 text-[11px] text-muted">
            {cups > result.sold
              ? `${cups - result.sold} gelas tidak terjual — biaya bahan tetap keluar.`
              : result.demand > cups
                ? "Permintaan melebihi stok: ada pelanggan yang pulang kecewa."
                : "Stok terjual habis pas dengan permintaan."}{" "}
            Harga Rp {price} · biaya bahan {CUP_COST} Rp/gelas.
          </p>
          <button
            type="button"
            onClick={next}
            className="w-full rounded-lg bg-brand py-2.5 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
          >
            {day + 1 >= SHOP_DAYS ? "Tutup buku & lihat hasil" : "Hari berikutnya →"}
          </button>
        </>
      ) : (
        <>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
              Stok yang diseduh
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {CUP_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCups(option)}
                  className={cx(
                    "rounded-lg border py-2 text-xs font-bold tabular-nums transition",
                    cups === option
                      ? "border-brand bg-brand/12 text-brand"
                      : "border-line bg-elevated text-[#c7ccd4] hover:border-brand/40",
                  )}
                >
                  {option} gelas
                  <span className="mt-0.5 block text-[9px] font-medium text-muted">
                    biaya Rp {option * CUP_COST}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
              Harga jual per gelas
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {PRICE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPrice(option)}
                  className={cx(
                    "rounded-lg border py-2 text-xs font-bold tabular-nums transition",
                    price === option
                      ? "border-gold bg-gold/12 text-gold"
                      : "border-line bg-elevated text-[#c7ccd4] hover:border-gold/40",
                  )}
                >
                  Rp {option}
                  <span className="mt-0.5 block text-[9px] font-medium text-muted">
                    margin Rp {option - CUP_COST}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={serve}
            disabled={cups * CUP_COST > cash}
            className="w-full rounded-lg bg-brand py-2.5 text-xs font-black text-[#04120e] transition hover:bg-brand-strong disabled:opacity-40"
          >
            Buka warung hari ini
          </button>
          {day > 0 || cups * CUP_COST > cash ? (
            <button
              type="button"
              onClick={() => {
                setFinished(true);
                onFinish({ score: Math.max(0, cash - SHOP_MODAL), total: 300 });
              }}
              className="w-full rounded-lg border border-line bg-surface-2 py-2 text-[11px] font-bold text-muted transition hover:border-down/40 hover:text-white"
            >
              Tutup warung & hitung laba sekarang
            </button>
          ) : null}
          <p className="text-[10px] leading-relaxed text-muted">
            Harga murah menaikkan permintaan tetapi menipiskan margin. Stok berlebih
            membuang modal; stok kurang kehilangan penjualan.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alokasi Modal — split capital across three asset classes            */
/* ------------------------------------------------------------------ */

const ALLOC_TOTAL = 1_000;
const ALLOC_STEP = 100;

const ASSET_CLASSES = [
  {
    key: "bond",
    name: "Obligasi negara",
    emoji: "🏛️",
    basePct: 6,
    volPct: 1.5,
    note: "Aman, imbal hasil tipis",
    tone: "up" as const,
  },
  {
    key: "stock",
    name: "Saham emiten",
    emoji: "🏢",
    basePct: 11,
    volPct: 9,
    note: "Seimbang, ikut siklus ekonomi",
    tone: "brand" as const,
  },
  {
    key: "crypto",
    name: "Kripto",
    emoji: "🪙",
    basePct: 28,
    volPct: 38,
    note: "Imbal hasil tinggi, bisa minus",
    tone: "gold" as const,
  },
] as const;

type AllocKey = (typeof ASSET_CLASSES)[number]["key"];

interface AllocOutcome {
  key: AllocKey;
  alloc: number;
  returnPct: number;
  value: number;
}

export function AlokasiModalGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [alloc, setAlloc] = useState<Record<AllocKey, number>>({
    bond: 400,
    stock: 400,
    crypto: 200,
  });
  const [outcome, setOutcome] = useState<AllocOutcome[] | null>(null);

  const invested = alloc.bond + alloc.stock + alloc.crypto;
  const leftover = ALLOC_TOTAL - invested;
  const finalValue = outcome
    ? outcome.reduce((total, row) => total + row.value, 0)
    : ALLOC_TOTAL;

  const reset = () => setOutcome(null);

  const adjust = (key: AllocKey, direction: 1 | -1) => {
    setAlloc((previous) => {
      const next = previous[key] + direction * ALLOC_STEP;
      if (next < 0) return previous;
      if (direction > 0 && invested + ALLOC_STEP > ALLOC_TOTAL) return previous;
      return { ...previous, [key]: next };
    });
  };

  const invest = () => {
    const rows = ASSET_CLASSES.map((asset, index) => {
      const roll = rng(3300 + index * 71 + Math.round(alloc[asset.key] / ALLOC_STEP))();
      const returnPct = Math.round((asset.basePct + (roll * 2 - 1) * asset.volPct) * 10) / 10;
      const value = Math.max(
        0,
        Math.round(alloc[asset.key] * (1 + returnPct / 100)),
      );
      return { key: asset.key, alloc: alloc[asset.key], returnPct, value };
    });
    setOutcome(rows);
    onFinish({
      score: rows.reduce((total, row) => total + row.value, 0),
      total: ALLOC_TOTAL,
    });
  };

  if (outcome) {
    const profit = finalValue - ALLOC_TOTAL;
    return (
      <div className="space-y-3">
        <div
          className={cx(
            "rounded-xl border p-4 text-center",
            profit >= 0 ? "border-up/40 bg-up/10" : "border-down/40 bg-down/10",
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            Nilai portofolio setelah 12 bulan
          </div>
          <div
            className={cx(
              "mt-1 text-3xl font-black tabular-nums",
              profit >= 0 ? "text-up" : "text-down",
            )}
          >
            {cr(finalValue)}
          </div>
          <div
            className={cx(
              "mt-1 text-xs font-bold tabular-nums",
              profit >= 0 ? "text-up" : "text-down",
            )}
          >
            {profit >= 0 ? "+" : ""}
            Rp {profit} ({((profit / ALLOC_TOTAL) * 100).toFixed(1)}%)
          </div>
        </div>

        <div className="space-y-1.5">
          {ASSET_CLASSES.map((asset) => {
            const row = outcome.find((entry) => entry.key === asset.key)!;
            return (
              <div
                key={asset.key}
                className="flex items-center justify-between rounded-lg border border-line bg-elevated px-3 py-2 text-[11px]"
              >
                <span className="text-[#c7ccd4]">
                  {asset.emoji} {asset.name}{" "}
                  <span className="text-muted">· {cr(row.alloc)}</span>
                </span>
                <span className="text-right">
                  <span
                    className={cx(
                      "block font-bold tabular-nums",
                      row.returnPct >= 0 ? "text-up" : "text-down",
                    )}
                  >
                    {row.returnPct >= 0 ? "+" : ""}
                    {row.returnPct}%
                  </span>
                  <span className="block tabular-nums text-white">{cr(row.value)}</span>
                </span>
              </div>
            );
          })}
        </div>

        <ResultBanner
          score={Math.max(0, finalValue)}
          total={ALLOC_TOTAL}
          onRetry={reset}
          label="Nilai"
          note="Diversifikasi menahan guncangan satu aset, tetapi tidak menghapus risiko pasar."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Modal {cr(ALLOC_TOTAL)}</span>
        <span>
          Belum dialokasikan:{" "}
          <strong className={leftover > 0 ? "text-gold" : "text-white"}>{cr(leftover)}</strong>
        </span>
      </div>

      <div className="space-y-1.5">
        {ASSET_CLASSES.map((asset) => (
          <div
            key={asset.key}
            className="rounded-lg border border-line bg-elevated px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-white">
                {asset.emoji} {asset.name}
                <span className="ml-1 text-[9px] font-medium text-muted">{asset.note}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjust(asset.key, -1)}
                  disabled={alloc[asset.key] === 0}
                  className="h-6 w-6 rounded border border-line bg-surface text-xs font-black text-[#c7ccd4] transition hover:border-down/50 hover:text-down disabled:opacity-30"
                  aria-label={`Kurangi ${asset.name}`}
                >
                  −
                </button>
                <span className="w-16 text-right font-black tabular-nums text-white">
                  {cr(alloc[asset.key])}
                </span>
                <button
                  type="button"
                  onClick={() => adjust(asset.key, 1)}
                  disabled={leftover < ALLOC_STEP}
                  className="h-6 w-6 rounded border border-line bg-surface text-xs font-black text-[#c7ccd4] transition hover:border-brand/50 hover:text-brand disabled:opacity-30"
                  aria-label={`Tambah ${asset.name}`}
                >
                  +
                </button>
              </span>
            </div>
            <p className="mt-1 text-[9.5px] text-muted">
              Ekspektasi {asset.basePct}% per tahun · rentang ±{asset.volPct}%
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>Alokasi saat ini</span>
        <span className="tabular-nums">
          {Math.round((invested / ALLOC_TOTAL) * 100)}% dari modal
        </span>
      </div>

      <button
        type="button"
        onClick={invest}
        disabled={invested === 0}
        className="w-full rounded-lg bg-brand py-2.5 text-xs font-black text-[#04120e] transition hover:bg-brand-strong disabled:opacity-40"
      >
        Jalankan 12 bulan
      </button>
      <p className="text-[10px] leading-relaxed text-muted">
        Sisa kas tidak berbunga. Kripto bisa memberi hasil terbesar sekaligus kerugian
        terbesar — porsi besar di sana adalah taruhan, bukan diversifikasi.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Business quiz                                                       */
/* ------------------------------------------------------------------ */

export const BISNIS_QUESTIONS: QuizQuestion[] = [
  {
    prompt: "Margin kotor 30% dari pendapatan 50Rp 0. Berapa laba kotornya?",
    options: ["15Rp 0", "30Rp 0", "3Rp 0", "35Rp 0"],
    answer: 0,
    explain: "500 × 30% = 15Rp 0.",
  },
  {
    prompt:
      "Kas awal 1.00Rp 0, laba bulan ini 20Rp 0, lalu beli stok 30Rp 0. Berapa kas akhirnya?",
    options: ["90Rp 0", "1.20Rp 0", "70Rp 0", "1.50Rp 0"],
    answer: 0,
    explain: "1.000 + 200 − 300 = 90Rp 0. Laba bukan kas sampai ditagih.",
  },
  {
    prompt: "Terjual 50 unit di harga 2Rp 0 dengan biaya 1Rp 2 per unit. Berapa labanya?",
    options: ["40Rp 0", "60Rp 0", "1.00Rp 0", "16Rp 0"],
    answer: 0,
    explain: "(20 − 12) × 50 = 40Rp 0.",
  },
  {
    prompt: "Utang 80Rp 0 dan ekuitas 20Rp 0. Berapa rasio utang terhadap total aset?",
    options: ["80%", "40%", "20%", "400%"],
    answer: 0,
    explain: "800 / (800 + 200) = 80%. Leverage tinggi memperbesar risiko.",
  },
  {
    prompt: "ROE (return on equity) mengukur apa?",
    options: [
      "Laba bersih dibagi ekuitas pemegang saham",
      "Pendapatan dibagi jumlah karyawan",
      "Harga saham dibagi laba per saham",
      "Kas dibagi total utang",
    ],
    answer: 0,
    explain: "ROE = laba bersih ÷ ekuitas; seberapa efisien modal pemilik menghasilkan laba.",
  },
  {
    prompt: "Produk 25Rp 0 didiskon 20%. Berapa harga yang dibayar?",
    options: ["20Rp 0", "23Rp 0", "5Rp 0", "22Rp 0"],
    answer: 0,
    explain: "250 × (1 − 0,20) = 20Rp 0.",
  },
];
