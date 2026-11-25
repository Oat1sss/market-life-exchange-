"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  profileFor,
  liveStep,
  seededRandom,
  smoothNoise,
  type ChartProfile,
} from "@/domain/market/chart-profile";
import {
  accentHue,
  applyLiveSample,
  buildCandles,
  movingAverage,
  type Candle,
  type CandlePoint,
} from "@/domain/market/candles";

const FRAMES = [
  { key: "1T", group: 1 },
  { key: "3T", group: 3 },
  { key: "7T", group: 7 },
  { key: "15T", group: 15 },
] as const;

type FrameKey = (typeof FRAMES)[number]["key"];
type ChartMode = "CANDLE" | "AREA";

/** Jumlah candle yang tampil; makin sedikit, makin besar (zoom in). */
const ZOOM_LEVELS: readonly number[] = [60, 90, 120, 160, 220, 300, 400];
const DEFAULT_ZOOM = 3;

const W = 900;
const H = 430;
const PAD = { top: 16, right: 82, bottom: 26, left: 12 };
const CHART_H = 272;
const VOL_TOP = 312;
const VOL_H = 78;

/** Cap on client-side live candles kept in memory. */
const MAX_LIVE_CANDLES = 48;
/** Max drift of the live tape away from the last stored tick (6%). */
const MAX_DRIFT = 0.06;
const LIVE_INTERVAL_MS = 1100;

function formatPrice(value: number): string {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: value < 10 ? 4 : 2,
    maximumFractionDigits: value < 10 ? 4 : 2,
  });
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

/**
 * Candle riwayat sebelum tick pertama yang tersimpan. Chart exchange selalu
 * punya riwayat panjang; bila data game masih pendek, candle awal disintesis
 * deterministik dari profil aset supaya kepadatan chart tetap konsisten.
 *
 * Riwayat dibuat seperti pasar sungguhan: tren beberapa candle, volatilitas
 * yang mengelompok, sesekali candle ekstrem, lalu ditarik perlahan kembali ke
 * harga acuan agar tidak melenceng terlalu jauh.
 */
