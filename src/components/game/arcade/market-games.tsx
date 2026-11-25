"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../ui";
import {
  ResultBanner,
  Spark,
  StatBox,
  cr,
  rng,
  type ArcadeResult,
} from "./shared";

/* ------------------------------------------------------------------ */
/* Arbitrase Kripto — buy the cheapest venue, sell the priciest        */
/* ------------------------------------------------------------------ */

const ARB_ROUNDS = 5;
const ARB_VENUES = ["Alpha", "Beta", "Gamma", "Delta"] as const;

interface ArbRound {
  prices: number[];
  cheapest: number;
  priciest: number;
}

function arbRound(index: number): ArbRound {
  const rand = rng(6100 + index * 137);
  const base = 88_000 + Math.round(rand() * 14_000);
  const prices = ARB_VENUES.map(() => base + Math.round((rand() - 0.5) * base * 0.03));
  let cheapest = 0;
  let priciest = 0;
  prices.forEach((price, position) => {
    if (price < prices[cheapest]!) cheapest = position;
    if (price > prices[priciest]!) priciest = position;
  });
  return { prices, cheapest, priciest };
}

export function ArbitraseGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [round, setRound] = useState(0);
  const [buy, setBuy] = useState<number | null>(null);
  const [sell, setSell] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<{ profit: number; best: number; points: number } | null>(
    null,
  );
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = useMemo(() => arbRound(round), [round]);

  const reset = () => {
    setRound(0);
    setBuy(null);
    setSell(null);
    setOutcome(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <ResultBanner
        score={score}
        total={ARB_ROUNDS * 20}
        onRetry={reset}
        label="Poin"
        note="Arbitrase hanya menguntungkan bila selisih harga melebihi biaya transfer dan biaya transaksi."
      />
    );
  }

  const execute = () => {
    if (buy === null || sell === null) return;
    const profit = current.prices[sell]! - current.prices[buy]!;
    const best = current.prices[current.priciest]! - current.prices[current.cheapest]!;
    const points = best > 0 ? Math.max(0, Math.round((profit / best) * 20)) : 0;
    setOutcome({ profit, best, points });
    setScore((value) => value + points);
  };

  const next = () => {
    if (round + 1 >= ARB_ROUNDS) {
      setFinished(true);
      onFinish({ score, total: ARB_ROUNDS * 20 });
      return;
    }
    setRound((value) => value + 1);
    setBuy(null);
    setSell(null);
    setOutcome(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Ronde <strong className="text-white">{round + 1}</strong>/{ARB_ROUNDS}
        </span>
        <span>
          Poin: <strong className="text-gold tabular-nums">{score}</strong>
        </span>
      </div>

      <p className="rounded-lg border border-line bg-elevated px-3 py-2 text-[11px] text-muted">
        Satu BTC dijual di empat bursa. Pilih bursa termurah untuk <b className="text-up">membeli</b>,
        lalu bursa termahal untuk <b className="text-down">menjual</b>.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {ARB_VENUES.map((venue, index) => {
          const isBuy = buy === index;
          const isSell = sell === index;
          return (
            <div
              key={venue}
              className={cx(
                "rounded-xl border p-2.5 transition",
                isBuy
                  ? "border-up/60 bg-up/10"
                  : isSell
                    ? "border-down/60 bg-down/10"
                    : "border-line bg-elevated",
              )}
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
                <span>Bursa {venue}</span>
                {isBuy ? <span className="font-bold text-up">Beli</span> : null}
                {isSell ? <span className="font-bold text-down">Jual</span> : null}
              </div>
              <div className="mt-0.5 text-sm font-black tabular-nums text-white">
                {cr(current.prices[index]!)}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  disabled={outcome !== null || buy === index}
                  onClick={() => setBuy(index)}
                  className="rounded border border-line bg-surface py-1 text-[10px] font-bold text-[#c7ccd4] transition hover:border-up/50 hover:text-up disabled:opacity-40"
                >
                  Beli
                </button>
                <button
                  type="button"
                  disabled={outcome !== null || sell === index}
                  onClick={() => setSell(index)}
                  className="rounded border border-line bg-surface py-1 text-[10px] font-bold text-[#c7ccd4] transition hover:border-down/50 hover:text-down disabled:opacity-40"
                >
                  Jual
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {outcome ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatBox
              label="Laba per BTC"
              value={cr(outcome.profit)}
              tone={outcome.profit > 0 ? "up" : "down"}
            />
            <StatBox label="Poin ronde" value={`${outcome.points}/20`} tone="gold" />
          </div>
          <p className="rounded-lg border border-line bg-elevated px-3 py-2 text-[11px] text-muted">
            Peluang terbaik: beli di {ARB_VENUES[current.cheapest]} dan jual di{" "}
            {ARB_VENUES[current.priciest]} untuk selisih {cr(outcome.best)}.
          </p>
          <button
            type="button"
            onClick={next}
            className="w-full rounded-lg bg-brand py-2.5 text-xs font-black text-[#04120e] transition hover:bg-brand-strong"
          >
            {round + 1 >= ARB_ROUNDS ? "Lihat hasil" : "Ronde berikutnya →"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={execute}
          disabled={buy === null || sell === null}
          className="w-full rounded-lg bg-brand py-2.5 text-xs font-black text-[#04120e] transition hover:bg-brand-strong disabled:opacity-40"
        >
          {buy === null || sell === null
            ? "Pilih bursa beli dan jual"
            : `Eksekusi: beli ${ARB_VENUES[buy]} → jual ${ARB_VENUES[sell]}`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scalper Kripto — buy the dip, sell the rip within 20 seconds        */
/* ------------------------------------------------------------------ */

const SCALP_SECONDS = 20;
const BUY_ZONE = 98.5;
const SELL_ZONE = 101.5;

export function ScalperGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const [market, setMarket] = useState<{ price: number; history: number[] }>({
    price: 100,
    history: [100],
  });
  const [timeLeft, setTimeLeft] = useState(SCALP_SECONDS);
  const deadline = useRef(0);
  const price = market.price;
  const history = market.history;
  const [holding, setHolding] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [trades, setTrades] = useState(0);
  const [phase, setPhase] = useState<"PLAY" | "DONE">("PLAY");
  const reported = useRef(false);

  useEffect(() => {
    if (phase !== "PLAY") return;
    const id = setInterval(() => {
      setMarket((previous) => {
        const drift = (100 - previous.price) * 0.07 + (Math.random() - 0.5) * 2.6;
        const next = Math.max(80, Math.min(120, previous.price + drift));
        return { price: next, history: [...previous.history.slice(-59), next] };
      });
    }, 170);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "PLAY") return;
    deadline.current = Date.now() + SCALP_SECONDS * 1_000;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1_000),
      );
      setTimeLeft(remaining);
      if (remaining === 0) setPhase("DONE");
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "PLAY" || reported.current) return;
    reported.current = true;
    onFinish({ score, total: 10 });
  }, [phase, score, onFinish]);

  const reset = () => {
    setMarket({ price: 100, history: [100] });
    setTimeLeft(SCALP_SECONDS);
    setHolding(null);
    setScore(0);
    setTrades(0);
    reported.current = false;
    setPhase("PLAY");
  };

  if (phase === "DONE") {
    return (
      <ResultBanner
        score={score}
        total={10}
        onRetry={reset}
        label="Poin"
        note={`${trades} transaksi dalam ${SCALP_SECONDS} detik. Scalping menuntut disiplin keluar, bukan hanya entry yang bagus.`}
      />
    );
  }

  const action = (side: "BUY" | "SELL") => {
    if (phase !== "PLAY") return;
    if (side === "BUY") {
      if (holding !== null || price > BUY_ZONE) {
        setScore((value) => Math.max(0, value - 1));
        return;
      }
      setHolding(price);
      setTrades((value) => value + 1);
      return;
    }
    if (holding === null || price < SELL_ZONE) {
      setScore((value) => Math.max(0, value - 1));
      return;
    }
    setScore((value) => value + Math.max(1, Math.round((price - holding) * 2)));
    setHolding(null);
    setTrades((value) => value + 1);
  };

  const inBuyZone = price <= BUY_ZONE;
  const inSellZone = price >= SELL_ZONE;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Waktu <strong className={timeLeft <= 5 ? "text-down" : "text-white"}>{timeLeft}s</strong>
        </span>
        <span>
          Poin: <strong className="text-gold tabular-nums">{score}</strong>
        </span>
      </div>

      <div className="rounded-xl border border-line bg-elevated p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted">BTC / IDR</span>
          <span
            className={cx(
              "text-xl font-black tabular-nums",
              inSellZone ? "text-up" : inBuyZone ? "text-down" : "text-white",
            )}
          >
            {price.toFixed(2)}
          </span>
        </div>
        <Spark
          values={history}
          tone={inSellZone ? "up" : inBuyZone ? "down" : "brand"}
          className="mt-1 h-16"
          height={64}
        />
        <div className="flex justify-between text-[9px] text-muted">
          <span className={cx(inBuyZone && "font-bold text-down")}>Zona beli ≤ {BUY_ZONE}</span>
          <span className={cx(inSellZone && "font-bold text-up")}>Zona jual ≥ {SELL_ZONE}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => action("BUY")}
          className="rounded-lg bg-up py-3 text-xs font-black text-white transition hover:brightness-110"
        >
          BELI {holding !== null ? `@ ${holding.toFixed(2)}` : ""}
        </button>
        <button
          type="button"
          onClick={() => action("SELL")}
          className="rounded-lg bg-down py-3 text-xs font-black text-white transition hover:brightness-110"
        >
          JUAL
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-muted">
        Beli hanya saat harga di zona bawah, jual hanya di zona atas. Tekan di luar zona
        atau dobel posisi akan mengurangi poin. Satu unit per transaksi.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Leverage Survival — pick leverage, then survive 10 candles          */
/* ------------------------------------------------------------------ */

const LEV_MOVES = 10;
const LEV_START = 1_000;
const LEV_OPTIONS = [2, 5, 10, 20] as const;

export function LeverageGame({ onFinish }: { onFinish: (result: ArcadeResult) => void }) {
  const moves = useMemo(() => {
    const rand = rng(4242);
    return Array.from({ length: LEV_MOVES }, () => (rand() * 2 - 1) * 0.07);
  }, []);
  const [leverage, setLeverage] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [equity, setEquity] = useState(LEV_START);
  const [closed, setClosed] = useState(false);
  const [liquidated, setLiquidated] = useState(false);
  const [lastMove, setLastMove] = useState<number | null>(null);

  const reset = () => {
    setLeverage(null);
    setIndex(0);
    setEquity(LEV_START);
    setClosed(false);
    setLiquidated(false);
    setLastMove(null);
  };

  const finish = (value: number, blownUp: boolean) => {
    setEquity(value);
    setClosed(true);
    setLiquidated(blownUp);
    onFinish({ score: Math.max(0, Math.round(value)), total: LEV_START });
  };

  if (closed) {
    return (
      <ResultBanner
        score={Math.max(0, Math.round(equity))}
        total={LEV_START}
        onRetry={reset}
        label="Ekuitas"
        note={
          liquidated
            ? `Modal Rp ${LEV_START} habis oleh likuidasi di leverage ${leverage}x. Semakin tinggi leverage, semakin sempit ruang bernapas.`
            : `Kamu menutup posisi ${leverage}x dengan ekuitas ${cr(Math.round(equity))}. Disiplin keluar menyelamatkan modal.`
        }
      />
    );
  }

  if (leverage === null) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-line bg-elevated px-3 py-2 text-[11px] text-muted">
          Modal {cr(LEV_START)}. Pilih leverage, lalu putuskan tiap candle: tahan atau
          tutup. Pergerakan melawan sebesar 1/leverage menghabiskan margin.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {LEV_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLeverage(option)}
              className="rounded-xl border border-line bg-elevated p-3 text-left transition hover:border-brand/50"
            >
              <span className="block text-lg font-black text-white">{option}x</span>
              <span className="mt-0.5 block text-[10px] text-muted">
                likuidasi pada {(100 / option).toFixed(1)}% pergerakan melawan
              </span>
            </button>
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-muted">
          Hadiah leverage tinggi besar, tetapi satu candle buruk bisa mengakhiri permainan.
        </p>
      </div>
    );
  }

  const positionExposure = equity * leverage;
  const progress = Math.min(100, (index / LEV_MOVES) * 100);

  const hold = () => {
    const move = moves[index]!;
    const next = equity * (1 + leverage * move);
    setLastMove(move);
    if (next <= 0) {
      finish(0, true);
      return;
    }
    if (index + 1 >= LEV_MOVES) {
      setEquity(next);
      finish(next, false);
      return;
    }
    setEquity(next);
    setIndex((value) => value + 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          Candle <strong className="text-white">{Math.min(index + 1, LEV_MOVES)}</strong>/
          {LEV_MOVES} · {leverage}x
        </span>
        <span>
          Ekuitas{" "}
          <strong className={equity >= LEV_START ? "text-up" : "text-down"}>
            {cr(Math.round(equity))}
          </strong>
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="rounded-xl border border-line bg-elevated p-3 text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted">Pergerakan candle</div>
        <div
          className={cx(
            "mt-1 text-2xl font-black tabular-nums",
            lastMove === null ? "text-white" : lastMove >= 0 ? "text-up" : "text-down",
          )}
        >
          {lastMove === null
            ? "—"
            : `${lastMove >= 0 ? "+" : ""}${(lastMove * 100).toFixed(1)}%`}
        </div>
        <div className="mt-1 text-[10px] text-muted">
          Eksposur posisi {cr(Math.round(positionExposure))} · likuidasi pada{" "}
          {cr(Math.round(equity * (1 - 1 / leverage)))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={hold}
          className="rounded-lg bg-up py-2.5 text-xs font-black text-white transition hover:brightness-110"
        >
          Tahan candle
        </button>
        <button
          type="button"
          onClick={() => finish(equity, false)}
          className="rounded-lg border border-line bg-surface-2 py-2.5 text-xs font-bold text-white transition hover:border-down/50 hover:text-down"
        >
          Tutup posisi
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-muted">
        Menutup posisi mengunci ekuitas sekarang. Menahan memberi peluang, tetapi
        pergerakan melawan yang cukup besar akan melikuidasi margin.
      </p>
    </div>
  );
}
