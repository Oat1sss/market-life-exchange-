"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/session";
import { ForexError, tradeForex } from "@/server/services/forex-service";
import type { ActionState } from "./game";

function clean(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 40);
}

export async function tradeForexAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const pair = clean(formData.get("pair")).toUpperCase();
  const side = clean(formData.get("side"));
  const units = Number(clean(formData.get("units")));
  const idempotencyKey = clean(formData.get("idempotencyKey"));

  if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)) {
    return { error: "Pilih pasangan valas yang valid." };
  }
  if (side !== "BUY" && side !== "SELL") {
    return { error: "Pilih beli atau jual." };
  }
  if (!Number.isInteger(units) || units <= 0) {
    return { error: "Jumlah unit harus bilangan bulat positif." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { error: "Referensi transaksi tidak valid, muat ulang halaman." };
  }

  try {
    await tradeForex(userId, {
      pair,
      side,
      units,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof ForexError) return { error: error.message };
    return { error: "Transaksi valas gagal. Coba lagi." };
  }

  revalidatePath("/play/forex");
  revalidatePath("/play/portfolio");
  revalidatePath("/play/wallet");
  revalidatePath("/play");
  return { ok: true };
}
