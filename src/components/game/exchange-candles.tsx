"use client";

import { useMemo, useRef, useState } from "react";

export interface CandlePoint {
  tick: number;
  priceMinor: bigint;
}

interface Candle {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  synthetic: boolean;
}

const FRAMES = [
  { key: "1T", group: 1, label: "1T" },
  { key: "3T", group: 3, label: "3T" },
  { key: "7T", group: 7, label: "7T" },
  { key: "15T", group: 15, label: "15T" },
] as const;

type FrameKey = (typeof FRAMES)[number]["key"];

/** Stable 32-bit hash so wicks/volume never flicker between renders. */
function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function buildCandles(points: CandlePoint[], symbol: string, group: number): Candle[] {
  const candles: Candle[] = [];
  for (let start = 0; start < points.length; start += group) {
    const slice = points.slice(start, start + group);
    const first = slice[0]!;
    const last = slice.at(-1)!;
    const open = candles.at(-1)?.close ?? Number(first.priceMinor) / 100;
    const close = Number(last.priceMinor) / 100;
    const salt = hash(`${symbol}:${slice.length}:${last.tick}`);
    const wobble = (salt % 1000) / 1000;
    const span = Math.max(Math.abs(close - open), close * 0.004);
    const high = Math.max(open, close) + span * (0.15 + wobble * 0.9);
    const low = Math.min(open, close) - span * (0.15 + ((salt >>> 10) % 1000) / 1000);
    const volume = 400 + (hash(`${symbol}:v:${last.tick}`) % 2600);
    candles.push({
      tick: last.tick,
      open,
      high,
      low,
      close,
      volume,
      synthetic: slice.length > 1,
    });
  }
  return candles;
}

function movingAverage(candles: Candle[], window: number): Array<number | null> {
  return candles.map((_, index) => {
    if (index < window - 1) return null;
    let sum = 0;
    for (let i = index - window + 1; i <= index; i += 1) sum += candles[i]!.close;
    return sum / window;
  });
}

function formatPrice(value: number): string {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: value < 10 ? 4 : 2,
    maximumFractionDigits: value < 10 ? 4 : 2,
  });
}

const W = 820;
const H = 380;
const PAD = { top: 12, right: 70, bottom: 20, left: 10 };
const CHART_H = 258;
const VOL_TOP = 296;
const VOL_H = 62;