function seedHistory(first: Candle, count: number, profile: ChartProfile): Candle[] {
  if (count <= 0) return [];

  // Always generate the full window, then keep the newest `count` candles.
  // The tail stays stable as live candles accumulate, so the history does not
  // visibly shift every time a new live candle is appended.
  const total = Math.max(count, 400);
  const baseVol = profile.historyVolatility;
  const rand = seededRandom(profile.seed ^ 0x27d4eb2d);
  const levels: number[] = [1];
  let level = 1;
  let vol = baseVol;
  let momentum = 0;

  for (let i = 0; i < total; i += 1) {
    // GARCH-style volatility: shocks raise it, then it decays toward base.
    const shock = rand() * 2 - 1;
    vol = Math.min(
      baseVol * 2.6,
      Math.max(
        baseVol * 0.45,
        vol * 0.88 + baseVol * 0.12 + Math.abs(shock) * baseVol * 0.22,
      ),
    );

    // Slow trend regimes, a shared market pulse (alts follow the same rhythm),
    // occasional fat-tail candle, and a gentle pull back to the anchor so a
    // long history stays readable instead of drifting into a 50× range.
    const regime =
      smoothNoise(profile.seed ^ 0x51ed270b, i / 24) * baseVol * 0.45;
    const market =
      smoothNoise(0x51ed270b, i / 32) * profile.marketBeta * baseVol * 0.35;
    const jump =
      rand() < profile.jumpChance
        ? (rand() * 2 - 1) * profile.jumpScale * vol
        : 0;
    momentum = Math.min(
      baseVol * 2.5,
      Math.max(
        -baseVol * 2.5,
        momentum * 0.7 + regime + market + shock * vol * 0.7 + jump,
      ),
    );
    const pull = (1 - level) * 0.06;
    const move = Math.min(0.2, Math.max(-0.2, momentum + pull));
    level = Math.min(2, Math.max(0.5, level * (1 + move)));
    levels.push(level);
  }

  const scale = first.open / levels[levels.length - 1]!;
  const out: Candle[] = [];

  for (let i = 0; i < total; i += 1) {
    const open = levels[i]! * scale;
    const close = levels[i + 1]! * scale;
    const candleRand = seededRandom(
      profile.seed ^ Math.imul(i + 1, 0x27d4eb2d),
    );
    const body = Math.abs(close - open);
    const span = Math.max(body, close * baseVol * 0.35);
    const high =
      Math.max(open, close) + span * profile.wick * (0.15 + candleRand() * 0.6);
    const low = Math.max(
      0.01,
      Math.min(open, close) - span * profile.wick * (0.15 + candleRand() * 0.6),
    );
    const moveRatio = body / Math.max(close * baseVol, 1e-9);
    const volume =
      profile.volume *
      (450 + Math.min(moveRatio, 4) * 300 + candleRand() * 800);

    out.push({
      tick: first.tick - total + i,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return out.slice(-count);
}

function pathFrom(
  values: Array<number | null>,
  x: (i: number) => number,
  y: (v: number) => number,
) {
  const segments: string[] = [];
  values.forEach((value, index) => {
    if (value === null) return;
    segments.push(
      `${segments.length === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(value).toFixed(2)}`,
    );
  });
  return segments.join(" ");
}

export interface RealtimeCandleChartProps {
  readonly points: readonly CandlePoint[];
  readonly symbol: string;
  readonly name?: string;
  readonly kind: "CRYPTO" | "STOCK";
}

export function RealtimeCandleChart(props: RealtimeCandleChartProps) {
  const [frame, setFrame] = useState<FrameKey>(props.kind === "CRYPTO" ? "3T" : "7T");
  const group = FRAMES.find((item) => item.key === frame)!.group;
  const anchor = lastPrice(props.points);

  // Remounting the body on symbol/frame/stored-price changes resets the live
  // tape without a state-syncing effect.
  return (
    <RealtimeChartBody
      key={`${props.symbol}:${group}:${anchor}`}
      {...props}
      frame={frame}
      group={group}
      anchor={anchor}
      onFrameChange={setFrame}
    />
  );
}

function lastPrice(points: readonly CandlePoint[]): number {
  let lastTick = -Infinity;
  let priceMinor = 0n;
  for (const point of points) {
    if (point.tick >= lastTick) {
      lastTick = point.tick;
      priceMinor = point.priceMinor;
    }
  }
  return Number(priceMinor) / 100;
}

function RealtimeChartBody({
  points,
  symbol,
  name,
  kind,
  frame,
  group,
  anchor,
  onFrameChange,
}: RealtimeCandleChartProps & {
  readonly frame: FrameKey;
  readonly group: number;
  readonly anchor: number;
  readonly onFrameChange: (frame: FrameKey) => void;
}) {
  const [mode, setMode] = useState<ChartMode>("CANDLE");
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [showMa, setShowMa] = useState(true);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [liveCandles, setLiveCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(
    anchor > 0 ? anchor : null,
  );

  const priceRef = useRef<number | null>(anchor > 0 ? anchor : null);
  const momentumRef = useRef(0);
  const stepRef = useRef(0);
  const realFeedRef = useRef(false);
  const [quoteCurrency, setQuoteCurrency] = useState<"IDR" | "USD" | "EUR" | "JPY" | "SGD">("IDR");

  // Stream real-world Binance klines + WebSocket for crypto pairs
  useEffect(() => {
    if (kind !== "CRYPTO" || paused) return;
    const pair = `${symbol.toUpperCase()}USDT`;
    let cancelled = false;
    let ws: WebSocket | null = null;
    realFeedRef.current = false;
    setLiveCandles([]);
    setLivePrice(null);
    const defaultRates: Record<string, number> = {
      IDR: 16_200,
      USD: 1,
      EUR: 0.92,
      JPY: 154,
      SGD: 1.34,
    };
    let fxRate = defaultRates[quoteCurrency] ?? 1;

    async function initRealFeed() {
      try {
        const [fxRes, klineRes] = await Promise.all([
          quoteCurrency === "USD"
            ? Promise.resolve(null)
            : fetch(`https://api.frankfurter.app/latest?from=USD&to=${quoteCurrency}`).catch(() => null),
          fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&limit=120`),
        ]);
        if (!klineRes.ok || cancelled) return;
        if (fxRes?.ok) {
          const fx = (await fxRes.json()) as { rates?: Record<string, number> };
          if (fx.rates?.[quoteCurrency]) fxRate = fx.rates[quoteCurrency]!;
        }
        const raw = (await klineRes.json()) as Array<
          [number, string, string, string, string, string]
        >;
        if (!Array.isArray(raw) || raw.length === 0 || cancelled) return;

        const mapped: Candle[] = raw.map((k, idx) => ({
          tick: idx + 1,
          open: Number(k[1]) * fxRate,
          high: Number(k[2]) * fxRate,
          low: Number(k[3]) * fxRate,
          close: Number(k[4]) * fxRate,
          volume: Number(k[5]),
          live: idx === raw.length - 1,
        }));

        realFeedRef.current = true;
        setLiveCandles(mapped);
        setLivePrice(mapped[mapped.length - 1]!.close);

        ws = new WebSocket(
          `wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_1m`,
        );
        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(event.data as string) as {
              k?: { o: string; h: string; l: string; c: string; v: string };
            };
            if (!msg.k) return;
            const close = Number(msg.k.c) * fxRate;
            const high = Number(msg.k.h) * fxRate;
            const low = Number(msg.k.l) * fxRate;
            const open = Number(msg.k.o) * fxRate;
            const volume = Number(msg.k.v);
            setLivePrice(close);
            setLiveCandles((prev) => {
              if (prev.length === 0) return prev;
              const next = [...prev];
              next[next.length - 1] = {
                ...next[next.length - 1]!,
                open,
                high: Math.max(next[next.length - 1]!.high, high),
                low: Math.min(next[next.length - 1]!.low, low),
                close,
                volume,
                live: true,
              };
              return next;
            });
          } catch {
            // ignore malformed frames
          }
        };
      } catch {
        // Fallback to simulated tape if offline or unsupported pair
      }
    }

    initRealFeed();
    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [kind, symbol, paused, quoteCurrency]);

  const profile = useMemo(() => profileFor(symbol, kind), [symbol, kind]);
  const hue = useMemo(() => accentHue(symbol), [symbol]);

  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => a.tick - b.tick),
    [points],
  );

  const baseCandles = useMemo(
    () => buildCandles(sortedPoints, symbol, group, profile),
    [sortedPoints, symbol, group, profile],
  );

  // The live tape: deterministic per-symbol steps shaped by its profile.
  useEffect(() => {
    if (paused || anchor <= 0) return;
    const timer = setInterval(() => {
      if (realFeedRef.current) return;
      const current = priceRef.current ?? anchor;
      const step = stepRef.current;
      const next = liveStep(profile, current, momentumRef.current, step);
      const clamped = Math.min(
        anchor * (1 + MAX_DRIFT),
        Math.max(anchor * (1 - MAX_DRIFT), next.price),
      );
      priceRef.current = clamped;
      momentumRef.current = next.momentum;
      stepRef.current = step + 1;
      setLivePrice(clamped);
      setLiveCandles((previous) => {
        const grown = applyLiveSample(previous, clamped, profile, step + 1);
        return grown.length > MAX_LIVE_CANDLES
          ? grown.slice(-MAX_LIVE_CANDLES)
          : grown;
      });
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, anchor, profile]);

  if (anchor <= 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-[#2b313a] bg-[#181a20] px-6 text-center text-sm text-[#848e9c]">
        Belum ada data harga untuk {symbol}. Majukan pasar satu kali untuk membentuk candle.
      </div>
    );
  }

  const visibleCount = ZOOM_LEVELS[zoom] ?? 160;
  const combined = baseCandles.concat(liveCandles);
  const history =
    combined.length < visibleCount
      ? seedHistory(combined[0]!, visibleCount - combined.length, profile)
      : [];
  const visible = history.concat(combined).slice(-visibleCount);
  const ma5 = movingAverage(visible, 5);
  const ma20 = movingAverage(visible, 20);

  const max = Math.max(...visible.map((candle) => candle.high));
  const min = Math.min(...visible.map((candle) => candle.low));
  const range = max - min || max * 0.02 || 1;
  const maxVol = Math.max(...visible.map((candle) => candle.volume), 1);

  const innerW = W - PAD.left - PAD.right;
  const slot = innerW / visible.length;
  // Candle dibuat rapat: body mengisi hampir seluruh slot, hanya sisa tipis
  // sebagai pemisah agar tetap terbaca saat di-zoom out. Batas atas menjaga
  // candle tidak menjadi balok raksasa saat data masih sedikit.
  const bodyW = Math.max(1.5, Math.min(24, slot * 0.88));

  const y = (price: number) =>
    PAD.top + ((max + range * 0.06 - price) / (range * 1.12)) * CHART_H;
  const volY = (volume: number) => VOL_TOP + VOL_H - (volume / maxVol) * VOL_H;
  const xAt = (index: number) => PAD.left + slot * index + slot / 2;

  const hovered = hover !== null ? visible[hover] : undefined;
  const active = hovered ?? visible[visible.length - 1]!;
  const activeIndex = hovered ? hover! : visible.length - 1;
  const prevClose = visible[Math.max(0, activeIndex - 1)]!.close;
  const changePct =
    prevClose > 0 ? ((active.close - prevClose) / prevClose) * 100 : 0;
  const up = active.close >= active.open;

  const currentPrice = livePrice ?? active.close;
  const currentUp = currentPrice >= prevClose;

  const gridPrices = [0, 0.25, 0.5, 0.75, 1].map((ratio) => max - range * ratio);
  const linePath = pathFrom(ma5, xAt, y);
  const linePath20 = pathFrom(ma20, xAt, y);

  const closePath = visible
    .map(
      (candle, index) =>
        `${index === 0 ? "M" : "L"}${xAt(index).toFixed(2)},${y(candle.close).toFixed(2)}`,
    )
    .join(" ");
  const areaPath = closePath.concat(
    ` L${xAt(visible.length - 1).toFixed(2)},${PAD.top + CHART_H} L${xAt(0).toFixed(2)},${PAD.top + CHART_H} Z`,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#2b313a] bg-[#181a20] text-[#eaecef] shadow-2xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2b313a] px-3 py-2">
        <div className="flex overflow-hidden rounded-md border border-[#2b313a]">
          {FRAMES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onFrameChange(item.key);
                setHover(null);
              }}
              title={`Agregasi ${item.group} tick`}
              className={`px-2.5 py-1 text-[11px] font-bold transition ${
                item.key === frame
                  ? "bg-[#2b313a] text-[#f0b90b]"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              {item.key}
            </button>
          ))}
        </div>

        <div className="flex overflow-hidden rounded-md border border-[#2b313a]">
          <button
            type="button"
            onClick={() => setMode("CANDLE")}
            className={`px-2.5 py-1 text-[11px] font-bold transition ${
              mode === "CANDLE"
                ? "bg-[#2b313a] text-white"
                : "text-[#848e9c] hover:text-white"
            }`}
          >
            🕯️ Candle
          </button>
          <button
            type="button"
            onClick={() => setMode("AREA")}
            className={`px-2.5 py-1 text-[11px] font-bold transition ${
              mode === "AREA"
                ? "bg-[#2b313a] text-white"
                : "text-[#848e9c] hover:text-white"
            }`}
          >
            Area
          </button>
        </div>

        <div className="flex items-center overflow-hidden rounded-md border border-[#2b313a]">
          <button
            type="button"
            onClick={() => {
              setZoom((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1));
              setHover(null);
            }}
            disabled={zoom >= ZOOM_LEVELS.length - 1}
            aria-label="Perkecil chart (tampilkan lebih banyak candle)"
            title="Perkecil — tampilkan lebih banyak candle"
            className="px-2.5 py-1 text-xs font-bold text-[#848e9c] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(DEFAULT_ZOOM);
              setHover(null);
            }}
            title={`Reset zoom — ${visibleCount} candle tampil (gaya exchange)`}
            className="border-x border-[#2b313a] px-2 py-1 text-[10px] font-bold tabular-nums text-[#eaecef] transition hover:text-[#f0b90b]"
          >
            {visibleCount}c
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom((value) => Math.max(0, value - 1));
              setHover(null);
            }}
            disabled={zoom <= 0}
            aria-label="Perbesar chart (perbesar candle)"
            title="Perbesar — candle lebih besar"
            className="px-2.5 py-1 text-xs font-bold text-[#848e9c] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowMa((value) => !value)}
          className={`rounded border px-2 py-1 text-[10px] font-bold transition ${
            showMa
              ? "border-[#f0b90b]/40 bg-[#f0b90b]/10 text-[#f0b90b]"
              : "border-[#2b313a] text-[#848e9c]"
          }`}
        >
          MA 5/20
        </button>

        {kind === "CRYPTO" ? (
          <select
            aria-label="Pilih mata uang chart"
            value={quoteCurrency}
            onChange={(e) =>
              setQuoteCurrency(e.target.value as "IDR" | "USD" | "EUR" | "JPY" | "SGD")
            }
            className="rounded border border-[#2b313a] bg-[#0b0e11] px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-[#f0b90b]/60"
          >
            <option value="IDR">{symbol}/IDR</option>
            <option value="USD">{symbol}/USD</option>
            <option value="EUR">{symbol}/EUR</option>
            <option value="JPY">{symbol}/JPY</option>
            <option value="SGD">{symbol}/SGD</option>
          </select>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={{
              color: `hsl(${hue} 75% 62%)`,
              backgroundColor: `hsl(${hue} 75% 62% / 0.12)`,
            }}
            title="Karakter pergerakan aset ini"
          >
            {profile.archetype}
          </span>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold transition ${
              paused
                ? "border-[#f0b90b]/40 bg-[#f0b90b]/10 text-[#f0b90b]"
                : "border-[#0ecb81]/40 bg-[#0ecb81]/10 text-[#0ecb81]"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {!paused ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0ecb81] opacity-75" />
              ) : null}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  paused ? "bg-[#f0b90b]" : "bg-[#0ecb81]"
                }`}
              />
            </span>
            {paused ? "TERPAUSE" : "LIVE"}
          </button>
        </div>
      </div>

      {/* Symbol header + OHLC readout */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">{symbol}/IDR</span>
            {name ? <span className="text-xs text-[#848e9c]">{name}</span> : null}
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                kind === "CRYPTO"
                  ? "bg-[#f0b90b]/15 text-[#f0b90b]"
                  : "bg-[#6f8dff]/15 text-[#6f8dff]"
              }`}
            >
              {kind === "CRYPTO" ? "Kripto" : "Saham"}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span
              className={`text-2xl font-black tabular-nums ${
                currentUp ? "text-[#0ecb81]" : "text-[#f6465d]"
              }`}
            >
              {formatPrice(currentPrice)}
            </span>
            <span
              className={`text-xs font-bold tabular-nums ${
                changePct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"
              }`}
            >
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] text-[#848e9c] sm:grid-cols-5">
          <div>
            <dt>Open</dt>
            <dd className="font-semibold tabular-nums text-[#eaecef]">
              {formatPrice(active.open)}
            </dd>
          </div>
          <div>
            <dt>High</dt>
            <dd className="font-semibold tabular-nums text-[#0ecb81]">
              {formatPrice(active.high)}
            </dd>
          </div>
          <div>
            <dt>Low</dt>
            <dd className="font-semibold tabular-nums text-[#f6465d]">
              {formatPrice(active.low)}
            </dd>
          </div>
          <div>
            <dt>Close</dt>
            <dd
              className={`font-semibold tabular-nums ${
                up ? "text-[#0ecb81]" : "text-[#f6465d]"
              }`}
            >
              {formatPrice(active.close)}
            </dd>
          </div>
          <div>
            <dt>Vol</dt>
            <dd className="font-semibold tabular-nums text-[#eaecef]">
              {formatVolume(active.volume)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Chart */}
      <div className="relative px-1 pb-1">
        <div
          className="pointer-events-none absolute left-6 top-3 select-none text-5xl font-black tracking-wider"
          style={{ color: `hsl(${hue} 70% 55% / 0.08)` }}
        >
          {symbol}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full select-none"
          role="img"
          aria-label={`Grafik candlestick realtime ${symbol}, ${visible.length} candle terakhir`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            const index = Math.floor((ratio * W - PAD.left) / slot);
            setHover(index >= 0 && index < visible.length ? index : null);
          }}
        >
          <defs>
            <linearGradient id={`area-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`hsl(${hue} 75% 55%)`} stopOpacity="0.32" />
              <stop offset="70%" stopColor={`hsl(${hue} 75% 55%)`} stopOpacity="0.06" />
              <stop offset="100%" stopColor={`hsl(${hue} 75% 55%)`} stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridPrices.map((price) => (
            <g key={price}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(price)}
                y2={y(price)}
                stroke="#232830"
                strokeDasharray="3 4"
              />
              <text
                x={W - PAD.right + 6}
                y={y(price) + 3}
                fill="#848e9c"
                fontSize="9"
                className="tabular-nums"
              >
                {formatPrice(price)}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={VOL_TOP - 10}
            y2={VOL_TOP - 10}
            stroke="#232830"
          />

          {mode === "AREA" ? (
            <>
              <path d={areaPath} fill={`url(#area-${symbol})`} />
              <path
                d={closePath}
                fill="none"
                stroke={`hsl(${hue} 75% 58%)`}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </>
          ) : (
            visible.map((candle, index) => {
              const green = candle.close >= candle.open;
              const color = green ? "#0ecb81" : "#f6465d";
              const px = xAt(index);
              const top = y(Math.max(candle.open, candle.close));
              const bottom = y(Math.min(candle.open, candle.close));
              const dim = hover !== null && hover !== index;
              return (
                <g key={`${candle.tick}-${index}`} opacity={dim ? 0.55 : 1}>
                  <line
                    x1={px}
                    x2={px}
                    y1={y(candle.high)}
                    y2={y(candle.low)}
                    stroke={color}
                    strokeWidth="1.1"
                  />
                  <rect
                    x={px - bodyW / 2}
                    y={top}
                    width={bodyW}
                    height={Math.max(1, bottom - top)}
                    fill={color}
                    rx={slot < 4 ? 0 : 1}
                  />
                </g>
              );
            })
          )}

          {visible.map((candle, index) => {
            const green = candle.close >= candle.open;
            const px = xAt(index);
            return (
              <rect
                key={`vol-${candle.tick}-${index}`}
                x={px - bodyW / 2}
                y={volY(candle.volume)}
                width={bodyW}
                height={VOL_TOP + VOL_H - volY(candle.volume)}
                fill={green ? "#0ecb8155" : "#f6465d55"}
                opacity={hover !== null && hover !== index ? 0.5 : 1}
              />
            );
          })}

          {showMa ? (
            <>
              <path d={linePath20} fill="none" stroke="#6f8dff" strokeWidth="1.2" opacity="0.85" />
              <path d={linePath} fill="none" stroke="#f0b90b" strokeWidth="1.2" opacity="0.95" />
            </>
          ) : null}

          {/* Latest price line + marker */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(currentPrice)}
            y2={y(currentPrice)}
            stroke={currentUp ? "#0ecb81" : "#f6465d"}
            strokeDasharray="2 3"
            opacity="0.8"
          />
          <rect
            x={W - PAD.right + 1}
            y={y(currentPrice) - 8}
            width={PAD.right - 6}
            height="16"
            rx="3"
            fill={currentUp ? "#0ecb81" : "#f6465d"}
          />
          <text
            x={W - PAD.right / 2}
            y={y(currentPrice) + 3}
            fill="#0b0e11"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            className="tabular-nums"
          >
            {formatPrice(currentPrice)}
          </text>

          {mode === "CANDLE" ? (
            <circle
              cx={xAt(visible.length - 1)}
              cy={y(currentPrice)}
              r="3.5"
              fill={currentUp ? "#0ecb81" : "#f6465d"}
              stroke="#181a20"
              strokeWidth="1.5"
            />
          ) : null}

          {hover !== null && visible[hover] ? (
            <g>
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={PAD.top}
                y2={VOL_TOP + VOL_H}
                stroke="#848e9c"
                strokeDasharray="3 3"
              />
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(visible[hover]!.close)}
                y2={y(visible[hover]!.close)}
                stroke="#848e9c"
                strokeDasharray="3 3"
              />
            </g>
          ) : null}

          <g className="fill-[#5e6673]" fontSize="9">
            <text x={PAD.left} y={H - 6} textAnchor="start">
              {visible[0]!.live
                ? "Live"
                : visible[0]!.tick < 0
                  ? "Histori"
                  : `Tick ${visible[0]!.tick}`}
            </text>
            <text x={PAD.left + innerW / 2} y={H - 6} textAnchor="middle">
              {showMa ? "MA5 kuning · MA20 biru" : `${visible.length} candle terakhir`}
            </text>
            <text x={W - PAD.right} y={H - 6} textAnchor="end">
              {visible[visible.length - 1]!.live
                ? "Live"
                : `Tick ${visible[visible.length - 1]!.tick}`}
            </text>
          </g>
        </svg>
      </div>

      <p className="border-t border-[#2b313a] px-4 py-2 text-[10px] leading-relaxed text-[#5e6673]">
        Candle historis dibentuk dari tick pasar demo; bila riwayat tick belum
        cukup, candle awal disintesis agar kepadatan chart konsisten. Tape LIVE
        diperbarui tiap {LIVE_INTERVAL_MS / 1000}s dengan karakter volatilitas
        khusus {symbol} ({profile.archetype.toLowerCase()}). Data visual — bukan
        umpan bursa nyata.
      </p>
    </div>
  );
}
