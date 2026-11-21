"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx, Panel } from "./ui";

export interface ArcadeResult {
  score: number;
  total: number;
}

type Accent = "brand" | "gold" | "up" | "down";

interface GameMeta {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  tag: string;
  accent: Accent;
}

const GAMES = [
  {
    id: "direction",
    title: "Tebak Arah",
    blurb: "Lihat riwayat harga, tebak candle berikutnya naik atau turun.",
    emoji: "🎯",
    tag: "Prediksi",
    accent: "brand",
  },
  {
    id: "spotsim",
    title: "Beli Murah, Jual Mahal",
    blurb: "Kelola kas dan unit selama 12 tick, lalu lihat ekuitas akhirmu.",
    emoji: "🪙",
    tag: "Simulasi",
    accent: "gold",
  },
  {
    id: "pnl",
    title: "Hitung PnL",
    blurb: "Hitung untung/rugi dari harga beli, harga jual, dan jumlah unit.",
    emoji: "🧮",
    tag: "Kuis",
    accent: "up",
  },
  {
    id: "ordertype",
    title: "Market atau Limit?",
    blurb: "Pilih jenis order yang tepat untuk setiap situasi pasar.",
    emoji: "🧾",
    tag: "Kuis",
    accent: "brand",
  },
  {
    id: "leverage",
    title: "Leverage Risk",
    blurb: "Uji pemahaman margin, likuidasi, dan bahaya leverage tinggi.",
    emoji: "⚡",
    tag: "Kuis",
    accent: "down",
  },
  {
    id: "candle",
    title: "Baca Candle",
    blurb: "Tentukan apakah candle yang tampil bullish, bearish, atau doji.",
    emoji: "🕯️",
    tag: "Teknikal",
    accent: "gold",
  },
  {
    id: "memory",
    title: "Memory Koin",
    blurb: "Cocokkan pasangan simbol koin dengan jumlah langkah paling sedikit.",
    emoji: "🧠",
    tag: "Santai",
    accent: "up",
  },
  {
    id: "reaction",
    title: "Reaksi Harga",
    blurb: "Hentikan penanda tepat di zona hijau secepat mungkin.",
    emoji: "⏱️",
    tag: "Refleks",
    accent: "brand",
  },
  {
    id: "volatility",
    title: "Volatilitas",
    blurb: "Dari dua grafik, pilih mana yang pergerakannya lebih liar.",
    emoji: "🌊",
    tag: "Analisis",
    accent: "gold",
  },
  {
    id: "myth",
    title: "Mitos atau Fakta",
    blurb: "Lima pernyataan trading: mana yang fakta, mana yang mitos?",
    emoji: "🃏",
    tag: "Wawasan",
    accent: "down",
  },
] as const satisfies readonly GameMeta[];

type GameId = (typeof GAMES)[number]["id"];

const ACCENT_STYLES: Record<
  Accent,
  { chip: string; hover: string; icon: string }
> = {
  brand: {
    chip: "bg-brand/12 text-brand",
    hover: "hover:border-brand/50",
    icon: "bg-brand/12 text-brand",
  },
  gold: {
    chip: "bg-gold/12 text-gold",
    hover: "hover:border-gold/50",
    icon: "bg-gold/12 text-gold",
  },
  up: {
    chip: "bg-up/12 text-up",
    hover: "hover:border-up/50",
    icon: "bg-up/12 text-up",
  },
  down: {
    chip: "bg-down/12 text-down",
    hover: "hover:border-down/50",
    icon: "bg-down/12 text-down",
  },
};

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeSeries(seed: number, count: number, from = 100, volatility = 0.05): number[] {
  const rand = rng(seed);
  const values = [from];
  for (let i = 1; i < count; i += 1) {
    const prev = values[i - 1]!;
    values.push(Math.max(1, prev * (1 + (rand() - 0.5) * 2 * volatility)));
  }
  // Guarantee the final move is not flat so Up/Down has a clean answer.
  const last = values[values.length - 1]!;
  const before = values[values.length - 2]!;
  if (Math.abs(last - before) < 0.01) {
    values[values.length - 1] = before * 1.002;
  }
  return values;
}

