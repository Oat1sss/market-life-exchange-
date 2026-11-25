import { redirect } from "next/navigation";
import { maybeUserId } from "@/server/session";
import { PageHeader } from "@/components/game/ui";
import { TradingArcade } from "@/components/game/trading-arcade";

export const instant = false;

export default async function ArcadePage() {
  const userId = await maybeUserId();
  if (!userId) redirect("/login");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="MarketLife Arcade"
        title="10 Mini-Game Pasar"
        description="Latihan ringan tanpa risiko: kelola warung dan alokasi modal, cari arbitrase kripto, uji leverage, hitung kurs forex, baca candle, sampai memory emiten. Semua skor hanya untuk sesi ini dan tidak mengubah saldo akunmu."
      />
      <TradingArcade />
    </div>
  );
}
