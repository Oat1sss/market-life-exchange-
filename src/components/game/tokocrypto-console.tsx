"use client";

import { useState } from "react";
import { currency, formatMinor } from "@/domain/money";
import { CancelOrderButton } from "./cancel-order-button";
import { ClosePositionButton } from "./close-position-button";

interface PositionView {
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

interface OrderView {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  limitPriceMinor: bigint | null;
}

interface HoldingView {
  symbol: string;
  quantity: number;
  avgCostMinor: bigint;
  currentPriceMinor: bigint;
  marketValueMinor: bigint;
}

interface TradeHistoryView {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  priceMinor: bigint;
  feeMinor: bigint;
}

type ConsoleTab = "POSITIONS" | "ORDERS" | "HOLDINGS" | "HISTORY";

interface TokocryptoConsoleProps {
  readonly positions: readonly PositionView[];
  readonly openOrders: readonly OrderView[];
  readonly holdings: readonly HoldingView[];
  readonly tradeHistory: readonly TradeHistoryView[];
  readonly showFutures?: boolean;
  readonly holdingsLabel?: string;
  readonly emptyHoldingsLabel?: string;
  readonly defaultTab?: ConsoleTab;
}

export function TokocryptoConsole({
  positions,
  openOrders,
  holdings,
  tradeHistory,
  showFutures = true,
  holdingsLabel = "Aset Kripto Saya",
  emptyHoldingsLabel = "Anda belum memiliki saldo spot kripto.",
  defaultTab,
}: TokocryptoConsoleProps) {
  const [activeTab, setActiveTab] = useState<ConsoleTab>(
    defaultTab ?? (showFutures ? "POSITIONS" : "ORDERS"),
  );

  return (
    <div className="rounded-xl border border-[#2b313a] bg-[#181a20] p-4 text-[#eaecef] shadow-xl">
      {/* Tokocrypto Console Tabs */}
      <div className="flex border-b border-[#2b313a] pb-2 text-xs font-bold uppercase tracking-wider">
        {showFutures ? (
          <button
            type="button"
            onClick={() => setActiveTab("POSITIONS")}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition ${
              activeTab === "POSITIONS"
                ? "border-b-2 border-[#00c087] text-[#00c087]"
                : "text-[#848e9c] hover:text-[#eaecef]"
            }`}
          >
            <span>Posisi Futures</span>
            <span className="rounded-full bg-[#2b313a] px-1.5 py-0.2 text-[10px] text-white">
              {positions.length}
            </span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setActiveTab("ORDERS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition ${
            activeTab === "ORDERS"
              ? "border-b-2 border-[#00c087] text-[#00c087]"
              : "text-[#848e9c] hover:text-[#eaecef]"
          }`}
        >
          <span>Pesanan Terbuka</span>
          <span className="rounded-full bg-[#2b313a] px-1.5 py-0.2 text-[10px] text-white">
            {openOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HOLDINGS")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition ${
            activeTab === "HOLDINGS"
              ? "border-b-2 border-[#00c087] text-[#00c087]"
              : "text-[#848e9c] hover:text-[#eaecef]"
          }`}
        >
          <span>{holdingsLabel}</span>
          <span className="rounded-full bg-[#2b313a] px-1.5 py-0.2 text-[10px] text-white">
            {holdings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HISTORY")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition ${
            activeTab === "HISTORY"
              ? "border-b-2 border-[#00c087] text-[#00c087]"
              : "text-[#848e9c] hover:text-[#eaecef]"
          }`}
        >
          <span>Riwayat Transaksi</span>
          <span className="rounded-full bg-[#2b313a] px-1.5 py-0.2 text-[10px] text-white">
            {tradeHistory.length}
          </span>
        </button>
      </div>

      <div className="pt-3">
        {/* TAB 1: POSISI FUTURES */}
        {showFutures && activeTab === "POSITIONS" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2b313a] text-[10px] uppercase tracking-wider text-[#848e9c]">
                  <th className="py-2.5">Pasangan</th>
                  <th className="py-2.5 text-right">Ukuran</th>
                  <th className="py-2.5 text-right">Harga Masuk</th>
                  <th className="py-2.5 text-right">Harga Mark</th>
                  <th className="py-2.5 text-right">Harga Likuidasi</th>
                  <th className="py-2.5 text-right">Margin</th>
                  <th className="py-2.5 text-right">P&amp;L (ROE %)</th>
                  <th className="py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b313a]/50">
                {positions.map((pos) => {
                  const pnl = pos.pnlMinor;
                  const roe =
                    pos.marginMinor > 0n
                      ? Number((pnl * 10_000n) / pos.marginMinor) / 100
                      : 0;
                  const isProfit = pnl >= 0n;

                  return (
                    <tr key={pos.id} className="hover:bg-[#1e2329]/50">
                      <td className="py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{pos.symbol}/CR</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              pos.side === "LONG"
                                ? "bg-[#0ecb81]/15 text-[#0ecb81]"
                                : "bg-[#f6465d]/15 text-[#f6465d]"
                            }`}
                          >
                            {pos.side} {pos.leverage}x
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{pos.quantity} unit</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {currency(pos.entryPriceMinor)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {currency(pos.markPriceMinor)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-semibold text-[#f6465d]">
                        {currency(pos.liquidationPriceMinor)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatMinor(pos.marginMinor)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold tabular-nums ${
                          isProfit ? "text-[#0ecb81]" : "text-[#f6465d]"
                        }`}
                      >
                        {isProfit ? "+" : ""}
                        {currency(pnl)} ({isProfit ? "+" : ""}
                        {roe.toFixed(2)}%)
                      </td>
                      <td className="py-2.5 text-right">
                        <ClosePositionButton positionId={pos.id} />
                      </td>
                    </tr>
                  );
                })}
                {positions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-xs text-[#848e9c]">
                      Tidak ada posisi futures yang sedang terbuka.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: PESANAN TERBUKA */}
        {activeTab === "ORDERS" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2b313a] text-[10px] uppercase tracking-wider text-[#848e9c]">
                  <th className="py-2.5">Simbol</th>
                  <th className="py-2.5">Tipe</th>
                  <th className="py-2.5">Sisi</th>
                  <th className="py-2.5 text-right">Harga Limit</th>
                  <th className="py-2.5 text-right">Jumlah</th>
                  <th className="py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b313a]/50">
                {openOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-[#1e2329]/50">
                    <td className="py-2.5 font-bold">{ord.symbol}</td>
                    <td className="py-2.5 text-[#848e9c]">{ord.type}</td>
                    <td className="py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          ord.side === "BUY"
                            ? "bg-[#0ecb81]/15 text-[#0ecb81]"
                            : "bg-[#f6465d]/15 text-[#f6465d]"
                        }`}
                      >
                        {ord.side === "BUY" ? "BELI" : "JUAL"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {ord.limitPriceMinor != null
                        ? currency(ord.limitPriceMinor)
                        : "Market"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{ord.quantity} unit</td>
                    <td className="py-2.5 text-right">
                      <CancelOrderButton orderId={ord.id} />
                    </td>
                  </tr>
                ))}
                {openOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-[#848e9c]">
                      Tidak ada pesanan spot limit yang aktif.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: ASET KRIPTO SAYA */}
        {activeTab === "HOLDINGS" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2b313a] text-[10px] uppercase tracking-wider text-[#848e9c]">
                  <th className="py-2.5">Aset</th>
                  <th className="py-2.5 text-right">Jumlah Unit</th>
                  <th className="py-2.5 text-right">Rata-rata Harga Beli</th>
                  <th className="py-2.5 text-right">Harga Terkini</th>
                  <th className="py-2.5 text-right">Nilai Pasar Total</th>
                  <th className="py-2.5 text-right">Unrealized P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b313a]/50">
                {holdings.map((h) => {
                  const pnl =
                    h.marketValueMinor - h.avgCostMinor * BigInt(h.quantity);
                  const isProfit = pnl >= 0n;

                  return (
                    <tr key={h.symbol} className="hover:bg-[#1e2329]/50">
                      <td className="py-2.5 font-bold">{h.symbol}</td>
                      <td className="py-2.5 text-right tabular-nums font-semibold">
                        {h.quantity.toLocaleString("en-US")}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-[#848e9c]">
                        {currency(h.avgCostMinor)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {currency(h.currentPriceMinor)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-semibold">
                        {currency(h.marketValueMinor)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold tabular-nums ${
                          isProfit ? "text-[#0ecb81]" : "text-[#f6465d]"
                        }`}
                      >
                        {isProfit ? "+" : ""}
                        {currency(pnl)}
                      </td>
                    </tr>
                  );
                })}
                {holdings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-[#848e9c]">
                      {emptyHoldingsLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: RIWAYAT TRANSAKSI */}
        {activeTab === "HISTORY" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2b313a] text-[10px] uppercase tracking-wider text-[#848e9c]">
                  <th className="py-2.5">Koin</th>
                  <th className="py-2.5">Sisi</th>
                  <th className="py-2.5 text-right">Jumlah</th>
                  <th className="py-2.5 text-right">Harga Eksekusi</th>
                  <th className="py-2.5 text-right">Biaya Fee</th>
                  <th className="py-2.5 text-right">Total Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b313a]/50">
                {tradeHistory.map((t) => {
                  const total = BigInt(t.quantity) * t.priceMinor + t.feeMinor;
                  return (
                    <tr key={t.id} className="hover:bg-[#1e2329]/50">
                      <td className="py-2.5 font-bold">{t.symbol}</td>
                      <td className="py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            t.side === "BUY"
                              ? "bg-[#0ecb81]/15 text-[#0ecb81]"
                              : "bg-[#f6465d]/15 text-[#f6465d]"
                          }`}
                        >
                          {t.side === "BUY" ? "BELI" : "JUAL"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{t.quantity}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {currency(t.priceMinor)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-[#848e9c]">
                        {currency(t.feeMinor)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-semibold">
                        {currency(total)}
                      </td>
                    </tr>
                  );
                })}
                {tradeHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-[#848e9c]">
                      Belum ada riwayat transaksi kripto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
