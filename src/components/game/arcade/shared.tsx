"use client";

import { useState } from "react";
import { cx, Panel } from "../ui";

export interface ArcadeResult {
  score: number;
  total: number;
}

export type Accent = "brand" | "gold" | "up" | "down";

export interface GameMeta {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  tag: string;
  accent: Accent;
  category: "Bisnis" | "Forex" | "Kripto" | "Futures" | "Teknikal" | "Refleks";
}

export const ACCENT_STYLES: Record<Accent, { chip: string; hover: string; icon: string }> = {
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

export function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function makeSeries(
  seed: number,
  count: number,
  from = 100,
  volatility = 0.05,
): number[] {
  const rand = rng(seed);
  const values = [from];
  for (let i = 1; i < count; i += 1) {
    const prev = values[i - 1]!;
    values.push(Math.max(1, prev * (1 + (rand() - 0.5) * 2 * volatility)));
  }
  return values;
}

export const cr = (value: number): string =>
  `Rp ${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

export function Spark({
  values,
  tone = "brand",
  className = "",
  height = 46,
}: {
  values: readonly number[];
  tone?: "brand" | "up" | "down" | "gold";
  className?: string;
  height?: number;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 160;
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
      className={cx("w-full", color, className)}
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

export function OptionButton({
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

export function ResultBanner({
  score,
  total,
  onRetry,
  label = "Skor",
  note,
}: {
  score: number;
  total: number;
  onRetry: () => void;
  label?: string;
  note?: string;
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
        {label} {score.toLocaleString("id-ID")}
        <span className="text-sm font-bold text-muted">
          {total > 0 ? ` / ${total.toLocaleString("id-ID")}` : ""}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {note ??
          (great
            ? "Kerja bagus — insting pasarmu sudah terlatih."
            : "Belum buruk. Coba lagi untuk memperbaiki skor.")}
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

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
}

export function QuizGame({
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
    if (selected === null) return;
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

export function GameFrame({
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
          <span
            className={cx(
              "flex h-10 w-10 items-center justify-center rounded-xl text-lg",
              accent.icon,
            )}
          >
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

export function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "up" | "down" | "gold" | "brand";
}) {
  const color =
    tone === "up"
      ? "text-up"
      : tone === "down"
        ? "text-down"
        : tone === "gold"
          ? "text-gold"
          : tone === "brand"
            ? "text-brand"
            : "text-white";
  return (
    <div className="rounded-lg border border-line bg-elevated p-2 text-center">
      <dt className="text-[9px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className={cx("mt-0.5 text-sm font-black tabular-nums", color)}>{value}</dd>
    </div>
  );
}
