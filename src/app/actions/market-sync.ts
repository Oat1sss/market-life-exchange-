"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/session";
import { syncRealCryptoPrices } from "@/server/services/market-sync";
import type { ActionState } from "./game";

export async function syncRealPricesAction(): Promise<ActionState> {
  const userId = await requireUserId();
  try {
    await syncRealCryptoPrices(userId);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Gagal menyinkronkan harga pasar.",
    };
  }
  revalidatePath("/play");
  revalidatePath("/play/crypto", "layout");
  revalidatePath("/play/market", "layout");
  revalidatePath("/play/portfolio");
  return { ok: true };
}
