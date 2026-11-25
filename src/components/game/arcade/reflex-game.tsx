"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../ui";
import { ResultBanner, type ArcadeResult } from "./shared";

const REFLEX_ROUNDS = 3;

export function ReactionGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [round, setRound] = useState(0);
  const [position, setPosition] = useState(0);
  const [running, setRunning] = useState(true);
  const [shot, setShot] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const direction = useRef(1);

  useEffect(() => {
    if (!running) return;
    const speed = 1.9 + round * 0.6;
    const id = setInterval(() => {
      setPosition((previous) => {
        let next = previous + direction.current * speed;
        if (next >= 100) {
          next = 100;
          direction.current = -1;
        } else if (next <= 0) {
          next = 0;
          direction.current = 1;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(id);
  }, [running, round]);

  const reset = () => {
    direction.current = 1;
    setRound(0);
    setPosition(0);
    setShot(null);
    setScores([]);
    setFinished(false);
    setRunning(true);
  };

  const total = scores.reduce((sum, value) => sum + value, 0);

  if (finished) {
    return (
      <ResultBanner
        score={total}
        total={REFLEX_ROUNDS * 100}
        onRetry={reset}
        label="Poin"
        note="Eksekusi cepat tanpa rencana hanya menambah biaya. Refleks bagus, tetap butuh aturan."
      />
    );
  }

  const stop = () => {
    if (!running) return;
    setRunning(false);
    const distance = Math.abs(50 - position);
    const points =
      position >= 42 && position <= 58
        ? 100
        : Math.max(0, Math.round(100 - (distance - 8) * 6));
    setShot(points);
    setScores((previous) => [...previous, points]);
  };

  const next = () => {
    if (round + 1 >= REFLEX_ROUNDS) {
      setFinished(true);
      onFinish({ score: total, total: REFLEX_ROUNDS * 100 });
      return;
    }
    setRound((value) => value + 1);
    setPosition(0);
    direction.current = 1;
    setShot(null);
    setRunning(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Ronde <strong className="text-white">{round + 1}</strong>/{REFLEX_ROUNDS}
        </span>
        <span>
          Total: <strong className="text-gold tabular-nums">{total}</strong>
        </span>
      </div>

      <div className="rounded-xl border border-line bg-elevated p-4">
        <div className="relative h-12 overflow-hidden rounded-lg border border-line bg-surface-2">
          <div className="absolute inset-y-0 left-[42%] w-[16%] bg-up/20 ring-1 ring-inset ring-up/40" />
          <div
            className="absolute top-1/2 h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_12px_rgba(240,185,11,0.9)]"
            style={{ left: `${position}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-muted">
          <span>0</span>
          <span>Zona hijau 42–58</span>
          <span>100</span>
        </div>
      </div>

      {shot === null ? (
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
              shot >= 100
                ? "border-up/40 bg-up/12 text-up"
                : shot > 0
                  ? "border-gold/40 bg-gold/12 text-gold"
                  : "border-down/40 bg-down/12 text-down",
            )}
          >
            {shot >= 100 ? "Sempurna! " : shot > 0 ? "Lumayan! " : "Meleset. "}
            Skor {shot}/100
          </div>
          <button
            type="button"
            onClick={next}
            className="w-full rounded-lg border border-line bg-surface-2 py-2 text-xs font-bold text-white transition hover:border-brand/40"
          >
            {round + 1 >= REFLEX_ROUNDS ? "Lihat hasil" : "Ronde berikutnya →"}
          </button>
        </>
      )}

      <p className="text-[10px] leading-relaxed text-muted">
        Penanda bergerak makin cepat tiap ronde. Tekan STOP saat berada di zona hijau.
      </p>
    </div>
  );
}
