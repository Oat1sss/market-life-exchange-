"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/session";
import {
  BondError,
  buyBonds,
  sellBonds,
} from "@/server/services/bond-service";
import { currency } from "@/domain/money";

export interface BondActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

const MAX_INPUT = 40;

function clean(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_INPUT);
}

function revalidateBonds() {
  revalidatePath("/play/bonds");
  revalidatePath("/play/portfolio");
  revalidatePath("/play");
}

export async function bondTradeAction(
  _previous: BondActionState,
  formData: FormData,
): Promise<BondActionState> {
  const userId = await requireUserId();
  const side = clean(formData.get("side"));
  const bondKey = clean(formData.get("bondKey"));
  const quantity = Number(clean(formData.get("quantity")));
  const idempotencyKey = clean(formData.get("idempotencyKey"));

  if (side !== "BUY" && side !== "SELL") return { error: "Aksi obligasi tidak dikenal." };
  if (!/^[A-Z0-9]{2,16}$/.test(bondKey)) return { error: "Obligasi tidak dikenal." };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Jumlah obligasi harus bilangan bulat positif." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { error: "Referensi transaksi hilang, muat ulang halaman." };
  }

  try {
    const result =
      side === "BUY"
        ? await buyBonds(userId, { bondKey, quantity, idempotencyKey })
        : await sellBonds(userId, { bondKey, quantity, idempotencyKey });

    revalidateBonds();
    return {
      ok: true,
      message:
        side === "BUY"
          ? `Berhasil membeli ${quantity} obligasi senilai ${currency(result.grossMinor)}.`
          : `Berhasil menjual ${quantity} obligasi, dana masuk ${currency(result.netMinor)}.`,
    };
  } catch (error) {
    if (error instanceof BondError) {
      const messages: Partial<Record<BondError["code"], string>> = {
        NO_GAME: "Buat karakter terlebih dahulu.",
        GAME_OVER: "Simulasi ini sudah berakhir.",
        UNKNOWN_BOND: "Obligasi tidak dikenal.",
        BAD_QUANTITY: "Jumlah unit tidak valid.",
        INSUFFICIENT_FUNDS: "Kas tidak cukup untuk pembelian ini.",
        OVERSELL: "Unit obligasi yang dipegang tidak cukup.",
        MATURED: "Obligasi ini sudah jatuh tempo.",
        BAD_KEY: "Referensi transaksi hilang, muat ulang halaman.",
      };
      return { error: messages[error.code] ?? error.message };
    }
    return { error: "Transaksi obligasi gagal diproses. Coba lagi." };
  }
}

