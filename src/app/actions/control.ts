"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/session";
import { currency } from "@/domain/money";
import { DIRECTIVE_BY_KIND, isDirectiveKind } from "@/domain/economy";
import { ControlError, issueDirective } from "@/server/services/control-service";

export interface ControlActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

export async function issueDirectiveAction(
  _previous: ControlActionState,
  formData: FormData,
): Promise<ControlActionState> {
  const userId = await requireUserId();
  const companySymbol = String(formData.get("companySymbol") ?? "").trim().slice(0, 12);
  const kind = String(formData.get("kind") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();

  if (!/^[A-Z0-9]{2,12}$/.test(companySymbol)) {
    return { error: "Perusahaan tidak dikenal." };
  }
  if (!isDirectiveKind(kind)) return { error: "Keputusan dewan tidak dikenal." };

  try {
    const outcome = await issueDirective(userId, { companySymbol, kind, idempotencyKey });
    revalidatePath("/play/economy");
    revalidatePath("/play/portfolio");
    revalidatePath("/play");

    if (outcome.replayed) {
      return { ok: true, message: "Keputusan ini sudah tercatat sebelumnya." };
    }

    const label = DIRECTIVE_BY_KIND[kind].label;
    return {
      ok: true,
      message:
        outcome.playerPayoutMinor > 0n
          ? `${label} disetujui. Dividen ${currency(outcome.playerPayoutMinor)} masuk ke kas.`
          : `${label} disetujui dan berlaku pada tick berikutnya.`,
    };
  } catch (error) {
    if (error instanceof ControlError) {
      const messages: Partial<Record<ControlError["code"], string>> = {
        NO_GAME: "Buat karakter terlebih dahulu.",
        GAME_OVER: "Simulasi ini sudah berakhir.",
        UNKNOWN_COMPANY: "Perusahaan tidak dikenal.",
        UNKNOWN_ACTION: "Keputusan dewan tidak dikenal.",
        NO_STAKE: "Anda tidak memegang saham perusahaan ini.",
        TIER_TOO_LOW: "Porsi saham belum cukup untuk keputusan ini.",
        COOLDOWN: "RUPS terakhir baru saja berlangsung. Tunggu kuartal berikutnya.",
        BAD_KEY: "Referensi keputusan hilang, muat ulang halaman.",
      };
      return { error: messages[error.code] ?? error.message };
    }
    return { error: "Keputusan dewan gagal diproses. Coba lagi." };
  }
}
