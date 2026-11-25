/**
 * Open futures positions table with mark, margin, P&L and a close action.
 */
import { currency } from "@/domain/money";
import { ClosePositionButton } from "./close-position-button";
import { EmptyState, SideBadge } from "./ui";

export interface PositionRow {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  leverage: number;
  entryPriceMinor: bigint;
  markPriceMinor: bigint;
  marginMinor: bigint;
  pnlMinor: bigint;
  equityMinor: bigint;
  liquidationPriceMinor: bigint;
}

export function PositionsTable({ positions }: { readonly positions: PositionRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th className="px-3 py-2.5 font-semibold">Pasangan</th>
            <th className="px-3 py-2.5 font-semibold">Sisi</th>
            <th className="px-3 py-2.5 text-right font-semibold">Jumlah</th>
            <th className="px-3 py-2.5 text-right font-semibold">Masuk</th>
            <th className="px-3 py-2.5 text-right font-semibold">Mark</th>
            <th className="px-3 py-2.5 text-right font-semibold">Margin</th>
            <th className="px-3 py-2.5 text-right font-semibold">P&amp;L</th>
            <th className="px-3 py-2.5 text-right font-semibold">Likuidasi</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {positions.map((position) => (
            <tr key={position.id} className="transition hover:bg-surface-2/40">
              <td className="px-3 py-2.5 font-bold text-white">
                {position.symbol}
              </td>
              <td className="px-3 py-2.5">
                <SideBadge side={position.side} leverage={position.leverage} />
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[#c7ccd4]">
                {position.quantity}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-white">
                {currency(position.entryPriceMinor)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-white">
                {currency(position.markPriceMinor)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[#c7ccd4]">
                {currency(position.marginMinor)}
              </td>
              <td
                className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                  position.pnlMinor > 0n
                    ? "text-up"
                    : position.pnlMinor < 0n
                      ? "text-down"
                      : "text-muted"
                }`}
              >
                {position.pnlMinor > 0n ? "+" : ""}
                {currency(position.pnlMinor)}
              </td>
              <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-down">
                {currency(position.liquidationPriceMinor)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <ClosePositionButton positionId={position.id} />
              </td>
            </tr>
          ))}
          {positions.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-6">
                <EmptyState>
                  Tidak ada posisi futures yang sedang terbuka.
                </EmptyState>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
