"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/session";
import {
  FuturesError,
  closeFutures,
  openFutures,
} from "@/server/services/futures-service";
import type { FuturesSide } from "@/domain/futures";
import type { ActionState } from "./game";

const MAX_INPUT = 40;

function clean(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_INPUT);
}

function revalidateCrypto(symbol?: string) {
  revalidatePath("/play/crypto", "layout");
  revalidatePath("/play");
  if (symbol) revalidatePath(`/play/crypto/${symbol}`);
}

function parseOptionalMinor(input: string): bigint | null {
  if (!input) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.replace(/,/g, ""));
  if (!match) return null;
  const whole = BigInt(match[1]!) * 100n;
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return whole + fraction;
}

export async function openFuturesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const symbol = clean(formData.get("symbol")).toUpperCase();
  const side = clean(formData.get("side"));
  const quantity = Number(clean(formData.get("quantity")));
  const leverage = Number(clean(formData.get("leverage")));
  const stopLossRaw = clean(formData.get("stopLoss"));
  const takeProfitRaw = clean(formData.get("takeProfit"));
  const idempotencyKey = clean(formData.get("idempotencyKey"));

  if (side !== "LONG" && side !== "SHORT") {
    return { error: "Pilih arah LONG atau SHORT." };
  }
  if (!/^[A-Z]{3,8}$/.test(symbol)) return { error: "Simbol aset tidak dikenal." };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Jumlah kontrak harus bilangan bulat positif." };
  }
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 20) {
    return { error: "Leverage harus antara 1x dan 20x." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { error: "Referensi posisi tidak valid. Muat ulang halaman." };
  }

  const stopLossMinor = parseOptionalMinor(stopLossRaw);
  const takeProfitMinor = parseOptionalMinor(takeProfitRaw);
  if (stopLossRaw && stopLossMinor === null) {
    return { error: "Format Stop-Loss tidak valid (contoh: 1500.00)." };
  }
  if (takeProfitRaw && takeProfitMinor === null) {
    return { error: "Format Take-Profit tidak valid (contoh: 2000.00)." };
  }

  try {
    await openFutures(userId, {
      symbol,
      side: side as FuturesSide,
      quantity,
      leverage,
      stopLossMinor,
      takeProfitMinor,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof FuturesError) return { error: error.message };
    return { error: "Posisi gagal dibuka. Coba lagi." };
  }

  revalidateCrypto(symbol);
  return { ok: true };
}

export async function closeFuturesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const positionId = clean(formData.get("positionId"));
  try {
    await closeFutures(userId, positionId);
  } catch (error) {
    if (error instanceof FuturesError) return { error: error.message };
    return { error: "Posisi gagal ditutup. Coba lagi." };
  }

  revalidateCrypto();
  return { ok: true };
}
