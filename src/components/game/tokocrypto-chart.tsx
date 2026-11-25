"use client";

import { useState } from "react";
import { formatMinor } from "@/domain/money";
import { calculateSMASeries, type PriceSample } from "@/domain/market/analysis";

export type ChartType = "CANDLESTICK" | "AREA" | "BAR";

interface TokocryptoChartProps {
  readonly points: readonly PriceSample[];
  readonly symbol: string;
  readonly height?: number;
}

const WIDTH = 760;

function scaleY(
  value: number,
  min: number,
  max: number,
  top: number,
  plotHeight: number,
): number {
  if (max === min) return top + plotHeight / 2;
  return top + plotHeight - ((value - min) / (max - min)) * plotHeight;
}

interface CandleData {
  tick: number;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  isUp: boolean;
}

export function TokocryptoChart({
  points,
  symbol,
  height = 360,
}: TokocryptoChartProps) {
  const [chartType, setChartType] = useState<ChartType>("CANDLESTICK");
  const [timeframe, setTimeframe] = useState<"15m" | "1H" | "4H" | "1D" | "1M">("1M");
  const [showIndicators, setShowIndicators] = useState<boolean>(true);
  const [hoverCandle, setHoverCandle] = useState<CandleData | null>(null);

  const sorted = [...points].sort((a, b) => a.tick - b.tick);

  if (sorted.length < 2) {
    return (
      <div
        className="flex h-72 items-center justify-center rounded-xl border border-[#2b313a] bg-[#181a20] text-xs text-[#848e9c]"
      >
        Lakukan Advance Bulan untuk membentuk grafik harga dan indikator teknikal.
      </div>
    );
  }

  // Derive realistic OHLC candles from tick price progression
  const candles: CandleData[] = sorted.map((pt, idx) => {
    const close = pt.priceMinor;
    const open = idx > 0 ? sorted[idx - 1]!.priceMinor : close;
    const isUp = close >= open;

    const bodyDiff = close >= open ? close - open : open - close;
    const priceNum = Number(close);
    // Dynamic wick proportional to price and volatility
    const wickDelta = BigInt(Math.max(1, Math.round(priceNum * 0.008 + Number(bodyDiff) * 0.35)));

    const maxVal = close > open ? close : open;
    const minVal = close < open ? close : open;

    const high = maxVal + wickDelta;
    const low = minVal > wickDelta ? minVal - wickDelta : 1n;

    return {
      tick: pt.tick,
      open,
      high,
      low,
      close,
      isUp,
    };
  });

  const allLows = candles.map((c) => Number(c.low));
  const allHighs = candles.map((c) => Number(c.high));
  const minPrice = Math.min(...allLows);
  const maxPrice = Math.max(...allHighs);

  const sma5 = showIndicators ? calculateSMASeries(sorted, 5) : [];
  const sma20 = showIndicators ? calculateSMASeries(sorted, 20) : [];

  const padding = Math.max(1, (maxPrice - minPrice) * 0.1);
  const plotLow = Math.max(0, minPrice - padding);
  const plotHigh = maxPrice + padding;

  const topOffset = 24;
  const bottomAxisSpace = 32;
  const plotHeight = height - topOffset - bottomAxisSpace;
  const step = WIDTH / (sorted.length - 1);

  // Price points for Line/Area
  const priceCoords = sorted.map((sample, idx) => ({
    x: idx * step,
    y: scaleY(Number(sample.priceMinor), plotLow, plotHigh, topOffset, plotHeight),
    tick: sample.tick,
    priceMinor: sample.priceMinor,
  }));

  const pricePath = priceCoords
    .map((pt, idx) => `${idx === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${pricePath} L${WIDTH},${topOffset + plotHeight} L0,${topOffset + plotHeight} Z`;

  // SMA 5 path (Tokocrypto Gold)
  const sma5Coords = sma5.map((sample, idx) => ({
    x: idx * step,
    y: scaleY(Number(sample.valueMinor), plotLow, plotHigh, topOffset, plotHeight),
  }));
  const sma5Path =
    sma5Coords.length > 1
      ? sma5Coords
          .map((pt, idx) => `${idx === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
          .join(" ")
      : "";

  // SMA 20 path (Tokocrypto Teal)
  const sma20Coords = sma20.map((sample, idx) => ({
    x: idx * step,
    y: scaleY(Number(sample.valueMinor), plotLow, plotHigh, topOffset, plotHeight),
  }));
  const sma20Path =
    sma20Coords.length > 1
      ? sma20Coords
          .map((pt, idx) => `${idx === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
          .join(" ")
      : "";

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const isOverallUp = last.priceMinor >= first.priceMinor;
  const strokeColor = isOverallUp ? "#0ecb81" : "#f6465d";
  const gradientId = `tokocrypto-grad-${symbol}`;

  // Find max and min points for high/low labels
  let highestIdx = 0;
  let lowestIdx = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i]!.high > candles[highestIdx]!.high) highestIdx = i;
    if (candles[i]!.low < candles[lowestIdx]!.low) lowestIdx = i;
  }
  const highPoint = {
    x: highestIdx * step,
    y: scaleY(Number(candles[highestIdx]!.high), plotLow, plotHigh, topOffset, plotHeight),
    priceMinor: candles[highestIdx]!.high,
  };
  const lowPoint = {
    x: lowestIdx * step,
    y: scaleY(Number(candles[lowestIdx]!.low), plotLow, plotHigh, topOffset, plotHeight),
    priceMinor: candles[lowestIdx]!.low,
  };

  const activeDisplay = hoverCandle ?? candles.at(-1)!;

  return (
    <div className="overflow-hidden rounded-xl border border-[#2b313a] bg-[#181a20] p-4 text-[#eaecef] shadow-xl">
      {/* Tokocrypto Top Chart Toolbar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#2b313a] pb-2 text-xs">
        {/* Chart View Modes: Candlestick, Area/Line, Bar */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setChartType("CANDLESTICK")}
            className={`flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition ${
              chartType === "CANDLESTICK"
                ? "bg-[#00c087] text-black shadow"
                : "bg-[#12161a] text-[#848e9c] hover:text-white"
            }`}
          >
            <span>🕯️</span>
            <span>Candlestick</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType("AREA")}
            className={`flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition ${
              chartType === "AREA"
                ? "bg-[#00c087] text-black shadow"
                : "bg-[#12161a] text-[#848e9c] hover:text-white"
            }`}
          >
            <span>📈</span>
            <span>Area / Garis</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType("BAR")}
            className={`flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition ${
              chartType === "BAR"
                ? "bg-[#00c087] text-black shadow"
                : "bg-[#12161a] text-[#848e9c] hover:text-white"
            }`}
          >
            <span>📊</span>
            <span>Bar OHLC</span>
          </button>
        </div>

        {/* Timeframes & Indicators */}
        <div className="flex items-center gap-1">
          {(["15m", "1H", "4H", "1D", "1M"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded px-2 py-0.5 font-semibold transition ${
                timeframe === tf
                  ? "bg-[#2b313a] text-[#00c087]"
                  : "text-[#848e9c] hover:text-white"
              }`}
            >
              {tf}
            </button>
          ))}
          <span className="mx-1 text-[#2b313a]">|</span>
          <button
            type="button"
            onClick={() => setShowIndicators(!showIndicators)}
            className={`rounded px-2 py-0.5 font-semibold transition ${
              showIndicators
                ? "bg-[#00c087]/15 text-[#00c087]"
                : "text-[#848e9c] hover:text-white"
            }`}
          >
            MA
          </button>
        </div>
      </div>

      {/* OHLC Realtime HUD Bar */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[#848e9c]">
        <div className="flex items-center gap-1 font-sans text-xs font-bold text-white">
          <span>Bulan {activeDisplay.tick}</span>
        </div>
        <div>
          <span>Buka: </span>
          <span className="text-[#eaecef]">{formatMinor(activeDisplay.open)}</span>
        </div>
        <div>
          <span>Tinggi: </span>
          <span className="text-[#0ecb81]">{formatMinor(activeDisplay.high)}</span>
        </div>
        <div>
          <span>Rendah: </span>
          <span className="text-[#f6465d]">{formatMinor(activeDisplay.low)}</span>
        </div>
        <div>
          <span>Tutup: </span>
          <span
            className={`font-semibold ${
              activeDisplay.isUp ? "text-[#0ecb81]" : "text-[#f6465d]"
            }`}
          >
            {formatMinor(activeDisplay.close)}
          </span>
        </div>
        {showIndicators && (
          <>
            <div className="text-[#f0b90b]">
              <span>MA(5): </span>
              <span>{formatMinor(sma5.at(-1)?.valueMinor ?? 0n)}</span>
            </div>
            <div className="text-[#00c087]">
              <span>MA(20): </span>
              <span>{formatMinor(sma20.at(-1)?.valueMinor ?? 0n)}</span>
            </div>
          </>
        )}
      </div>

      <div className="relative">
        {/* Background Watermark */}
        <div className="pointer-events-none absolute left-6 top-6 select-none font-bold tracking-wider text-[#2b313a]/30 text-5xl">
          {symbol} / IDR
        </div>

        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label={`Tokocrypto chart for ${symbol}`}
          onMouseLeave={() => setHoverCandle(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <stop offset="70%" stopColor={strokeColor} stopOpacity="0.04" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = topOffset + plotHeight * fraction;
            return (
              <line
                key={fraction}
                x1="0"
                y1={y}
                x2={WIDTH}
                y2={y}
                stroke="#2b313a"
                strokeWidth="1"
                strokeDasharray={fraction === 0 || fraction === 1 ? undefined : "3 3"}
              />
            );
          })}

          {/* MODE 1: CANDLESTICK */}
          {chartType === "CANDLESTICK" && (
            <g className="cursor-crosshair">
              {candles.map((candle, idx) => {
                const x = idx * step;
                const candleWidth = Math.max(3, Math.min(16, step * 0.65));

                const yHigh = scaleY(Number(candle.high), plotLow, plotHigh, topOffset, plotHeight);
                const yLow = scaleY(Number(candle.low), plotLow, plotHigh, topOffset, plotHeight);
                const yOpen = scaleY(Number(candle.open), plotLow, plotHigh, topOffset, plotHeight);
                const yClose = scaleY(Number(candle.close), plotLow, plotHigh, topOffset, plotHeight);

                const bodyTop = Math.min(yOpen, yClose);
                const bodyBottom = Math.max(yOpen, yClose);
                const bodyH = Math.max(2, bodyBottom - bodyTop);

                const color = candle.isUp ? "#0ecb81" : "#f6465d";

                return (
                  <g
                    key={`candle-${candle.tick}`}
                    onMouseEnter={() => setHoverCandle(candle)}
                    className="transition-opacity hover:opacity-80"
                  >
                    {/* Wick Line (High to Low) */}
                    <line
                      x1={x}
                      y1={yHigh}
                      x2={x}
                      y2={yLow}
                      stroke={color}
                      strokeWidth="1.4"
                    />
                    {/* Body Rectangle */}
                    <rect
                      x={x - candleWidth / 2}
                      y={bodyTop}
                      width={candleWidth}
                      height={bodyH}
                      fill={color}
                      rx="1"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* MODE 2: AREA / GARIS */}
          {chartType === "AREA" && (
            <>
              <path d={areaPath} fill={`url(#${gradientId})`} />
              <path
                d={pricePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}

          {/* MODE 3: BAR OHLC */}
          {chartType === "BAR" && (
            <g className="cursor-crosshair">
              {candles.map((candle, idx) => {
                const x = idx * step;
                const tickLen = Math.max(2, Math.min(6, step * 0.3));

                const yHigh = scaleY(Number(candle.high), plotLow, plotHigh, topOffset, plotHeight);
                const yLow = scaleY(Number(candle.low), plotLow, plotHigh, topOffset, plotHeight);
                const yOpen = scaleY(Number(candle.open), plotLow, plotHigh, topOffset, plotHeight);
                const yClose = scaleY(Number(candle.close), plotLow, plotHigh, topOffset, plotHeight);

                const color = candle.isUp ? "#0ecb81" : "#f6465d";

                return (
                  <g
                    key={`bar-${candle.tick}`}
                    onMouseEnter={() => setHoverCandle(candle)}
                  >
                    {/* Main vertical bar */}
                    <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.6" />
                    {/* Open tick (left) */}
                    <line x1={x - tickLen} y1={yOpen} x2={x} y2={yOpen} stroke={color} strokeWidth="1.6" />
                    {/* Close tick (right) */}
                    <line x1={x} y1={yClose} x2={x + tickLen} y2={yClose} stroke={color} strokeWidth="1.6" />
                  </g>
                );
              })}
            </g>
          )}

          {/* SMA 20 Line (Tokocrypto Teal) */}
          {showIndicators && sma20Path && (
            <path
              d={sma20Path}
              fill="none"
              stroke="#00c087"
              strokeWidth="1.8"
              strokeDasharray="4 2"
              opacity="0.9"
            />
          )}

          {/* SMA 5 Line (Tokocrypto Gold) */}
          {showIndicators && sma5Path && (
            <path
              d={sma5Path}
              fill="none"
              stroke="#f0b90b"
              strokeWidth="1.8"
              opacity="0.95"
            />
          )}

          {/* High marker */}
          <circle
            cx={highPoint.x}
            cy={highPoint.y}
            r="3.5"
            fill="#0ecb81"
            stroke="#181a20"
            strokeWidth="1.5"
          />
          <text
            x={Math.min(WIDTH - 50, Math.max(30, highPoint.x))}
            y={Math.max(14, highPoint.y - 7)}
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            fill="#0ecb81"
          >
            H: {formatMinor(highPoint.priceMinor)}
          </text>

          {/* Low marker */}
          <circle
            cx={lowPoint.x}
            cy={lowPoint.y}
            r="3.5"
            fill="#f6465d"
            stroke="#181a20"
            strokeWidth="1.5"
          />
          <text
            x={Math.min(WIDTH - 50, Math.max(30, lowPoint.x))}
            y={Math.min(topOffset + plotHeight + 14, lowPoint.y + 14)}
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            fill="#f6465d"
          >
            L: {formatMinor(lowPoint.priceMinor)}
          </text>

          {/* Latest Price Dot */}
          <circle
            cx={priceCoords[priceCoords.length - 1]!.x}
            cy={priceCoords[priceCoords.length - 1]!.y}
            r="5"
            fill={strokeColor}
          />

          {/* Bottom X-Axis labels */}
          <g className="fill-[#848e9c] font-mono text-[10px]">
            <text x="4" y={height - 8}>
              Bulan {first.tick}
            </text>
            <text x={WIDTH / 2} y={height - 8} textAnchor="middle">
              Rentang: Rp {formatMinor(BigInt(Math.round(minPrice)))} – Rp {formatMinor(BigInt(Math.round(maxPrice)))}
            </text>
            <text x={WIDTH - 4} y={height - 8} textAnchor="end">
              Bulan {last.tick} (Terkini)
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
