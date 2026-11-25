"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../ui";
import {
  ResultBanner,
  type ArcadeResult,
  type QuizQuestion,
} from "./shared";

/* ------------------------------------------------------------------ */
/* Pola Candle                                                         */
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
  const color =
    candle.answer === "DOJI" ? "#f0b90b" : bullish ? "#0ecb81" : "#f6465d";
  const bodyTop = y(Math.max(candle.open, candle.close));
  const bodyBottom = y(Math.min(candle.open, candle.close));

  return (
    <svg viewBox="0 0 120 120" className="h-36 w-full" role="img" aria-label="Candle chart">
      <line x1="60" y1="4" x2="60" y2="116" stroke="#232830" strokeWidth="1" />
      <line
        x1="24"
        y1={y(candle.open)}
        x2="96"
        y2={y(candle.open)}
        stroke="#5e6673"
        strokeDasharray="2 3"
      />
      <line x1="60" y1={y(candle.high)} x2="60" y2={y(candle.low)} stroke={color} strokeWidth="2" />
      <rect
        x="40"
        y={bodyTop}
        width="40"
        height={Math.max(3, bodyBottom - bodyTop)}
        fill={color}
        rx="2"
      />
    </svg>
  );
}

export function CandleGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
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
    ["BULLISH", "Bullish — close di atas open"],
    ["BEARISH", "Bearish — close di bawah open"],
    ["DOJI", "Doji — open dan close hampir sama"],
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
          Open {question.open} · High {question.high} · Low {question.low} · Close{" "}
          {question.close}
        </p>
      </div>

      <div className="space-y-1.5">
        {labels.map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={guess !== null}
            onClick={() => choose(value)}
            className={cx(
              "w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
              guess === null
                ? "border-line bg-elevated text-[#c7ccd4] hover:border-brand/40 hover:text-white"
                : value === question.answer
                  ? "border-up/60 bg-up/12 text-up"
                  : value === guess
                    ? "border-down/60 bg-down/12 text-down"
                    : "border-line bg-elevated text-muted opacity-60",
            )}
          >
            {label}
          </button>
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
            {question.answer === "DOJI"
              ? `Body hanya ${Math.abs(question.close - question.open).toFixed(1)} poin dari rentang ${question.high - question.low} — open dan close hampir sama, jadi ini doji.`
              : `Body ${question.close >= question.open ? "di atas" : "di bawah"} open dalam rentang ${question.high - question.low} poin menunjukkan ${question.answer.toLowerCase()}.`}
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
/* Memory Emiten                                                       */
/* ------------------------------------------------------------------ */

const MEMORY_CARDS = [
  "BYTE",
  "GRAN",
  "NOVA",
  "HELX",
  "GRAN",
  "NOVA",
  "BYTE",
  "HELX",
] as const;

const TICKER_NAMES: Record<string, string> = {
  BYTE: "Bytecraft",
  GRAN: "Granary",
  NOVA: "Nova",
  HELX: "Helix",
};

export function MemoryGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
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
          Selesai dalam {moves} langkah. Hafalkan posisi emiten, bukan menebak acak.
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
      if (MEMORY_CARDS[a!] === MEMORY_CARDS[b!]) {
        const nextMatched = [...matched, a!, b!];
        setMatched(nextMatched);
        setFlipped([]);
        if (nextMatched.length === MEMORY_CARDS.length) {
          setFinished(true);
          onFinish({
            score: Math.max(0, 40 - Math.max(0, moves + 1 - 4) * 2),
            total: 40,
          });
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
        {MEMORY_CARDS.map((symbol, index) => {
          const open = flipped.includes(index) || matched.includes(index);
          return (
            <button
              key={`${symbol}-${index}`}
              type="button"
              onClick={() => flip(index)}
              className={cx(
                "flex h-16 flex-col items-center justify-center rounded-lg border text-[11px] font-black transition",
                matched.includes(index)
                  ? "border-up/50 bg-up/12 text-up"
                  : open
                    ? "border-gold/50 bg-gold/12 text-gold"
                    : "border-line bg-elevated text-[#5e6673] hover:border-brand/40 hover:text-brand",
              )}
            >
              {open ? (
                <>
                  {symbol}
                  <span className="mt-0.5 text-[8px] font-medium opacity-80">
                    {TICKER_NAMES[symbol]}
                  </span>
                </>
              ) : (
                "?"
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-muted">
        Buka dua kartu. Ticker yang sama akan cocok dan tetap terbuka.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Forex quiz                                                          */
/* ------------------------------------------------------------------ */

export const FOREX_QUESTIONS: QuizQuestion[] = [
  {
    prompt: "USD/IDR bergerak dari 15.800 ke 16.400. Berapa persen rupiah melemah?",
    options: ["2,5%", "3,8%", "4,2%", "6,0%"],
    answer: 1,
    explain: "(16.400 − 15.800) ÷ 15.800 ≈ 3,8%.",
  },
  {
    prompt: "Kamu menukar 2.000 USD ke EUR dengan kurs 1,10 USD per EUR. Berapa EUR?",
    options: ["1.818 EUR", "2.200 EUR", "1.800 EUR", "2.000 EUR"],
    answer: 0,
    explain: "2.000 ÷ 1,10 ≈ 1.818 EUR.",
  },
  {
    prompt: "EUR/USD naik dari 1,080 ke 1,110. Berapa penguatan EUR?",
    options: ["3,0%", "2,78%", "0,03%", "1,11%"],
    answer: 1,
    explain: "(1,110 − 1,080) ÷ 1,080 ≈ 2,78%.",
  },
  {
    prompt:
      "Kurs bid 15.780 dan ask 15.820. Berapa biaya spread dalam basis poin (bp)?",
    options: ["25 bp", "40 bp", "2,5 bp", "250 bp"],
    answer: 0,
    explain: "Spread 40 dibagi harga 15.800 = 0,0025 = 25 bp.",
  },
  {
    prompt: "USD/JPY naik dari 150 ke 153. Apa yang terjadi pada yen?",
    options: [
      "Yen menguat 2%",
      "Yen melemah sekitar 2%",
      "Yen tidak berubah",
      "Yen menguat 3%",
    ],
    answer: 1,
    explain: "Butuh lebih banyak yen untuk satu dolar — yen melemah sekitar 2%.",
  },
  {
    prompt: "Kamu punya 1.000 EUR. Kurs beli bank 1,09 USD per EUR. Berapa USD yang diterima?",
    options: ["909 USD", "1.090 USD", "1.900 USD", "1.009 USD"],
    answer: 1,
    explain: "1.000 × 1,09 = 1.090 USD.",
  },
];