export function ExchangeCandles({
  points,
  symbol,
}: {
  points: CandlePoint[];
  symbol: string;
}) {
  const [frame, setFrame] = useState<FrameKey>("3T");
  const [hover, setHover] = useState<number | null>(null);
  const [showMa, setShowMa] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  const group = FRAMES.find((f) => f.key === frame)!.group;
  const candles = useMemo(
    () => buildCandles(points, symbol, group),
    [points, symbol, group],
  );

  if (candles.length === 0) {
    return (
      <div className="rounded-xl border border-[#2b313a] bg-[#181a20] p-10 text-center text-sm text-[#848e9c]">
        Belum ada data harga untuk {symbol}. Majukan pasar satu kali.
      </div>
    );
  }

  const visible = candles.slice(-70);
  const ma5 = movingAverage(visible, 5);
  const ma20 = movingAverage(visible, 20);

  const highs = visible.map((c) => c.high);
  const lows = visible.map((c) => c.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || max * 0.02 || 1;
  const maxVol = Math.max(...visible.map((c) => c.volume));

  const innerW = W - PAD.left - PAD.right;
  const slot = innerW / visible.length;
  const bodyW = Math.max(2, Math.min(9, slot * 0.62));

  const y = (price: number) =>
    PAD.top + ((max + range * 0.06 - price) / (range * 1.12)) * CHART_H;
  const volY = (volume: number) => VOL_TOP + VOL_H - (volume / maxVol) * VOL_H;

  const line = (values: Array<number | null>) => {
    const segments: string[] = [];
    values.forEach((value, index) => {
      if (value === null) return;
      const px = PAD.left + slot * index + slot / 2;
      const py = y(value);
      segments.push(`${segments.length === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`);
    });
    return segments.join(" ");
  };

  const active = hover !== null ? visible[hover] : visible.at(-1)!;
  const activeIndex = hover ?? visible.length - 1;
  const prevClose = visible[Math.max(0, activeIndex - 1)]!.close;
  const changePct = ((active.close - prevClose) / prevClose) * 100;
  const up = active.close >= active.open;

  const gridPrices = [0, 0.25, 0.5, 0.75, 1].map((ratio) => max - range * ratio);

  return (
    <div className="overflow-hidden rounded-xl border border-[#2b313a] bg-[#181a20] text-[#eaecef] shadow-xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2b313a] px-3 py-2">
        <div className="flex overflow-hidden rounded-md border border-[#2b313a]">
          {FRAMES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setFrame(item.key);
                setHover(null);
              }}
              className={`px-2.5 py-1 text-[11px] font-bold transition ${
                item.key === frame
                  ? "bg-[#2b313a] text-[#f0b90b]"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowMa((value) => !value)}
          className={`rounded border px-2 py-1 text-[10px] font-bold ${
            showMa
              ? "border-[#f0b90b]/40 bg-[#f0b90b]/10 text-[#f0b90b]"
              : "border-[#2b313a] text-[#848e9c]"
          }`}
        >
          MA 5/20
        </button>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-[#848e9c]">
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#f0b90b]" /> MA5
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#6f8dff]" /> MA20
          </span>
          <span className="rounded bg-[#2b313a] px-1.5 py-0.5 font-bold text-[#848e9c]">
            {symbol}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-3">
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-bold tabular-nums">
            {formatPrice(active.close)}
          </div>
          <div
            className={`text-xs font-bold tabular-nums ${
              changePct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"
            }`}
          >
            {changePct >= 0 ? "+" : ""}
            {changePct.toFixed(2)}%
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-[#848e9c] sm:grid-cols-6 md:grid-cols-7">
          <div>
            <dt>Open</dt>
            <dd className="font-semibold tabular-nums text-[#eaecef]">{formatPrice(active.open)}</dd>
          </div>
          <div>
            <dt>High</dt>
            <dd className="font-semibold tabular-nums text-[#0ecb81]">{formatPrice(active.high)}</dd>
          </div>
          <div>
            <dt>Low</dt>
            <dd className="font-semibold tabular-nums text-[#f6465d]">{formatPrice(active.low)}</dd>
          </div>
          <div>
            <dt>Close</dt>
            <dd className={`font-semibold tabular-nums ${up ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
              {formatPrice(active.close)}
            </dd>
          </div>
          <div>
            <dt>Vol</dt>
            <dd className="font-semibold tabular-nums text-[#eaecef]">
              {active.volume.toLocaleString("id-ID")}
            </dd>
          </div>
          <div>
            <dt>Tick</dt>
            <dd className="font-semibold tabular-nums text-[#eaecef]">#{active.tick}</dd>
          </div>
          <div className="hidden sm:block">
            <dt>Mode</dt>
            <dd className="font-semibold text-[#f0b90b]">
              {active.synthetic ? "Agregasi" : "Mentah"}
            </dd>
          </div>
        </dl>
      </div>

      <div
        ref={wrapRef}
        className="relative px-1 pb-2"
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full select-none"
          role="img"
          aria-label={`Grafik candlestick ${symbol}`}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            const xPx = ratio * W - PAD.left;
            const index = Math.floor(xPx / slot);
            setHover(index >= 0 && index < visible.length ? index : null);
          }}
        >
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

          <line x1={PAD.left} x2={W - PAD.right} y1={VOL_TOP - 8} y2={VOL_TOP - 8} stroke="#232830" />

          {visible.map((candle, index) => {
            const px = PAD.left + slot * index + slot / 2;
            const green = candle.close >= candle.open;
            const color = green ? "#0ecb81" : "#f6465d";
            const top = y(Math.max(candle.open, candle.close));
            const bottom = y(Math.min(candle.open, candle.close));
            return (
              <g key={candle.tick} opacity={hover === null || hover === index ? 1 : 0.62}>
                <line x1={px} x2={px} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1" />
                <rect
                  x={px - bodyW / 2}
                  y={top}
                  width={bodyW}
                  height={Math.max(1, bottom - top)}
                  fill={green ? "#0ecb81" : "#f6465d"}
                />
                <rect
                  x={px - bodyW / 2}
                  y={volY(candle.volume)}
                  width={bodyW}
                  height={VOL_TOP + VOL_H - volY(candle.volume)}
                  fill={green ? "#0ecb8155" : "#f6465d55"}
                />
              </g>
            );
          })}

          {showMa ? (
            <>
              <path d={line(ma5)} fill="none" stroke="#f0b90b" strokeWidth="1.2" opacity="0.9" />
              <path d={line(ma20)} fill="none" stroke="#6f8dff" strokeWidth="1.2" opacity="0.85" />
            </>
          ) : null}

          {hover !== null ? (
            <g>
              <line
                x1={PAD.left + slot * hover + slot / 2}
                x2={PAD.left + slot * hover + slot / 2}
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

          <text x={PAD.left} y={H - 4} fill="#5e6673" fontSize="9">
            {visible[0]!.tick}
          </text>
          <text x={W - PAD.right - 24} y={H - 4} fill="#5e6673" fontSize="9">
            {visible.at(-1)!.tick}
          </text>
        </svg>
      </div>

      <p className="border-t border-[#2b313a] px-4 py-2 text-[10px] text-[#5e6673]">
        Lilin disintesis dari titik harga per tick pasar demo (open = close
        sebelumnya, sumbu volume sintetis). Bukan data intraday bursa nyata.
      </p>
    </div>
  );
}
