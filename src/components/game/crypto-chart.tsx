import { formatMinor } from "@/domain/money";
import { calculateSMASeries, type PriceSample } from "@/domain/market/analysis";

export interface CryptoChartProps {
  readonly points: readonly PriceSample[];
  readonly id: string;
  readonly height?: number;
  readonly showSMA?: boolean;
}

const WIDTH = 680;

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

export function CryptoTechnicalChart({
  points,
  id,
  height = 280,
  showSMA = true,
}: CryptoChartProps) {
  const sorted = [...points].sort((a, b) => a.tick - b.tick);

  if (sorted.length < 2) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border-subtle bg-background/50 text-sm text-muted"
        data-chart={id}
      >
        Advance month ticks to build price history and indicators.
      </div>
    );
  }

  const prices = sorted.map((p) => Number(p.priceMinor));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Compute SMAs
  const sma5 = showSMA ? calculateSMASeries(sorted, 5) : [];
  const sma20 = showSMA ? calculateSMASeries(sorted, 20) : [];

  const padding = Math.max(1, (maxPrice - minPrice) * 0.12);
  const plotLow = Math.max(0, minPrice - padding);
  const plotHigh = maxPrice + padding;

  const topOffset = 18;
  const bottomAxisSpace = 28;
  const plotHeight = height - topOffset - bottomAxisSpace;
  const step = WIDTH / (sorted.length - 1);

  // Price points
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

  // SMA 5 path
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

  // SMA 20 path
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
  const isUp = last.priceMinor >= first.priceMinor;
  const strokeColor = isUp ? "#10b981" : "#ef4444";
  const gradientId = `crypto-gradient-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Find max and min points for high/low labels
  let highestIdx = 0;
  let lowestIdx = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i]! > prices[highestIdx]!) highestIdx = i;
    if (prices[i]! < prices[lowestIdx]!) lowestIdx = i;
  }
  const highPoint = priceCoords[highestIdx]!;
  const lowPoint = priceCoords[lowestIdx]!;

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-background p-4" data-chart={id}>
      {/* Legend & Stats Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: strokeColor }}
            />
            <span>Price ({isUp ? "Bullish" : "Bearish"})</span>
          </div>
          {showSMA && (
            <>
              <div className="flex items-center gap-1.5 text-amber-600">
                <span className="inline-block h-0.5 w-3 bg-amber-500" />
                <span>SMA-5 (Short)</span>
              </div>
              <div className="flex items-center gap-1.5 text-blue-600">
                <span className="inline-block h-0.5 w-3 bg-blue-500" />
                <span>SMA-20 (Long)</span>
              </div>
            </>
          )}
        </div>
        <div className="font-mono text-muted">
          High: Rp {formatMinor(BigInt(Math.round(maxPrice)))} · Low: Rp {formatMinor(BigInt(Math.round(minPrice)))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`Crypto technical price chart from tick ${first.tick} to ${last.tick}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="85%" stopColor={strokeColor} stopOpacity="0.03" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = topOffset + plotHeight * fraction;
          return (
            <line
              key={fraction}
              x1="0"
              y1={y}
              x2={WIDTH}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.07"
              strokeWidth="1"
              strokeDasharray={fraction === 0 || fraction === 1 ? undefined : "3 3"}
            />
          );
        })}

        {/* Gradient fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* SMA lines */}
        {showSMA && sma20Path && (
          <path
            d={sma20Path}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.85"
          />
        )}
        {showSMA && sma5Path && (
          <path
            d={sma5Path}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.5"
            opacity="0.9"
          />
        )}

        {/* Price main line */}
        <path
          d={pricePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* High marker */}
        <circle
          cx={highPoint.x}
          cy={highPoint.y}
          r="3"
          fill="#10b981"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <text
          x={Math.min(WIDTH - 50, Math.max(30, highPoint.x))}
          y={Math.max(12, highPoint.y - 7)}
          fontSize="9"
          fontWeight="600"
          textAnchor="middle"
          fill="currentColor"
          className="fill-emerald-700"
        >
          H: {formatMinor(highPoint.priceMinor)}
        </text>

        {/* Low marker */}
        <circle
          cx={lowPoint.x}
          cy={lowPoint.y}
          r="3"
          fill="#ef4444"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <text
          x={Math.min(WIDTH - 50, Math.max(30, lowPoint.x))}
          y={Math.min(topOffset + plotHeight + 14, lowPoint.y + 14)}
          fontSize="9"
          fontWeight="600"
          textAnchor="middle"
          fill="currentColor"
          className="fill-red-700"
        >
          L: {formatMinor(lowPoint.priceMinor)}
        </text>

        {/* Last price dot */}
        <circle
          cx={priceCoords[priceCoords.length - 1]!.x}
          cy={priceCoords[priceCoords.length - 1]!.y}
          r="4.5"
          fill={strokeColor}
        />
        <circle
          cx={priceCoords[priceCoords.length - 1]!.x}
          cy={priceCoords[priceCoords.length - 1]!.y}
          r="7"
          fill={strokeColor}
          opacity="0.25"
        />

        {/* Axis labels */}
        <g className="fill-current text-muted font-mono" fontSize="10">
          <text x="4" y={height - 6}>
            Tick {first.tick}
          </text>
          <text x={WIDTH / 2} y={height - 6} textAnchor="middle">
            Range: Rp {formatMinor(BigInt(Math.round(minPrice)))} – Rp {formatMinor(BigInt(Math.round(maxPrice)))}
          </text>
          <text x={WIDTH - 4} y={height - 6} textAnchor="end">
            Tick {last.tick} (Latest)
          </text>
        </g>
      </svg>
    </div>
  );
}
