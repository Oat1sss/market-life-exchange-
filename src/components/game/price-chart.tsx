/**
 * Server-rendered SVG price charts. No client JS, no chart dependency: the
 * series comes from PricePoint rows and is scaled into a fixed viewBox.
 */
import { formatMinor } from "@/domain/money";

export interface ChartPoint {
  tick: number;
  priceMinor: bigint;
}

interface PriceChartProps {
  readonly points: readonly ChartPoint[];
  readonly id: string;
  readonly height?: number;
  readonly showAxis?: boolean;
}

const WIDTH = 640;

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

export function Sparkline({
  points,
  id,
  positive,
}: {
  readonly points: readonly ChartPoint[];
  readonly id: string;
  readonly positive: boolean;
}) {
  const width = 140;
  const height = 34;
  const numbers = points.map((point) => Number(point.priceMinor));
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const path = numbers
    .map((value, index) => {
      const x = numbers.length <= 1 ? 0 : (index / (numbers.length - 1)) * width;
      const y = scaleY(value, min, max, 2, height - 4);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-9 w-full ${positive ? "text-up" : "text-down"}`}
      role="img"
      aria-label="Price sparkline"
      data-chart={id}
    >
      {numbers.length > 1 ? (
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" />
      ) : (
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" />
      )}
    </svg>
  );
}

export function PriceChart({
  points,
  id,
  height = 240,
  showAxis = true,
}: PriceChartProps) {
  const axisSpace = showAxis ? 22 : 0;
  const plotHeight = height - axisSpace - 10;
  const numbers = points.map((point) => Number(point.priceMinor));

  if (numbers.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-line bg-elevated/60 text-xs text-muted"
        style={{ height }}
        data-chart={id}
      >
        Majukan pasar satu bulan untuk membentuk grafik ini.
      </div>
    );
  }

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const padding = Math.max(1, (max - min) * 0.08);
  const low = min - padding;
  const high = max + padding;
  const step = WIDTH / (numbers.length - 1);

  const coords = numbers.map((value, index) => ({
    x: index * step,
    y: scaleY(value, low, high, 10, plotHeight),
  }));

  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${WIDTH},${10 + plotHeight} L0,${10 + plotHeight} Z`;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const up = last.priceMinor >= first.priceMinor;
  const stroke = up ? "#0ecb81" : "#f6465d";
  const gradientId = `price-gradient-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className="rounded-xl border border-line bg-elevated p-3" data-chart={id}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Price history from tick ${first.tick} to ${last.tick}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            y1={10 + plotHeight * fraction}
            x2={WIDTH}
            y2={10 + plotHeight * fraction}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />

        {coords.map((point, index) =>
          index === coords.length - 1 ? (
            <circle key={index} cx={point.x} cy={point.y} r="3.5" fill={stroke} />
          ) : null,
        )}

        {showAxis ? (
          <g className="fill-current text-muted" fontSize="10">
            <text x="4" y={height - 6}>
              tick {first.tick}
            </text>
            <text x={WIDTH / 2} y={height - 6} textAnchor="middle">
              Rp {formatMinor(BigInt(Math.round(min)))} – Rp {formatMinor(BigInt(Math.round(max)))}
            </text>
            <text x={WIDTH - 4} y={height - 6} textAnchor="end">
              tick {last.tick}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