function Spark({
  values,
  tone = "brand",
  className = "",
}: {
  values: readonly number[];
  tone?: "brand" | "up" | "down" | "gold";
  className?: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 160;
  const height = 46;
  const coords = values.map((value, index) => {
    const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
    const y = 3 + (1 - (value - min) / span) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color =
    tone === "up"
      ? "text-up"
      : tone === "down"
        ? "text-down"
        : tone === "gold"
          ? "text-gold"
          : "text-brand";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cx("h-12 w-full", color, className)}
      role="img"
      aria-label="Grafik harga mini"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OptionButton({
  children,
  state = "idle",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  state?: "idle" | "correct" | "wrong" | "muted";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
        state === "correct"
          ? "border-up/60 bg-up/12 text-up"
          : state === "wrong"
            ? "border-down/60 bg-down/12 text-down"
            : state === "muted"
              ? "border-line bg-elevated text-muted opacity-60"
              : "border-line bg-elevated text-[#c7ccd4] hover:border-brand/40 hover:bg-surface-2 hover:text-white",
        disabled && "cursor-default",
      )}
    >
      {children}
    </button>
  );
}

function ResultBanner({
  score,
  total,
  onRetry,
  label = "Skor",
}: {
  score: number;
  total: number;
  onRetry: () => void;
  label?: string;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const great = pct >= 70;
  return (
    <div className="rounded-xl border border-line bg-elevated p-4 text-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
        Permainan selesai
      </div>
      <div
        className={cx(
          "mt-1 text-2xl font-black tabular-nums",
          great ? "text-up" : "text-gold",
        )}
      >
        {label} {score}
        <span className="text-sm font-bold text-muted"> / {total}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {great ? "Kerja bagus — kamu sudah pegang dasar-dasarnya." : "Belum buruk. Coba lagi untuk memperbaiki skor."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-brand px-4 py-2 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
      >
        Main lagi
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Tebak arah                                                       */
/* ------------------------------------------------------------------ */

const DIRECTION_ROUNDS = 8;

function DirectionGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [guess, setGuess] = useState<"UP" | "DOWN" | null>(null);
  const [finished, setFinished] = useState(false);

  const values = useMemo(
    () => makeSeries(101 + round * 37, 11, 100, 0.055),
    [round],
  );
  const correct: "UP" | "DOWN" =
    values[values.length - 1]! > values[values.length - 2]! ? "UP" : "DOWN";

  const reset = () => {
    setRound(0);
    setScore(0);
    setGuess(null);
    setFinished(false);
  };

  if (finished) {
    return <ResultBanner score={score} total={DIRECTION_ROUNDS} onRetry={reset} label="Benar" />;
  }

  const pick = (side: "UP" | "DOWN") => {
    if (guess) return;
    setGuess(side);
    if (side === correct) setScore((value) => value + 1);
  };

  const next = () => {
    const nextScore = score;
    if (round + 1 >= DIRECTION_ROUNDS) {
      setFinished(true);
      onFinish({ score: nextScore, total: DIRECTION_ROUNDS });
      return;
    }
    setRound((value) => value + 1);
    setGuess(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Ronde <strong className="text-white">{round + 1}</strong>/{DIRECTION_ROUNDS}
        </span>
        <span>
          Benar: <strong className="text-up">{score}</strong>
        </span>
      </div>

      <div className="rounded-xl border border-line bg-elevated p-3">
        <Spark
          values={guess ? values : values.slice(0, -1)}
          tone={
            guess
              ? correct === "UP"
                ? "up"
                : "down"
              : "brand"
          }
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>Harga awal 100</span>
          <span className="tabular-nums">
            Terakhir {values[guess ? values.length - 1 : values.length - 2]!.toFixed(2)}
          </span>
        </div>
      </div>

      {guess ? (
        <div
          className={cx(
            "rounded-lg border px-3 py-2 text-xs font-bold",
            guess === correct
              ? "border-up/40 bg-up/12 text-up"
              : "border-down/40 bg-down/12 text-down",
          )}
        >
          {guess === correct ? "Tepat!" : "Melenceng."} Harga bergerak{" "}
          {correct === "UP" ? "naik" : "turun"} ke{" "}
          {values[values.length - 1]!.toFixed(2)}.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => pick("UP")}
            className="rounded-lg bg-up py-2.5 text-xs font-black text-white transition hover:brightness-110"
          >
            ↑ Naik
          </button>
          <button
            type="button"
            onClick={() => pick("DOWN")}
            className="rounded-lg bg-down py-2.5 text-xs font-black text-white transition hover:brightness-110"
          >
            ↓ Turun
          </button>
        </div>
      )}

      {guess ? (
        <button
          type="button"
          onClick={next}
          className="w-full rounded-lg border border-line bg-surface-2 py-2 text-xs font-bold text-white transition hover:border-brand/40"
        >
          {round + 1 >= DIRECTION_ROUNDS ? "Lihat hasil" : "Ronde berikutnya →"}
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Spot simulation                                                  */
/* ------------------------------------------------------------------ */

const SPOT_STEPS = 12;
const SPOT_START_CASH = 1000;

function SpotSimGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const prices = useMemo(() => makeSeries(777, SPOT_STEPS + 1, 100, 0.035), []);
  const [step, setStep] = useState(0);
  const [cash, setCash] = useState(SPOT_START_CASH);
  const [units, setUnits] = useState(0);
  const [finished, setFinished] = useState(false);

  const price = prices[step]!;
  const equity = cash + units * price;

  const reset = () => {
    setStep(0);
    setCash(SPOT_START_CASH);
    setUnits(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="space-y-3">
        <ResultBanner
          score={Math.round(equity)}
          total={SPOT_START_CASH}
          onRetry={reset}
          label="Ekuitas"
        />
        <p className="text-center text-[11px] text-muted">
          Ekuitas akhir = kas {cash.toFixed(2)} CR + {units} unit ×{" "}
          {price.toFixed(2)} CR. Modal awal {SPOT_START_CASH} CR.
        </p>
      </div>
    );
  }

  const advance = () => {
    if (step + 1 >= SPOT_STEPS) {
      setFinished(true);
      onFinish({ score: Math.round(equity), total: SPOT_START_CASH });
      return;
    }
    setStep((value) => value + 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Tick <strong className="text-white">{step + 1}</strong>/{SPOT_STEPS}
        </span>
        <span className="tabular-nums">
          Harga <strong className="text-white">{price.toFixed(2)}</strong> CR
        </span>
      </div>

      <div className="rounded-xl border border-line bg-elevated p-3">
        <Spark values={prices.slice(0, step + 1)} tone="gold" />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-line bg-elevated p-2">
          <dt className="text-[9px] uppercase tracking-wider text-muted">Kas</dt>
          <dd className="mt-0.5 text-sm font-black tabular-nums text-white">
            {cash.toFixed(2)}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-elevated p-2">
          <dt className="text-[9px] uppercase tracking-wider text-muted">Unit</dt>
          <dd className="mt-0.5 text-sm font-black tabular-nums text-gold">{units}</dd>
        </div>
        <div className="rounded-lg border border-line bg-elevated p-2">
          <dt className="text-[9px] uppercase tracking-wider text-muted">Ekuitas</dt>
          <dd
            className={cx(
              "mt-0.5 text-sm font-black tabular-nums",
              equity >= SPOT_START_CASH ? "text-up" : "text-down",
            )}
          >
            {equity.toFixed(2)}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={cash < price}
          onClick={() => {
            setCash((value) => value - price);
            setUnits((value) => value + 1);
          }}
          className="rounded-lg bg-up py-2.5 text-xs font-black text-white transition hover:brightness-110 disabled:opacity-40"
        >
          Beli 1 unit
        </button>
        <button
          type="button"
          disabled={units === 0}
          onClick={() => {
            setCash((value) => value + price);
            setUnits((value) => value - 1);
          }}
          className="rounded-lg bg-down py-2.5 text-xs font-black text-white transition hover:brightness-110 disabled:opacity-40"
        >
          Jual 1 unit
        </button>
      </div>

      <button
        type="button"
        onClick={advance}
        className="w-full rounded-lg border border-line bg-surface-2 py-2 text-xs font-bold text-white transition hover:border-brand/40"
      >
        {step + 1 >= SPOT_STEPS ? "Akhiri & lihat ekuitas" : "Tick berikutnya →"}
      </button>
      <p className="text-[10px] leading-relaxed text-muted">
        Beli saat murah, jual saat mahal. Tidak ada biaya transaksi di mini-game ini.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared quiz                                                         */
/* ------------------------------------------------------------------ */

interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
}

function QuizGame({
  questions,
  onFinish,
  label = "Benar",
}: {
  questions: readonly QuizQuestion[];
  onFinish: (result: ArcadeResult) => void;
  label?: string;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[index]!;

  const reset = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return <ResultBanner score={score} total={questions.length} onRetry={reset} label={label} />;
  }

  const choose = (option: number) => {
    if (selected !== null) return;
    setSelected(option);
    if (option === question.answer) setScore((value) => value + 1);
  };

  const advance = () => {
    const nextScore = score;
    if (index + 1 >= questions.length) {
      setFinished(true);
      onFinish({ score: nextScore, total: questions.length });
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Soal <strong className="text-white">{index + 1}</strong>/{questions.length}
        </span>
        <span>
          Benar: <strong className="text-up">{score}</strong>
        </span>
      </div>

      <p className="rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm font-semibold leading-relaxed text-white">
        {question.prompt}
      </p>

      <div className="space-y-1.5">
        {question.options.map((option, optionIndex) => {
          const state =
            selected === null
              ? "idle"
              : optionIndex === question.answer
                ? "correct"
                : optionIndex === selected
                  ? "wrong"
                  : "muted";
          return (
            <OptionButton
              key={option}
              state={state}
              disabled={selected !== null}
              onClick={() => choose(optionIndex)}
            >
              {option}
            </OptionButton>
          );
        })}
      </div>

      {selected !== null ? (
        <>
          <p
            className={cx(
              "rounded-lg border px-3 py-2 text-[11px] leading-relaxed",
              selected === question.answer
                ? "border-up/40 bg-up/10 text-up"
                : "border-down/40 bg-down/10 text-down",
            )}
          >
            {selected === question.answer ? "Benar! " : "Belum tepat. "}
            {question.explain}
          </p>
          <button
            type="button"
            onClick={advance}
            className="w-full rounded-lg border border-line bg-surface-2 py-2 text-xs font-bold text-white transition hover:border-brand/40"
          >
            {index + 1 >= questions.length ? "Lihat hasil" : "Soal berikutnya →"}
          </button>
        </>
      ) : null}
    </div>
  );
}

const PNL_QUESTIONS: QuizQuestion[] = [
  {
    prompt: "Kamu beli 10 unit di 50 CR, lalu jual semua di 62 CR. Berapa untungnya?",
    options: ["12 CR", "120 CR", "620 CR", "112 CR"],
    answer: 1,
    explain: "(62 − 50) × 10 unit = 120 CR.",
  },
  {
    prompt: "Beli 4 unit di 250 CR, jual di 210 CR. Berapa kerugiannya?",
    options: ["40 CR", "100 CR", "160 CR", "1.000 CR"],
    answer: 2,
    explain: "(250 − 210) × 4 = 160 CR kerugian.",
  },
  {
    prompt: "Beli 25 unit di 8 CR, jual di 11 CR. Berapa hasil bersihnya?",
    options: ["75 CR", "225 CR", "275 CR", "200 CR"],
    answer: 0,
    explain: "(11 − 8) × 25 = 75 CR.",
  },
  {
    prompt: "Kamu punya 500 CR dan harga aset 20 CR. Maksimal berapa unit yang bisa dibeli?",
    options: ["20 unit", "25 unit", "50 unit", "10 unit"],
    answer: 1,
    explain: "500 ÷ 20 = 25 unit.",
  },
  {
    prompt: "Beli 3 unit di 1.200 CR, jual di 1.050 CR. Berapa kerugiannya?",
    options: ["150 CR", "450 CR", "3.150 CR", "1.050 CR"],
    answer: 1,
    explain: "(1.200 − 1.050) × 3 = 450 CR.",
  },
];

const ORDER_TYPE_QUESTIONS: QuizQuestion[] = [
  {
    prompt: "Harga BTC sekarang 92.000 CR. Kamu hanya mau beli jika harga turun ke 90.000 CR. Order apa?",
    options: ["Market buy", "Limit buy di 90.000", "Market sell", "Stop loss"],
    answer: 1,
    explain: "Limit buy menunggu harga menyentuh target 90.000 CR.",
  },
  {
    prompt: "Kamu ingin keluar dari posisi sekarang juga tanpa menunggu harga tertentu. Order apa?",
    options: ["Limit sell", "Market sell", "Buy stop", "Take profit 10%"],
    answer: 1,
    explain: "Market sell mengeksekusi segera di harga terbaik yang tersedia.",
  },
  {
    prompt: "Order yang tereksekusi langsung di harga pasar saat ini disebut…",
    options: ["Limit order", "Market order", "Stop order", "Iceberg order"],
    answer: 1,
    explain: "Market order langsung mencocokkan dengan harga yang tersedia.",
  },
  {
    prompt: "Kamu pasang limit buy di 100 CR, tetapi harga malah naik ke 110 CR. Apa yang terjadi?",
    options: [
      "Langsung terbeli di 110 CR",
      "Order menunggu sampai harga menyentuh 100 CR",
      "Order otomatis dibatalkan",
      "Order berubah menjadi market order",
    ],
    answer: 1,
    explain: "Limit order tetap menunggu; tidak mengejar harga yang sudah lewat.",
  },
];

const LEVERAGE_QUESTIONS: QuizQuestion[] = [
  {
    prompt: "Kamu buka LONG 10x. Harga turun 12% tanpa henti. Apa yang paling mungkin terjadi?",
    options: ["Masih aman", "Posisi likuidasi", "Profit 12%", "Margin bertambah"],
    answer: 1,
    explain: "Dengan 10x, pergerakan 10% melawan posisi sudah menghabiskan margin.",
  },
  {
    prompt: "Leverage 2x artinya modal yang dipakai sebagai margin adalah…",
    options: ["2% dari nilai posisi", "20% dari nilai posisi", "50% dari nilai posisi", "200% dari nilai posisi"],
    answer: 2,
    explain: "2x berarti margin 1/2 (50%) dari nilai posisi.",
  },
  {
    prompt: "Mana yang paling berisiko likuidasi cepat jika harga bergerak melawan?",
    options: ["Spot tanpa leverage", "Futures 2x", "Futures 5x", "Futures 20x"],
    answer: 3,
    explain: "Semakin tinggi leverage, semakin tipis jarak ke harga likuidasi.",
  },
  {
    prompt: "Apa fungsi utama stop loss?",
    options: [
      "Menjamin profit",
      "Membatasi kerugian pada level yang ditentukan",
      "Menghapus biaya transaksi",
      "Menaikkan leverage otomatis",
    ],
    answer: 1,
    explain: "Stop loss menutup posisi saat harga menyentuh batas rugi yang kamu tetapkan.",
  },
];

const MYTH_QUESTIONS: QuizQuestion[] = [
  {
    prompt: "\"Diversifikasi membantu mengurangi risiko portofolio.\"",
    options: ["Fakta", "Mitos"],
    answer: 0,
    explain: "Menyebar dana ke beberapa aset mengurangi ketergantungan pada satu posisi.",
  },
  {
    prompt: "\"Leverage tinggi membuat harga likuidasi makin jauh dari harga masuk.\"",
    options: ["Fakta", "Mitos"],
    answer: 1,
    explain: "Justru sebaliknya: leverage tinggi membuat harga likuidasi makin dekat.",
  },
  {
    prompt: "\"Order market dijamin mendapat harga terbaik di masa depan.\"",
    options: ["Fakta", "Mitos"],
    answer: 1,
    explain: "Market order mengeksekusi sekarang, bukan menjamin harga masa depan.",
  },
  {
    prompt: "\"Futures memungkinkan mengambil posisi short saat harga diprediksi turun.\"",
    options: ["Fakta", "Mitos"],
    answer: 0,
    explain: "Itulah salah satu fungsi futures: mendapat keuntungan dari penurunan harga.",
  },
  {
    prompt: "\"Selalu membeli saat harga turun pasti menghasilkan profit.\"",
    options: ["Fakta", "Mitos"],
    answer: 1,
    explain: "Harga bisa terus turun. Tanpa analisis dan manajemen risiko, itu bukan jaminan.",
  },
];

/* ------------------------------------------------------------------ */
/* 6. Baca candle                                                      */
/* ------------------------------------------------------------------ */

interface CandleQuestion {
  open: number;
  high: number;
  low: number;
  close: number;
  answer: "BULLISH" | "BEARISH" | "DOJI";
}

const CANDLE_QUESTIONS: CandleQuestion[] = [
  { open: 100, high: 116, low: 96, close: 112, answer: "BULLISH" },
  { open: 120, high: 124, low: 101, close: 104, answer: "BEARISH" },
  { open: 80, high: 88, low: 72, close: 80.2, answer: "DOJI" },
  { open: 45, high: 47, low: 38, close: 39, answer: "BEARISH" },
  { open: 60, high: 69, low: 58, close: 67, answer: "BULLISH" },
];

function CandleGlyph({ candle }: { candle: CandleQuestion }) {
  const min = candle.low;
  const max = candle.high;
  const span = max - min || 1;
  const y = (value: number) => 8 + (1 - (value - min) / span) * 104;
  const bullish = candle.close >= candle.open;
  const color = candle.answer === "DOJI" ? "#f0b90b" : bullish ? "#0ecb81" : "#f6465d";
  const bodyTop = y(Math.max(candle.open, candle.close));
  const bodyBottom = y(Math.min(candle.open, candle.close));

  return (
    <svg viewBox="0 0 120 120" className="h-36 w-full" role="img" aria-label="Candle chart">
      <line x1="60" y1="4" x2="60" y2="116" stroke="#232830" strokeWidth="1" />
      <line x1="24" y1={y(candle.open)} x2="96" y2={y(candle.open)} stroke="#5e6673" strokeDasharray="2 3" />
      <line x1="60" y1={y(candle.high)} x2="60" y2={y(candle.low)} stroke={color} strokeWidth="2" />
      <rect
        x="40"
        y={bodyTop}
        width="40"
        height={Math.max(3, bodyBottom - bodyTop)}
        fill={color}
        rx="2"
      />
      <text x="100" y={y(candle.high) + 3} fontSize="8" fill="#848e9c" textAnchor="start">
        H
      </text>
      <text x="100" y={y(candle.low) + 3} fontSize="8" fill="#848e9c" textAnchor="start">
        L
      </text>
    </svg>
  );
}

function CandleGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<CandleQuestion["answer"] | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = CANDLE_QUESTIONS[index]!;

  const reset = () => {
    setIndex(0);
    setGuess(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return <ResultBanner score={score} total={CANDLE_QUESTIONS.length} onRetry={reset} label="Benar" />;
  }

  const choose = (answer: CandleQuestion["answer"]) => {
    if (guess) return;
    setGuess(answer);
    if (answer === question.answer) setScore((value) => value + 1);
  };

  const advance = () => {
    if (index + 1 >= CANDLE_QUESTIONS.length) {
      setFinished(true);
      onFinish({ score, total: CANDLE_QUESTIONS.length });
      return;
    }
    setIndex((value) => value + 1);
    setGuess(null);
  };

  const labels: Array<[CandleQuestion["answer"], string]> = [
    ["BULLISH", "Bullish (naik)"],
    ["BEARISH", "Bearish (turun)"],
    ["DOJI", "Doji (ragu-ragu)"],
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Candle <strong className="text-white">{index + 1}</strong>/{CANDLE_QUESTIONS.length}
        </span>
        <span>
          Benar: <strong className="text-up">{score}</strong>
        </span>
      </div>

      <div className="rounded-xl border border-line bg-elevated p-2">
        <CandleGlyph candle={question} />
        <p className="text-center text-[10px] text-muted">
          Open {question.open} · High {question.high} · Low {question.low} · Close {question.close}
        </p>
      </div>

      <div className="space-y-1.5">
        {labels.map(([value, label]) => (
          <OptionButton
            key={value}
            disabled={guess !== null}
            state={
              guess === null
                ? "idle"
                : value === question.answer
                  ? "correct"
                  : value === guess
                    ? "wrong"
                    : "muted"
            }
            onClick={() => choose(value)}
          >
            {label}
          </OptionButton>
        ))}
      </div>

      {guess ? (
        <>
          <p
            className={cx(
              "rounded-lg border px-3 py-2 text-[11px]",
              guess === question.answer
                ? "border-up/40 bg-up/10 text-up"
                : "border-down/40 bg-down/10 text-down",
            )}
          >
            {guess === question.answer ? "Tepat. " : "Belum tepat. "}
            Candle dengan close {question.close >= question.open ? "di atas" : "di bawah"} open
            adalah {question.answer.toLowerCase()}.
          </p>
          <button
            type="button"
            onClick={advance}
            className="w-full rounded-lg border border-line bg-surface-2 py-2 text-xs font-bold text-white transition hover:border-brand/40"
          >
            {index + 1 >= CANDLE_QUESTIONS.length ? "Lihat hasil" : "Candle berikutnya →"}
          </button>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Memory koin                                                      */
/* ------------------------------------------------------------------ */

const MEMORY_ORDER = ["BTC", "ETH", "SOL", "DOGE", "ETH", "DOGE", "BTC", "SOL"];

function MemoryGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [finished, setFinished] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setFinished(false);
  };

  const score = Math.max(0, 40 - Math.max(0, moves - 4) * 2);

  if (finished) {
    return (
      <div className="space-y-3">
        <ResultBanner score={score} total={40} onRetry={reset} label="Poin" />
        <p className="text-center text-[11px] text-muted">
          Selesai dalam {moves} langkah. Semakin sedikit langkah, semakin tinggi poin.
        </p>
      </div>
    );
  }

  const flip = (index: number) => {
    if (flipped.includes(index) || matched.includes(index) || flipped.length === 2) return;
    const next = [...flipped, index];
    setFlipped(next);

    if (next.length === 2) {
      const [a, b] = next;
      setMoves((value) => value + 1);
      if (MEMORY_ORDER[a!] === MEMORY_ORDER[b!]) {
        const nextMatched = [...matched, a!, b!];
        setMatched(nextMatched);
        setFlipped([]);
        if (nextMatched.length === MEMORY_ORDER.length) {
          setFinished(true);
          onFinish({ score: Math.max(0, 40 - Math.max(0, moves + 1 - 4) * 2), total: 40 });
        }
      } else {
        timer.current = setTimeout(() => setFlipped([]), 750);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Langkah: <strong className="text-white">{moves}</strong>
        </span>
        <span>
          Pasangan: <strong className="text-up">{matched.length / 2}</strong>/4
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {MEMORY_ORDER.map((symbol, index) => {
          const open = flipped.includes(index) || matched.includes(index);
          return (
            <button
              key={`${symbol}-${index}`}
              type="button"
              onClick={() => flip(index)}
              className={cx(
                "flex h-16 items-center justify-center rounded-lg border text-sm font-black transition",
                matched.includes(index)
                  ? "border-up/50 bg-up/12 text-up"
                  : open
                    ? "border-gold/50 bg-gold/12 text-gold"
                    : "border-line bg-elevated text-[#5e6673] hover:border-brand/40 hover:text-brand",
              )}
            >
              {open ? symbol : "?"}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-muted">
        Buka dua kartu. Simbol yang sama akan cocok dan tetap terbuka.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Reaksi harga                                                     */
/* ------------------------------------------------------------------ */

function ReactionGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [running, setRunning] = useState(true);
  const [position, setPosition] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const direction = useRef(1);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setPosition((prev) => {
        let next = prev + direction.current * 2.2;
        if (next >= 100) {
          next = 100;
          direction.current = -1;
        } else if (next <= 0) {
          next = 0;
          direction.current = 1;
        }
        return next;
      });
    }, 35);
    return () => clearInterval(id);
  }, [running]);

  const stop = () => {
    if (!running) return;
    setRunning(false);
    const distance = Math.abs(50 - position);
    const score =
      position >= 42 && position <= 58 ? 100 : Math.max(0, Math.round(100 - (distance - 8) * 6));
    setResult(score);
    onFinish({ score, total: 100 });
  };

  const retry = () => {
    direction.current = 1;
    setPosition(0);
    setResult(null);
    setRunning(true);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-elevated p-4">
        <div className="relative h-10 overflow-hidden rounded-lg border border-line bg-surface-2">
          <div className="absolute inset-y-0 left-[42%] w-[16%] bg-up/20 ring-1 ring-inset ring-up/40" />
          <div
            className="absolute top-1/2 h-6 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_12px_rgba(240,185,11,0.9)]"
            style={{ left: `${position}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-muted">
          <span>0</span>
          <span>Zona ideal</span>
          <span>100</span>
        </div>
      </div>

      {result === null ? (
        <button
          type="button"
          onClick={stop}
          className="w-full rounded-lg bg-brand py-3 text-sm font-black text-[#04120e] transition hover:bg-brand-strong"
        >
          STOP!
        </button>
      ) : (
        <>
          <div
            className={cx(
              "rounded-lg border px-3 py-2 text-center text-sm font-black",
              result >= 100
                ? "border-up/40 bg-up/12 text-up"
                : result > 0
                  ? "border-gold/40 bg-gold/12 text-gold"
                  : "border-down/40 bg-down/12 text-down",
            )}
          >
            {result >= 100 ? "Sempurna! " : result > 0 ? "Lumayan! " : "Meleset. "}
            Skor {result}/100
          </div>
          <button
            type="button"
            onClick={retry}
            className="w-full rounded-lg border border-line bg-surface-2 py-2 text-xs font-bold text-white transition hover:border-brand/40"
          >
            Coba lagi
          </button>
        </>
      )}

      <p className="text-[10px] leading-relaxed text-muted">
        Penanda bergerak bolak-balik. Tekan STOP saat berada di zona hijau (42–58).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Volatilitas                                                      */
/* ------------------------------------------------------------------ */

interface VolatilityRound {
  a: number[];
  b: number[];
  answer: "A" | "B";
}

function volatilityRounds(count: number): VolatilityRound[] {
  return Array.from({ length: count }, (_, index) => {
    const calm = makeSeries(500 + index * 91, 16, 100, 0.008);
    const wild = makeSeries(909 + index * 53, 16, 100, 0.05);
    return index % 2 === 0
      ? { a: calm, b: wild, answer: "B" }
      : { a: wild, b: calm, answer: "A" };
  });
}

function VolatilityGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const rounds = useMemo(() => volatilityRounds(5), []);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<"A" | "B" | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const round = rounds[index]!;

  const reset = () => {
    setIndex(0);
    setGuess(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return <ResultBanner score={score} total={rounds.length} onRetry={reset} label="Benar" />;
  }

  const choose = (side: "A" | "B") => {
    if (guess) return;
    setGuess(side);
    if (side === round.answer) setScore((value) => value + 1);
  };

  const advance = () => {
    if (index + 1 >= rounds.length) {
      setFinished(true);
      onFinish({ score, total: rounds.length });
      return;
    }
    setIndex((value) => value + 1);
    setGuess(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Ronde <strong className="text-white">{index + 1}</strong>/{rounds.length}
        </span>
        <span>
          Benar: <strong className="text-up">{score}</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["A", "B"] as const).map((side) => (
          <button
            key={side}
            type="button"
            disabled={guess !== null}
            onClick={() => choose(side)}
            className={cx(
              "rounded-xl border p-2 text-left transition",
              guess === null
                ? "border-line bg-elevated hover:border-brand/50"
                : side === round.answer
                  ? "border-up/60 bg-up/10"
                  : side === guess
                    ? "border-down/60 bg-down/10"
                    : "border-line bg-elevated opacity-60",
            )}
          >
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
              Grafik {side}
            </span>
            <Spark values={side === "A" ? round.a : round.b} tone="brand" />
          </button>
        ))}
      </div>

      {guess ? (
        <>
          <p
            className={cx(
              "rounded-lg border px-3 py-2 text-[11px]",
              guess === round.answer
                ? "border-up/40 bg-up/10 text-up"
                : "border-down/40 bg-down/10 text-down",
            )}
          >
            {guess === round.answer ? "Benar! " : "Belum tepat. "}
            Grafik {round.answer} punya rentang pergerakan yang jauh lebih besar.
          </p>
          <button
            type="button"
            onClick={advance}
            className="w-full rounded-lg border border-line bg-surface-2 py-2 text-xs font-bold text-white transition hover:border-brand/40"
          >
            {index + 1 >= rounds.length ? "Lihat hasil" : "Ronde berikutnya →"}
          </button>
        </>
      ) : (
        <p className="text-[10px] text-muted">Pilih grafik dengan volatilitas lebih tinggi.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Arcade shell                                                        */
/* ------------------------------------------------------------------ */

function GameFrame({
  meta,
  onBack,
  children,
}: {
  meta: GameMeta;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const accent = ACCENT_STYLES[meta.accent];
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-start gap-3">
          <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl text-lg", accent.icon)}>
            {meta.emoji}
          </span>
          <div>
            <h2 className="text-sm font-black text-white">{meta.title}</h2>
            <p className="mt-0.5 text-[11px] text-muted">{meta.blurb}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-line bg-elevated px-3 py-1.5 text-[11px] font-bold text-muted transition hover:border-brand/40 hover:text-white"
        >
          ← Semua game
        </button>
      </div>
      <div className="p-4">{children}</div>
    </Panel>
  );
}

export function TradingArcade() {
  const [active, setActive] = useState<GameId | null>(null);
  const [best, setBest] = useState<Partial<Record<GameId, ArcadeResult>>>({});

  const handleFinish = (id: GameId) => (result: ArcadeResult) => {
    setBest((previous) => {
      const existing = previous[id];
      if (existing && existing.score >= result.score) return previous;
      return { ...previous, [id]: result };
    });
  };

  const activeMeta = GAMES.find((game) => game.id === active);

  const renderGame = (id: GameId) => {
    switch (id) {
      case "direction":
        return <DirectionGame onFinish={handleFinish(id)} />;
      case "spotsim":
        return <SpotSimGame onFinish={handleFinish(id)} />;
      case "pnl":
        return <QuizGame questions={PNL_QUESTIONS} onFinish={handleFinish(id)} />;
      case "ordertype":
        return <QuizGame questions={ORDER_TYPE_QUESTIONS} onFinish={handleFinish(id)} />;
      case "leverage":
        return <QuizGame questions={LEVERAGE_QUESTIONS} onFinish={handleFinish(id)} />;
      case "candle":
        return <CandleGame onFinish={handleFinish(id)} />;
      case "memory":
        return <MemoryGame onFinish={handleFinish(id)} />;
      case "reaction":
        return <ReactionGame onFinish={handleFinish(id)} />;
      case "volatility":
        return <VolatilityGame onFinish={handleFinish(id)} />;
      case "myth":
        return <QuizGame questions={MYTH_QUESTIONS} onFinish={handleFinish(id)} label="Benar" />;
    }
  };

  if (active && activeMeta) {
    return (
      <div className="space-y-3">
        <GameFrame meta={activeMeta} onBack={() => setActive(null)}>
          {renderGame(active)}
        </GameFrame>
        <p className="text-center text-[10px] text-muted">
          Mini-game ini latihan ringan dan tidak mengubah saldo atau portofolio akunmu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-xs text-muted">
          <strong className="text-white">10 mini-game</strong> · rekam skor terbaik
          disimpan selama sesi ini
        </p>
        <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-bold text-gold">
          {Object.keys(best).length}/{GAMES.length} dimainkan
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {GAMES.map((game) => {
          const accent = ACCENT_STYLES[game.accent];
          const result = best[game.id];
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => setActive(game.id)}
              className={cx(
                "group flex flex-col rounded-xl border border-line bg-surface p-4 text-left shadow-[0_24px_70px_-50px_rgba(0,0,0,0.95)] transition",
                accent.hover,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl text-lg", accent.icon)}>
                  {game.emoji}
                </span>
                <span className={cx("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", accent.chip)}>
                  {game.tag}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-black text-white">{game.title}</h3>
              <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted">{game.blurb}</p>
              <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-2 text-[10px]">
                <span className="font-bold text-muted transition group-hover:text-brand">
                  Mainkan →
                </span>
                <span className="tabular-nums text-[#5e6673]">
                  {result ? `Rekor ${result.score}/${result.total}` : "Belum dimainkan"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
