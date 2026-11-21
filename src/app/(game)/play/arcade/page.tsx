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
        title="10 Mini-Game Trading"
        description="Latihan ringan tanpa risiko: tebak arah harga, hitung PnL, uji pemahaman leverage, sampai memory koin. Semua skor hanya untuk sesi ini dan tidak mengubah saldo akunmu."
      />
      <TradingArcade />
    </div>
  );
}
